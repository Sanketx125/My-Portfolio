"""Application configuration, loaded from environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-key-change-me")
    ENV = os.environ.get("FLASK_ENV", "production")
    DEBUG = ENV == "development"

    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or "sqlite:///portfolio.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # LLM (OpenAI-compatible chat completions endpoint — works with
    # OpenCode Zen, OpenAI, OpenRouter, Groq, a self-hosted model, etc.)
    LLM_API_BASE = os.environ.get("LLM_API_BASE", "https://api.openai.com/v1")
    LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
    LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    LLM_TIMEOUT_SECONDS = float(os.environ.get("LLM_TIMEOUT_SECONDS", 20))

    # GitHub — live stats via the GraphQL API. Leave GITHUB_TOKEN blank to
    # fall back to the curated data in content.py (the site never breaks).
    # Token stays server-side; it is never sent to the browser.
    GITHUB_USERNAME = os.environ.get("GITHUB_USERNAME", "Sanketx125")
    GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
    GITHUB_CACHE_TTL_SECONDS = int(os.environ.get("GITHUB_CACHE_TTL_SECONDS", 3600))

    # Optional second account — contributions/repos/stars are merged into the
    # same dashboard. Leave blank to show the primary account alone.
    GITHUB_USERNAME_2 = os.environ.get("GITHUB_USERNAME_2", "")
    GITHUB_TOKEN_2 = os.environ.get("GITHUB_TOKEN_2", "")

    # SMTP / email
    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASS = os.environ.get("SMTP_PASS", "")
    CONTACT_TO_EMAIL = os.environ.get("CONTACT_TO_EMAIL", "")

    # Rate limiting
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # CORS — lock to your own domain in production
    ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
