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
        for marker in ['id="project-map"', 'id="palette"', 'id="chat-widget"', 'id="contact-form"']:
            self.assertIn(marker, html)
        self.assertNotIn('id="theme-toggle"', html)
        self.assertNotIn('data-theme="light"', html)
        nav = re.search(r'<nav class="nav__links".*?</nav>', html, re.S).group(0)
        nav_targets = re.findall(r'href="(#[^"]+)" data-nav-link', nav)
        self.assertEqual(nav_targets, ["#about", "#projects", "#portfolio-intelligence", "#social-proof", "#career", "#contact"])
        eyebrows = re.findall(r'class="section__eyebrow">(\d{2})', html)
        self.assertEqual(eyebrows, ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"])
        self.assertIn("GDB-Engine-for-QGIS-limitations-", html)
        for url in re.findall(r'(?:src|href|data)="(/static/[^"?#]+)', html):
            self.assertTrue((ROOT / "dist" / url.lstrip("/")).is_file(), url)
        self.assertIn("/static/vendor/gsap.min.js", html)
        self.assertIn("/static/vendor/leaflet.js", html)
        self.assertFalse(list((ROOT / "dist").rglob("*.map")))
        for script in (ROOT / "dist").rglob("*.js"):
            self.assertNotIn("sourceMappingURL=", script.read_text(encoding="utf8"))
        headers = (ROOT / "dist/_headers").read_text(encoding="utf8")
        self.assertIn("img-src 'self' data: https://tile.openstreetmap.org", headers)
        self.assertIn("/static/files/resume.pdf\n  ! X-Frame-Options\n  X-Frame-Options: SAMEORIGIN", headers)
        self.assertIn("! Content-Security-Policy\n  Content-Security-Policy: default-src 'self'; frame-ancestors 'self'", headers)

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

    def test_company_branding_is_strictly_nakshatech(self):
        forbidden_variants = ["NakshaTech", "Naksha Tech", "NAKSHATECH"]
        paths_to_check = [
            ROOT / "content.py",
            ROOT / "services/prompts.py",
            ROOT / "blueprints/chat.py",
            *(ROOT / "templates").rglob("*.html"),
            *(ROOT / "static/js").glob("*.js"),
        ]
        violations = []
        for path in paths_to_check:
            text = path.read_text(encoding="utf8")
            for variant in forbidden_variants:
                if variant in text:
                    violations.append(f"{path.name} contains forbidden branding '{variant}'")
        self.assertEqual(violations, [])

    def test_fact_registry_verified_filter(self):
        from content import PROFESSIONAL_FACTS, get_verified_capabilities, get_verified_facts
        self.assertGreater(len(PROFESSIONAL_FACTS), 0)
        verified_facts = get_verified_facts()
        for fact in verified_facts:
            self.assertTrue(fact.get("verified"), f"Fact {fact.get('id')} in verified_facts is not verified=True")
            self.assertIn("provenance", fact)

        unverified_ids = [f["id"] for f in PROFESSIONAL_FACTS if not f.get("verified")]
        self.assertIn("unverified_lidar_95_accuracy", unverified_ids)
        self.assertIn("unverified_linkedin_impressions", unverified_ids)
        self.assertIn("unverified_mentees_count", unverified_ids)

        verified_ids = [f["id"] for f in verified_facts]
        for unverified_id in unverified_ids:
            self.assertNotIn(unverified_id, verified_ids)

        self.assertIn("fact_award_code_catalyst", verified_ids)
        for capability in get_verified_capabilities():
            self.assertTrue(capability["evidence_ids"])
            self.assertTrue(set(capability["evidence_ids"]).issubset(set(verified_ids)))

    def test_performance_metrics_require_strong_provenance(self):
        from content import PROFESSIONAL_FACTS, get_verified_facts
        metric = next(f for f in PROFESSIONAL_FACTS if f["id"] == "unverified_lidar_95_accuracy")
        original = (metric["verified"], metric["provenance"])
        try:
            metric["verified"] = True
            metric["provenance"] = "resume_claim"
            self.assertNotIn(metric, get_verified_facts())
            metric["provenance"] = "benchmark_artifact"
            self.assertIn(metric, get_verified_facts())
        finally:
            metric["verified"], metric["provenance"] = original

    def test_github_query_requests_public_data_only(self):
        from services.github import _QUERY
        self.assertNotIn("privacy: PRIVATE", _QUERY)
        self.assertNotIn("privateRepos", _QUERY)


if __name__ == "__main__":
    unittest.main()
