import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class StaticBuildTests(unittest.TestCase):
    def test_static_build_keeps_ui_and_assets(self):
        html = (ROOT / "dist/index.html").read_text(encoding="utf8")
        for marker in ['id="project-map"', 'id="palette"', 'id="chat-widget"', 'id="contact-form"', 'id="theme-toggle"']:
            self.assertIn(marker, html)
        for url in re.findall(r'(?:src|href|data)="(/static/[^"?#]+)', html):
            self.assertTrue((ROOT / "dist" / url.lstrip("/")).is_file(), url)
        self.assertIn("/static/vendor/gsap.min.js", html)
        self.assertIn("/static/vendor/leaflet.js", html)

    def test_api_endpoint_configuration_is_centralized(self):
        fetch_calls = []
        for path in (ROOT / "static/js").glob("*.js"):
            if "fetch(" in path.read_text(encoding="utf8"):
                fetch_calls.append(path.name)
        self.assertEqual(fetch_calls, ["api-client.js"])

    def test_public_artifacts_have_no_known_secret_values(self):
        result = subprocess.run([sys.executable, "scripts/scan_secrets.py", "--public"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_production_config_accepts_only_public_deployment_identifiers(self):
        env = os.environ.copy()
        env.update({
            "CLOUDFLARE_D1_DATABASE_ID": "12345678-1234-4234-8234-123456789abc",
            "SITE_URL": "https://portfolio.example.test",
            "TURNSTILE_SITE_KEY": "public-test-key",
        })
        result = subprocess.run([sys.executable, "scripts/render_deploy_config.py"], cwd=ROOT, env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        config = json.loads((ROOT / ".generated/wrangler.production.json").read_text(encoding="utf8"))
        self.assertEqual(config["d1_databases"][0]["database_id"], env["CLOUDFLARE_D1_DATABASE_ID"])
        self.assertEqual(config["vars"]["SITE_URL"], env["SITE_URL"])


if __name__ == "__main__":
    unittest.main()
