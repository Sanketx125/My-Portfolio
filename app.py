"""Flask app factory."""
import os
from flask import Flask

from config import Config
from models import db
from extensions import limiter


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

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

    @app.after_request
    def set_cors_headers(response):
        origin = app.config.get("ALLOWED_ORIGIN", "*")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        if origin and origin != "*":
            response.headers["Access-Control-Allow-Origin"] = origin
        return response

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=app.config["DEBUG"])
