"""Credential-free Jinja build. Never import app/config or load .env."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import urlsplit
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from flask import Flask, render_template
from content import CONTENT
from services.prompts import _system_prompt
from services.contract import CONTACT_LIMITS, PROJECT_TYPES, CHAT_MESSAGE_LIMIT, HISTORY_TURNS
from services.github import _QUERY


def build():
    site = os.environ.get("SITE_URL", "https://example.invalid").rstrip("/")
    parsed = urlsplit(site)
    if parsed.scheme != "https" or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username:
        raise SystemExit("SITE_URL must be an HTTPS origin without path or credentials")
    key = os.environ.get("TURNSTILE_SITE_KEY", "")
    if key and not re.fullmatch(r"[a-zA-Z0-9_-]{10,100}", key):
        raise SystemExit("Invalid public Turnstile site key")
    dist = ROOT / "dist"
    # Fixed build directory only; never touch user data.
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir()
    shutil.copytree(ROOT / "static", dist / "static")
    vendor = dist / "static/vendor"
    vendor.mkdir()
    for source, target in [("gsap/dist/gsap.min.js", "gsap.min.js"),
                           ("gsap/dist/ScrollTrigger.min.js", "ScrollTrigger.min.js"),
                           ("leaflet/dist/leaflet.js", "leaflet.js"),
                           ("leaflet/dist/leaflet.css", "leaflet.css")]:
        shutil.copyfile(ROOT / "node_modules" / source, vendor / target)
    shutil.copytree(ROOT / "node_modules/leaflet/dist/images", vendor / "images")
    for package in ["gsap", "leaflet", "nunjucks"]:
        for source in (ROOT / "node_modules" / package).glob("*LICENSE*"):
            shutil.copyfile(source, vendor / (package + "-LICENSE.txt"))
    fallback = {"configured": False, "featured": CONTENT.get("github", {}).get("fallback_repos", [])}
    app = Flask("portfolio-build", template_folder=str(ROOT / "templates"), static_folder=str(ROOT / "static"))
    with app.test_request_context("/", base_url=site + "/"):
        html = render_template("index.html", content=CONTENT, github=fallback, csrf_token="", production_build=True)
    replacements = {
        "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js": "/static/vendor/gsap.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js": "/static/vendor/ScrollTrigger.min.js",
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js": "/static/vendor/leaflet.js",
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css": "/static/vendor/leaflet.css",
    }
    for old, new in replacements.items():
        html = html.replace(old, new)
    (dist / "index.html").write_text(html, encoding="utf8")
    (dist / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site}/sitemap.xml\n", encoding="utf8")
    (dist / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{escape(site)}/</loc></url></urlset>', encoding="utf8")
    (dist / "static/js/runtime-config.js").write_text("window.PORTFOLIO_CONFIG = Object.freeze(" + json.dumps({"apiBaseUrl": "", "production": True, "turnstileSiteKey": key}) + ");\n", encoding="utf8")
    generated = ROOT / ".generated"
    generated.mkdir(exist_ok=True)
    (generated / "portfolio.json").write_text(json.dumps({
        "name": CONTENT["name"], "content": CONTENT,
        "prompts": {m: _system_prompt(m) for m in ["default", "recruiter"]},
        "githubQuery": _QUERY, "fallback": fallback,
        "contactLimits": CONTACT_LIMITS, "projectTypes": PROJECT_TYPES,
        "chatLimit": CHAT_MESSAGE_LIMIT, "historyTurns": HISTORY_TURNS,
    }, ensure_ascii=False), encoding="utf8")
    # Compile the existing Jinja-compatible GitHub partial, keeping one UI source.
    subprocess.run(["node", "scripts/compile-template.mjs"], cwd=ROOT, check=True)
    inline_hashes = []
    import base64
    for attrs, body in re.findall(r"<script([^>]*)>(.*?)</script>", html, re.S):
        if "src=" not in attrs:
            inline_hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(body.encode()).digest()).decode() + "'")
    csp = "; ".join([
        "default-src 'self'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'",
        "script-src 'self' https://challenges.cloudflare.com " + " ".join(inline_hashes),
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https://*.basemaps.cartocdn.com https://avatars.githubusercontent.com",
        "connect-src 'self' https://challenges.cloudflare.com", "frame-src 'self' https://challenges.cloudflare.com",
        "object-src 'self'", "upgrade-insecure-requests",
    ])
    (dist / "_headers").write_text("/*\n  Content-Security-Policy: " + csp + "\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Strict-Transport-Security: max-age=31536000\n", encoding="utf8")
    print("Built public assets and private runtime bundle; no runtime credentials used.")


if __name__ == "__main__":
    build()
