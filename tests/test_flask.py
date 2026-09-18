import os
import unittest
from unittest.mock import patch

# Prevent a developer machine's global/.env database setting from affecting tests.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FLASK_ENV"] = "development"
os.environ["FLASK_SECRET_KEY"] = "test-only-import-secret"

from app import create_app
from models import db, Contact, ChatMessage


class TestConfig:
    TESTING = True
    ENV = "development"
    DEBUG = False
    SECRET_KEY = "test-only-secret"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    RATELIMIT_ENABLED = False
    RATELIMIT_STORAGE_URI = "memory://"
    MAX_CONTENT_LENGTH = 16 * 1024
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Strict"
    SESSION_COOKIE_SECURE = False
    LLM_API_BASE = "https://llm.invalid/v1"
    LLM_API_KEY = "test-key"
    LLM_MODEL = "test-model"
    LLM_TIMEOUT_SECONDS = 1
    GITHUB_USERNAME = "test"
    GITHUB_TOKEN = ""
    GITHUB_USERNAME_2 = ""
    GITHUB_TOKEN_2 = ""
    GITHUB_CACHE_TTL_SECONDS = 3600
    SMTP_HOST = ""
    SMTP_PORT = 587
    SMTP_USER = ""
    SMTP_PASS = ""
    CONTACT_TO_EMAIL = ""
    ALLOWED_ORIGIN = "http://localhost:5000"


class FlaskApplicationTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        with self.client.session_transaction() as session:
            session["csrf_token"] = "test-csrf"

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def contact(self, **updates):
        payload = {"csrf_token": "test-csrf", "website": "", "name": "A Person",
                   "email": "person@example.com", "project_type": "ai", "budget": "",
                   "message": "A sufficiently detailed project message."}
        payload.update(updates)
        return self.client.post("/api/contact", json=payload)

    def test_homepage_and_security_headers(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="project-map"', response.data)
        self.assertIn(b'id="chat-widget"', response.data)
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
        self.assertIn("https://tile.openstreetmap.org", response.headers["Content-Security-Policy"])
        pdf = self.client.get("/static/files/resume.pdf")
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf.headers["X-Frame-Options"], "SAMEORIGIN")
        self.assertEqual(pdf.headers["Content-Security-Policy"], "default-src 'self'; frame-ancestors 'self'")
        pdf.close()

    def test_contact_validates_and_persists_when_mail_fails(self):
        with (patch("blueprints.contact._send_notification_email", side_effect=RuntimeError("provider down")),
              patch.object(self.app.logger, "exception")):
            response = self.contact()
        self.assertEqual(response.status_code, 200)
        with self.app.app_context():
            self.assertEqual(Contact.query.count(), 1)

    def test_contact_rejects_invalid_and_oversize_fields(self):
        response = self.contact(email="not-an-email", message="x" * 4001)
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.get_json()["fields"])
        self.assertIn("message", response.get_json()["fields"])
        with self.app.app_context():
            self.assertEqual(Contact.query.count(), 0)

    def test_honeypot_drops_without_persistence(self):
        self.assertEqual(self.contact(website="spam.example").status_code, 200)
        with self.app.app_context():
            self.assertEqual(Contact.query.count(), 0)

    def test_contact_rejects_bad_csrf_and_large_body(self):
        self.assertEqual(self.contact(csrf_token="wrong").status_code, 400)
        response = self.client.post("/api/contact", data=b"{" + b"x" * 17000, content_type="application/json")
        self.assertEqual(response.status_code, 413)

    def test_chat_modes_history_and_limits(self):
        with patch("blueprints.chat._call_llm", return_value="Evidence-based reply") as call:
            response = self.client.post("/api/chat", json={"message": "Tell me about projects", "session_id": "test-session", "mode": "recruiter"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["reply"], "Evidence-based reply")
        self.assertIn("RECRUITER MODE", call.call_args.args[0][0]["content"])
        with self.app.app_context():
            self.assertEqual(ChatMessage.query.count(), 2)
            self.assertEqual(ChatMessage.query.filter_by(session_id="test-session").count(), 0)
        self.assertEqual(self.client.post("/api/chat", json={"message": "x" * 801}).status_code, 400)
        self.assertEqual(self.client.post("/api/chat", json=[]).status_code, 400)

    def test_jd_match_mode_does_not_persist_message(self):
        with patch("blueprints.chat._call_llm", return_value="Structured fit reply") as call:
            response = self.client.post("/api/chat", json={
                "message": "Looking for PyTorch and LiDAR engineer",
                "session_id": "jd-privacy-session",
                "mode": "jd_match"
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["reply"], "Structured fit reply")
        # System prompt should receive jd_match persona
        self.assertIn("Fit Summary", call.call_args.args[0][0]["content"])
        with self.app.app_context():
            # Crucial: JD must NOT be saved into ChatMessage database table
            self.assertEqual(ChatMessage.query.filter_by(session_id="jd-privacy-session").count(), 0)

    def test_chat_provider_failure_is_generic(self):
        with (patch("blueprints.chat._call_llm", side_effect=RuntimeError("private provider detail")),
              patch.object(self.app.logger, "exception")):
            response = self.client.post("/api/chat", json={"message": "Tell me about projects"})
        self.assertEqual(response.status_code, 502)
        body = response.get_data(as_text=True)
        self.assertNotIn("private provider detail", body)
        self.assertNotIn("Authorization", body)

    def test_production_origin_and_cookie_policy_fail_closed(self):
        class ProductionConfig(TestConfig):
            ENV = "production"
            SECRET_KEY = "p" * 48
            SESSION_COOKIE_NAME = "__Host-portfolio"
            SESSION_COOKIE_SECURE = True
            SESSION_COOKIE_PATH = "/"
            SESSION_COOKIE_DOMAIN = None
            ALLOWED_ORIGIN = "https://portfolio.example.test"

        app = create_app(ProductionConfig)
        client = app.test_client()
        self.assertEqual(client.post("/api/chat", json={"message": "hello"}).status_code, 403)
        with patch("blueprints.chat._call_llm", return_value="Safe reply"):
            allowed = client.post(
                "/api/chat", json={"message": "hello"},
                headers={"Origin": ProductionConfig.ALLOWED_ORIGIN, "Sec-Fetch-Site": "same-origin"},
            )
        self.assertNotEqual(allowed.status_code, 403)
        home = client.get("/")
        cookie = home.headers.get("Set-Cookie", "")
        self.assertIn("__Host-portfolio=", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertNotIn("Domain=", cookie)
        with app.app_context():
            db.session.remove()
            db.drop_all()


if __name__ == "__main__":
    unittest.main()
