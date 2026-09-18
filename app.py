"""Flask app factory."""
import os
from flask import Flask, jsonify, request

from config import Config
from models import db
from extensions import limiter


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("FLASK_SECRET_KEY is required outside development")
    if app.config.get("ENV") != "development" and len(app.config["SECRET_KEY"]) < 32:
        raise RuntimeError("FLASK_SECRET_KEY must contain at least 32 characters")

    db.init_app(app)
    limiter.init_app(app)

    from blueprints.main import main_bp
    from blueprints.chat import chat_bp
    from blueprints.contact import contact_bp
    from blueprints.github import github_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(contact_bp)
    app.register_blueprint(github_bp)

    with app.app_context():
        db.create_all()

    @app.before_request
    def protect_write_origins():
        if request.method != "POST" or request.path not in {"/api/chat", "/api/contact"}:
            return None
        if app.config.get("ENV") == "development":
            return None
        expected = app.config.get("ALLOWED_ORIGIN")
        origin = request.headers.get("Origin")
        if not expected or expected == "*" or origin != expected or request.headers.get("Sec-Fetch-Site") == "cross-site":
            return jsonify({"error": "Request origin is not allowed."}), 403
        return None

    @app.after_request
    def set_security_headers(response):
        allowed = app.config.get("ALLOWED_ORIGIN", "*")
        origin = request.headers.get("Origin")
        is_resume_pdf = request.path.endswith("/static/files/resume.pdf")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = (
            "SAMEORIGIN" if is_resume_pdf else "DENY"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        site_csp = (
            "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; "
            "form-action 'self'; script-src 'self' 'unsafe-inline' "
            "https://cdnjs.cloudflare.com https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; "
            "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: "
            "https://tile.openstreetmap.org https://avatars.githubusercontent.com; "
            "connect-src 'self'; object-src 'self'"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; frame-ancestors 'self'" if is_resume_pdf else site_csp
        )
        if app.config.get("ENV") != "development":
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        if allowed != "*" and origin == allowed:
            response.headers["Access-Control-Allow-Origin"] = allowed
            response.headers.add("Vary", "Origin")
        return response

    @app.errorhandler(413)
    @app.errorhandler(429)
    def api_request_error(error):
        if request.path.startswith("/api/"):
            message = "Request too large." if error.code == 413 else "Too many requests. Please wait."
            return jsonify({"error": message}), error.code
        return error

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=app.config["DEBUG"])
