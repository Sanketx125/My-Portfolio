"""GitHub integration — live stats via the GraphQL API.

Design notes:
  * One GraphQL request per cache window. Results are memoised in-process for
    ``GITHUB_CACHE_TTL_SECONDS`` so page renders cost nothing after the first.
  * Every failure mode is swallowed and reported as ``None``. The site must
    never break because GitHub is unreachable or the token is missing/expired.
  * Only public repository metadata is queried. Private repository access is
    unnecessary and must not be granted to the portfolio token.
"""
import logging
import time
from datetime import datetime, timezone

import requests

log = logging.getLogger(__name__)

GRAPHQL_URL = "https://api.github.com/graphql"
REQUEST_TIMEOUT = 10

# How many public repos to pull in the featured grid.
FEATURED_LIMIT = 6

_QUERY = """
query($login: String!) {
  user(login: $login) {
    login
    name
    avatarUrl
    bio
    followers { totalCount }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount }
        }
      }
    }
    publicRepos: repositories(
      privacy: PUBLIC
      first: 100
      orderBy: { field: STARGAZERS, direction: DESC }
      ownerAffiliations: OWNER
    ) {
      totalCount
      nodes {
        name
        description
        url
        homepageUrl
        stargazerCount
        forkCount
        isFork
        pushedAt
        primaryLanguage { name color }
        repositoryTopics(first: 6) { nodes { topic { name } } }
      }
    }
  }
}
"""

# {data, ts} — ts is a monotonic timestamp of the last successful fetch.
_cache = {"data": None, "ts": 0.0}


def _level(count: int, peak: int) -> int:
    """Map a daily contribution count to a 0-4 heatmap level."""
    if count <= 0:
        return 0
    if peak <= 0:
        return 1
    ratio = count / peak
    if ratio > 0.75:
        return 4
    if ratio > 0.5:
        return 3
    if ratio > 0.25:
        return 2
    return 1


def _language_breakdown(repo_nodes):
    """Count primary languages across public repos into a sorted percentage list."""
    counts = {}
    colors = {}
    for repo in repo_nodes:
        lang = repo.get("primaryLanguage")
        if not lang:
            continue
        name = lang["name"]
        counts[name] = counts.get(name, 0) + 1
        colors[name] = lang.get("color") or "#8b949e"

    total = sum(counts.values()) or 1
    breakdown = [
        {
            "name": name,
            "count": count,
            "color": colors[name],
            "pct": round(count * 100 / total, 1),
        }
        for name, count in counts.items()
    ]
    breakdown.sort(key=lambda item: item["count"], reverse=True)
    return breakdown[:8]


def _normalize(user: dict) -> dict:
    """Turn the raw GraphQL response into a stable, template-friendly shape."""
    repos = user["publicRepos"]["nodes"]
    contributions = user["contributionsCollection"]

    days = []
    for week in contributions["contributionCalendar"]["weeks"]:
        for day in week["contributionDays"]:
            days.append(
                {"date": day["date"], "count": day["contributionCount"]}
            )

    peak = max((day["count"] for day in days), default=0)
    for day in days:
        day["level"] = _level(day["count"], peak)

    # Chunk back into Sunday-aligned weeks for a 7-row heatmap grid.
    weeks = [days[i:i + 7] for i in range(0, len(days), 7)]

    candidates = [r for r in repos if not r.get("isFork")]
    featured = sorted(
        candidates, key=lambda r: r.get("stargazerCount", 0), reverse=True
    )[:FEATURED_LIMIT]

    return {
        "configured": True,
        "profile": {
            "login": user.get("login"),
            "name": user.get("name"),
            "avatar": user.get("avatarUrl"),
            "bio": user.get("bio"),
        },
        "totals": {
            "public_repos": user["publicRepos"]["totalCount"],
            "stars": sum(r.get("stargazerCount", 0) for r in repos),
            "followers": user["followers"]["totalCount"],
            "contributions": contributions["contributionCalendar"]["totalContributions"],
        },
        "activity": {
            "commits": contributions["totalCommitContributions"],
            "prs": contributions["totalPullRequestContributions"],
            "issues": contributions["totalIssueContributions"],
        },
        "languages": _language_breakdown(repos),
        "featured": [
            {
                "name": r["name"],
                "description": r.get("description") or "",
                "url": r["url"],
                "homepage": r.get("homepageUrl") or "",
                "stars": r.get("stargazerCount", 0),
                "forks": r.get("forkCount", 0),
                "language": (r.get("primaryLanguage") or {}).get("name", ""),
                "color": (r.get("primaryLanguage") or {}).get("color") or "#8b949e",
                "topics": [t["topic"]["name"] for t in r.get("repositoryTopics", {}).get("nodes", [])],
                "pushed_at": (r.get("pushedAt") or "")[:10],
            }
            for r in featured
        ],
        "calendar": {
            "total": contributions["contributionCalendar"]["totalContributions"],
            "peak": peak,
            "weeks": weeks,
        },
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _fetch_user(username: str, token: str):
    """Raw GraphQL fetch for one account. Returns the ``user`` dict or None."""
    if not token or not username:
        return None
    try:
        response = requests.post(
            GRAPHQL_URL,
            headers={
                "Authorization": f"bearer {token}",
                "Content-Type": "application/json",
            },
            json={"query": _QUERY, "variables": {"login": username}},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception:
        log.warning("GitHub GraphQL request failed for configured account")
        return None

    if payload.get("errors"):
        log.warning("GitHub GraphQL returned a provider error")
        return None

    user = (payload.get("data") or {}).get("user")
    if not user:
        log.warning("Configured GitHub account was not found")
    return user


def _merge_users(primary: dict, secondary: dict) -> dict:
    """Combine two accounts' raw GraphQL ``user`` payloads into one, so the
    dashboard can show total contributions/repos/stars across both."""
    merged = dict(primary)

    merged["followers"] = {
        "totalCount": primary["followers"]["totalCount"] + secondary["followers"]["totalCount"]
    }

    def _days(user):
        out = {}
        for week in user["contributionsCollection"]["contributionCalendar"]["weeks"]:
            for day in week["contributionDays"]:
                out[day["date"]] = day["contributionCount"]
        return out

    days1, days2 = _days(primary), _days(secondary)
    all_dates = sorted(set(days1) | set(days2))
    merged_days = [
        {"date": d, "contributionCount": days1.get(d, 0) + days2.get(d, 0)}
        for d in all_dates
    ]

    c1, c2 = primary["contributionsCollection"], secondary["contributionsCollection"]
    merged["contributionsCollection"] = {
        "totalCommitContributions": c1["totalCommitContributions"] + c2["totalCommitContributions"],
        "totalPullRequestContributions": c1["totalPullRequestContributions"] + c2["totalPullRequestContributions"],
        "totalIssueContributions": c1["totalIssueContributions"] + c2["totalIssueContributions"],
        "contributionCalendar": {
            "totalContributions": sum(d["contributionCount"] for d in merged_days),
            "weeks": [{"contributionDays": merged_days}],
        },
    }

    merged["publicRepos"] = {
        "totalCount": primary["publicRepos"]["totalCount"] + secondary["publicRepos"]["totalCount"],
        "nodes": primary["publicRepos"]["nodes"] + secondary["publicRepos"]["nodes"],
    }
    return merged


def get_github_stats(
    username: str, token: str, ttl: int = 3600, username2: str = "", token2: str = ""
):
    """Return normalized GitHub stats, memoised for ``ttl`` seconds.

    When ``username2``/``token2`` are also configured, their contributions,
    repos and stars are merged into the same dashboard. If the second account
    isn't configured, or its fetch fails, this silently falls back to the
    primary account alone — the page never depends on both being present.

    Returns ``None`` when the primary account has no token or its request
    fails — callers should fall back to curated content in that case.
    """
    now = time.monotonic()
    if _cache["data"] is not None and (now - _cache["ts"]) < ttl:
        return _cache["data"]

    user = _fetch_user(username, token)
    if not user:
        return None

    if username2 and token2:
        secondary = _fetch_user(username2, token2)
        if secondary:
            user = _merge_users(user, secondary)

    try:
        stats = _normalize(user)
    except Exception:
        log.warning("Failed to normalize GitHub payload")
        return None

    _cache["data"] = stats
    _cache["ts"] = now
    return stats


def get_github_payload(config, fallback_repos=None):
    """Convenience wrapper for blueprints/templates.

    Always returns a dict. When live data is unavailable it returns a
    ``configured: False`` payload carrying the curated fallback repos so the
    GitHub section renders something meaningful either way.
    """
    stats = get_github_stats(
        config.get("GITHUB_USERNAME", ""),
        config.get("GITHUB_TOKEN", ""),
        config.get("GITHUB_CACHE_TTL_SECONDS", 3600),
        config.get("GITHUB_USERNAME_2", ""),
        config.get("GITHUB_TOKEN_2", ""),
    )
    if stats:
        return stats

    return {
        "configured": False,
        "profile": {"login": config.get("GITHUB_USERNAME", "")},
        "totals": {},
        "activity": {},
        "languages": [],
        "featured": fallback_repos or [],
        "calendar": {"total": 0, "peak": 0, "weeks": []},
        "fetched_at": None,
    }
