"""Render non-secret provider identifiers into an ignored Wrangler config."""
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / "wrangler.jsonc").read_text(encoding="utf8"))
database_id = os.environ.get("CLOUDFLARE_D1_DATABASE_ID", "").strip()
site_url = os.environ.get("SITE_URL", "").rstrip("/")
turnstile_site_key = os.environ.get("TURNSTILE_SITE_KEY", "").strip()
try:
    parsed_database_id = UUID(database_id)
except ValueError:
    parsed_database_id = None
if parsed_database_id is None or parsed_database_id.int == 0:
    raise SystemExit("CLOUDFLARE_D1_DATABASE_ID GitHub variable is missing or invalid")
parsed = urlsplit(site_url)
if parsed.scheme != "https" or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username or "replace-me" in site_url:
    raise SystemExit("SITE_URL GitHub variable must be the final HTTPS origin")
if not re.fullmatch(r"[a-zA-Z0-9_-]{10,100}", turnstile_site_key):
    raise SystemExit("TURNSTILE_SITE_KEY GitHub variable is missing or invalid")
source["d1_databases"][0]["database_id"] = str(parsed_database_id)
source["vars"]["SITE_URL"] = site_url
destination = ROOT / ".generated" / "wrangler.production.json"
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(source, indent=2) + "\n", encoding="utf8")
print("Rendered production config using public identifiers; no runtime secrets read.")
