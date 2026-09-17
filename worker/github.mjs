import portfolio from '../.generated/portfolio.json' with {type: 'json'};
import {HttpError, nowSeconds} from './security.mjs';

const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#8b949e';
const text = value => typeof value === 'string' ? value : '';
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const publicUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
};

function normalize(user) {
  const repos = Array.isArray(user?.publicRepos?.nodes) ? user.publicRepos.nodes : [];
  const contributions = user?.contributionsCollection || {};
  const days = (contributions.contributionCalendar?.weeks || []).flatMap(week => week.contributionDays || [])
    .map(day => ({date: text(day.date), count: count(day.contributionCount)}));
  const peak = Math.max(0, ...days.map(day => day.count));
  for (const day of days) {
    const ratio = peak ? day.count / peak : 0;
    day.level = day.count === 0 ? 0 : ratio > .75 ? 4 : ratio > .5 ? 3 : ratio > .25 ? 2 : 1;
  }
  const languages = new Map();
  for (const repo of repos) {
    const lang = repo.primaryLanguage;
    if (lang?.name) languages.set(lang.name, {name: text(lang.name).slice(0, 80), color: color(lang.color), count: (languages.get(lang.name)?.count || 0) + 1});
  }
  const langTotal = [...languages.values()].reduce((sum, item) => sum + item.count, 0) || 1;
  const languageList = [...languages.values()].map(item => ({...item, pct: Math.round(item.count * 1000 / langTotal) / 10}))
    .sort((a, b) => b.count - a.count).slice(0, 8);
  const featured = repos.filter(repo => !repo.isFork).sort((a, b) => count(b.stargazerCount) - count(a.stargazerCount)).slice(0, 6).map(repo => ({
    name: text(repo.name).slice(0, 100), description: text(repo.description).slice(0, 500),
    url: publicUrl(repo.url), homepage: publicUrl(repo.homepageUrl), stars: count(repo.stargazerCount),
    forks: count(repo.forkCount), language: text(repo.primaryLanguage?.name).slice(0, 80), color: color(repo.primaryLanguage?.color),
    topics: (repo.repositoryTopics?.nodes || []).map(node => text(node.topic?.name).slice(0, 50)).filter(Boolean).slice(0, 6),
    pushed_at: text(repo.pushedAt).slice(0, 10),
  })).filter(repo => repo.url);
  return {
    configured: true,
    profile: {login: text(user.login), name: text(user.name), avatar: publicUrl(user.avatarUrl), bio: text(user.bio)},
    totals: {public_repos: count(user.publicRepos?.totalCount), private_repos: count(user.privateRepos?.totalCount),
      stars: repos.reduce((sum, repo) => sum + count(repo.stargazerCount), 0), followers: count(user.followers?.totalCount),
      contributions: count(contributions.contributionCalendar?.totalContributions)},
    activity: {commits: count(contributions.totalCommitContributions), prs: count(contributions.totalPullRequestContributions), issues: count(contributions.totalIssueContributions)},
    languages: languageList, featured,
    calendar: {total: count(contributions.contributionCalendar?.totalContributions), peak, weeks: Array.from({length: Math.ceil(days.length / 7)}, (_, i) => days.slice(i * 7, i * 7 + 7))},
    fetched_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}

function merge(primary, secondary) {
  const merged = structuredClone(primary);
  merged.followers.totalCount = count(primary.followers?.totalCount) + count(secondary.followers?.totalCount);
  const firstDays = new Map((primary.contributionsCollection?.contributionCalendar?.weeks || []).flatMap(w => w.contributionDays || []).map(d => [d.date, count(d.contributionCount)]));
  const secondDays = new Map((secondary.contributionsCollection?.contributionCalendar?.weeks || []).flatMap(w => w.contributionDays || []).map(d => [d.date, count(d.contributionCount)]));
  const dates = [...new Set([...firstDays.keys(), ...secondDays.keys()])].sort();
  const contributionDays = dates.map(date => ({date, contributionCount: (firstDays.get(date) || 0) + (secondDays.get(date) || 0)}));
  const a = primary.contributionsCollection || {}, b = secondary.contributionsCollection || {};
  merged.contributionsCollection = {
    totalCommitContributions: count(a.totalCommitContributions) + count(b.totalCommitContributions),
    totalPullRequestContributions: count(a.totalPullRequestContributions) + count(b.totalPullRequestContributions),
    totalIssueContributions: count(a.totalIssueContributions) + count(b.totalIssueContributions),
    contributionCalendar: {totalContributions: contributionDays.reduce((sum, day) => sum + day.contributionCount, 0), weeks: [{contributionDays}]},
  };
  merged.publicRepos = {totalCount: count(primary.publicRepos?.totalCount) + count(secondary.publicRepos?.totalCount), nodes: [...(primary.publicRepos?.nodes || []), ...(secondary.publicRepos?.nodes || [])]};
  merged.privateRepos = {totalCount: count(primary.privateRepos?.totalCount) + count(secondary.privateRepos?.totalCount)};
  return merged;
}

export class GitHubService {
  constructor(store, env, http) { this.store = store; this.env = env; this.http = http; }
  async fetchUser(username, token) {
    if (!username || !token) return null;
    const response = await this.http('https://api.github.com/graphql', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: {'Authorization': `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'sanket-portfolio'},
      body: JSON.stringify({query: portfolio.githubQuery, variables: {login: username}}),
    });
    if (!response.ok) throw new HttpError(502, 'GitHub activity is temporarily unavailable.');
    const body = await response.json();
    if (body.errors || !body.data?.user) throw new HttpError(502, 'GitHub activity is temporarily unavailable.');
    return body.data.user;
  }
  async get() {
    const now = nowSeconds();
    const cached = await this.store.cache('github:v1');
    if (cached && cached.expires > now) return JSON.parse(cached.value);
    if (!this.env.GITHUB_TOKEN || !this.env.GITHUB_USERNAME) return portfolio.fallback;
    let primary = await this.fetchUser(this.env.GITHUB_USERNAME, this.env.GITHUB_TOKEN);
    if (this.env.GITHUB_USERNAME_2 && this.env.GITHUB_TOKEN_2) {
      try { const secondary = await this.fetchUser(this.env.GITHUB_USERNAME_2, this.env.GITHUB_TOKEN_2); if (secondary) primary = merge(primary, secondary); } catch { /* primary remains useful */ }
    }
    const result = normalize(primary);
    await this.store.putCache('github:v1', result, now + 3600);
    return result;
  }
}
