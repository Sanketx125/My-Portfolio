"""Chat blueprint — POST /api/chat

Provider-agnostic: works with any OpenAI-compatible chat-completions
endpoint (OpenCode Zen, OpenAI, OpenRouter, Groq, a self-hosted model...)
selected purely via LLM_API_BASE / LLM_API_KEY / LLM_MODEL env vars.
"""
import re
import uuid
import requests
from flask import Blueprint, request, jsonify, current_app

from extensions import limiter
from models import db, ChatMessage
from content import CONTENT

chat_bp = Blueprint("chat", __name__, url_prefix="/api")

MAX_MESSAGE_LENGTH = 800
HISTORY_TURNS = 10  # last N user+assistant turns kept per session
VALID_MODES = {"default", "recruiter"}
PITCH_SENTINEL = "__pitch__"


from services.prompts import _system_prompt


def _get_or_create_session_id(payload: dict) -> str:
    session_id = (payload or {}).get("session_id", "")
    if not session_id or not re.match(r"^[a-zA-Z0-9_-]{1,64}$", session_id):
        session_id = uuid.uuid4().hex
    return session_id


def _load_history(session_id: str):
    rows = (
        ChatMessage.query.filter_by(session_id=session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_TURNS * 2)
        .all()
    )
    rows.reverse()
    return [{"role": r.role, "content": r.content} for r in rows]


def _call_llm(messages):
    cfg = current_app.config
    url = cfg["LLM_API_BASE"].rstrip("/") + "/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg['LLM_API_KEY']}",
    }
    body = {
        "model": cfg["LLM_MODEL"],
        "messages": messages,
        "max_tokens": 500,
        "temperature": 0.5,
    }
    resp = requests.post(
        url, headers=headers, json=body, timeout=cfg["LLM_TIMEOUT_SECONDS"]
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


@chat_bp.route("/chat", methods=["POST"])
@limiter.limit("10 per minute")
def chat():
    payload = request.get_json(silent=True) or {}

    mode = (payload.get("mode") or "default").strip().lower()
    if mode not in VALID_MODES:
        mode = "default"

    message = (payload.get("message") or "").strip()
    role_hint = (payload.get("role") or "").strip()[:80]

    # One-click "pitch me" requests: the client sends the sentinel (optionally
    # followed by a target role), or just an empty message in recruiter mode.
    # Expand it into a concrete instruction here so the UI stays dumb.
    if message.startswith(PITCH_SENTINEL) or (mode == "recruiter" and not message):
        target = message.replace(PITCH_SENTINEL, "").strip() or role_hint
        message = (
            f"Give me a confident 60-second pitch for {CONTENT['name']}"
            + (f" for a {target} role" if target else " as a candidate")
            + ". Lead with fit, back it with concrete evidence, and close with "
            "why a team should hire them."
        )

    if not message:
        return jsonify({"error": "Message can't be empty."}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify(
            {"error": f"Message is too long (max {MAX_MESSAGE_LENGTH} characters)."}
        ), 400

    session_id = _get_or_create_session_id(payload)

    if not current_app.config.get("LLM_API_KEY"):
        return jsonify(
            {
                "error": "The AI assistant isn't configured yet. Please use the "
                "contact form below instead.",
                "session_id": session_id,
            }
        ), 503

    history = _load_history(session_id)
    messages = [{"role": "system", "content": _system_prompt(mode)}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    try:
        reply = _call_llm(messages)
    except requests.exceptions.Timeout:
        return jsonify(
            {
                "error": "That took too long to answer. Try again, or use the "
                "contact form below.",
                "session_id": session_id,
            }
        ), 504
    except Exception:
        current_app.logger.exception("LLM call failed")
        return jsonify(
            {
                "error": "Something went wrong reaching the assistant. Try "
                "again, or use the contact form below.",
                "session_id": session_id,
            }
        ), 502

    db.session.add(ChatMessage(session_id=session_id, role="user", content=message))
    db.session.add(ChatMessage(session_id=session_id, role="assistant", content=reply))
    db.session.commit()

    # Trim old history beyond the window for this session
    excess = (
        ChatMessage.query.filter_by(session_id=session_id)
        .order_by(ChatMessage.created_at.desc())
        .offset(HISTORY_TURNS * 2)
        .all()
    )
    for row in excess:
        db.session.delete(row)
    db.session.commit()

    return jsonify({"reply": reply, "session_id": session_id})
