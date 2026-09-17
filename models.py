"""SQLAlchemy models."""
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utcnow():
    """Naive UTC for SQLite compatibility without deprecated utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Contact(db.Model):
    __tablename__ = "contacts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(200), nullable=False)
    project_type = db.Column(db.String(50), nullable=False)
    budget = db.Column(db.String(80), nullable=True)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "project_type": self.project_type,
            "budget": self.budget,
            "message": self.message,
            "created_at": self.created_at.isoformat(),
        }


class ChatMessage(db.Model):
    """Rolling per-session chat history for the assistant widget."""
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(64), nullable=False, index=True)
    role = db.Column(db.String(16), nullable=False)  # "user" | "assistant"
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
