"""Read-only post-deploy checks; sends no contact, email, or LLM request."""
import json
import sys
import time
from urllib.request import Request, urlopen

origin = sys.argv[1].rstrip("/")


def get(path, attempts=4):
    last = None
    for attempt in range(attempts):
        try:
            with urlopen(Request(origin + path, headers={"User-Agent": "portfolio-deploy-smoke/1"}), timeout=20) as response:
                if response.status != 200:
                    raise RuntimeError(f"{path}: HTTP {response.status}")
                return response.read()
        except Exception as error:
            last = error
            if attempt + 1 < attempts:
                time.sleep(2 ** attempt)
    raise SystemExit(f"Smoke test failed for {path}: {last}")


home = get("/").decode("utf8")
for marker in ['id="project-map"', 'id="palette"', 'id="chat-widget"', 'id="contact-form"']:
    if marker not in home:
        raise SystemExit(f"Homepage missing {marker}")
get("/robots.txt")
get("/sitemap.xml")
github = json.loads(get("/api/github"))
if "configured" not in github:
    raise SystemExit("GitHub API returned an invalid contract")
print("Read-only production smoke test passed.")
