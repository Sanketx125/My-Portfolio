"""Main blueprint — renders the single-page site plus SEO/static extras."""
import secrets
from flask import Blueprint, current_app, render_template, Response, request, session

from content import CONTENT
from services.github import get_github_payload

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_hex(16)
        session["csrf_token"] = token

    github = get_github_payload(
        current_app.config,
        CONTENT.get("github", {}).get("fallback_repos", []),
    )
    return render_template(
        "index.html", content=CONTENT, csrf_token=token, github=github
    )


@main_bp.route("/robots.txt")
def robots_txt():
    lines = [
        "User-agent: *",
        "Allow: /",
        f"Sitemap: {request.url_root.rstrip('/')}/sitemap.xml",
    ]
    return Response("\n".join(lines), mimetype="text/plain")


@main_bp.route("/sitemap.xml")
def sitemap_xml():
    root = request.url_root.rstrip("/")
    body = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{root}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>"""
    return Response(body, mimetype="application/xml")
