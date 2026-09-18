"""Contact blueprint — POST /api/contact"""
import re
import smtplib
from email.message import EmailMessage

from flask import Blueprint, request, jsonify, current_app, session

from extensions import limiter
from models import db, Contact
from content import CONTENT
from services.contract import CONTACT_LIMITS, PROJECT_TYPES

contact_bp = Blueprint("contact", __name__, url_prefix="/api")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VALID_PROJECT_TYPES = set(PROJECT_TYPES)
MAX_MESSAGE_LENGTH = CONTACT_LIMITS["message"]


def _clean(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _send_notification_email(submission: Contact):
    cfg = current_app.config
    if not (cfg["SMTP_HOST"] and cfg["CONTACT_TO_EMAIL"]):
        current_app.logger.info(
            "SMTP not configured — skipping notification email for submission %s",
            submission.id,
        )
        return

    msg = EmailMessage()
    msg["Subject"] = f"New portfolio inquiry from {submission.name}"
    msg["From"] = cfg["SMTP_USER"] or cfg["CONTACT_TO_EMAIL"]
    msg["To"] = cfg["CONTACT_TO_EMAIL"]
    msg.set_content(
        f"Name: {submission.name}\n"
        f"Email: {submission.email}\n"
        f"Project type: {submission.project_type}\n"
        f"Budget: {submission.budget or 'Not specified'}\n\n"
        f"Message:\n{submission.message}\n"
    )

    with smtplib.SMTP(cfg["SMTP_HOST"], cfg["SMTP_PORT"], timeout=10) as server:
        server.starttls()
        if cfg["SMTP_USER"] and cfg["SMTP_PASS"]:
            server.login(cfg["SMTP_USER"], cfg["SMTP_PASS"])
        server.send_message(msg)


def _send_autoreply(submission: Contact):
    cfg = current_app.config
    if not (cfg["SMTP_HOST"] and cfg["SMTP_USER"]):
        return

    name = CONTENT["name"]
    msg = EmailMessage()
    msg["Subject"] = f"Thanks for reaching out, {submission.name}"
    msg["From"] = cfg["SMTP_USER"]
    msg["To"] = submission.email
    msg.set_content(
        f"Hi {submission.name},\n\n"
        f"Thanks for your message — {name} has received it and will get back "
        f"to you soon.\n\n"
        f"— {name}"
    )

    with smtplib.SMTP(cfg["SMTP_HOST"], cfg["SMTP_PORT"], timeout=10) as server:
        server.starttls()
        server.login(cfg["SMTP_USER"], cfg["SMTP_PASS"])
        server.send_message(msg)


@contact_bp.route("/contact", methods=["POST"])
@limiter.limit("5 per minute")
def contact():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A JSON object is required."}), 400

    # Basic CSRF check: token from the page must match the session's token.
    submitted_token = payload.get("csrf_token", "")
    if not submitted_token or submitted_token != session.get("csrf_token"):
        return jsonify({"error": "Your session expired — please reload the page and try again."}), 400

    # Honeypot: a hidden field named "website" that only bots fill in.
    if _clean(payload.get("website", "")):
        return jsonify({"ok": True}), 200  # silently drop, pretend success

    name = _clean(payload.get("name", ""))
    email = _clean(payload.get("email", ""))
    project_type = _clean(payload.get("project_type", "")).lower()
    budget = _clean(payload.get("budget", ""))
    message = _clean(payload.get("message", ""))

    errors = {}
    if not name:
        errors["name"] = "Please enter your name."
    elif len(name) > CONTACT_LIMITS["name"] or "\n" in name or "\r" in name:
        errors["name"] = "Name is too long or invalid."
    if not email or not EMAIL_RE.match(email):
        errors["email"] = "Please enter a valid email address."
    elif len(email) > CONTACT_LIMITS["email"]:
        errors["email"] = "Email is too long."
    if project_type not in VALID_PROJECT_TYPES:
        errors["project_type"] = "Please choose a project type."
    if len(budget) > CONTACT_LIMITS["budget"]:
        errors["budget"] = "Budget is too long."
    if not message or len(message) < 10:
        errors["message"] = "Please add a few details about your project."
    elif len(message) > MAX_MESSAGE_LENGTH:
        errors["message"] = f"Message is too long (max {MAX_MESSAGE_LENGTH} characters)."

    if errors:
        return jsonify({"error": "Please fix the highlighted fields.", "fields": errors}), 400

    submission = Contact(
        name=name,
        email=email,
        project_type=project_type,
        budget=budget or None,
        message=message,
    )
    db.session.add(submission)
    db.session.commit()

    try:
        _send_notification_email(submission)
        _send_autoreply(submission)
    except Exception:
        current_app.logger.warning("Contact email delivery failed")
        # The submission is already saved — don't fail the request over email.

    return jsonify({"ok": True, "message": "Thanks — your message is on its way."})
