"""GitHub blueprint — GET /api/github.

Returns the same cached payload the page is rendered with, so the dashboard
can refresh itself client-side without a full reload.
"""
from flask import Blueprint, current_app, jsonify

from content import CONTENT
from extensions import limiter
from services.github import get_github_payload

github_bp = Blueprint("github", __name__, url_prefix="/api")


@github_bp.route("/github", methods=["GET"])
@limiter.limit("20 per minute")
def github_stats():
    payload = get_github_payload(
        current_app.config,
        CONTENT.get("github", {}).get("fallback_repos", []),
    )
    return jsonify(payload)
