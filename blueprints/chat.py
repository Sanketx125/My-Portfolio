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


def _build_facts_block(content: dict) -> str:
    """Serialize content.py into a compact facts block for the system prompt."""
    lines = []

    lines.append(f"Name: {content['name']}")
    lines.append(f"Title: {content['title']}")
    lines.append(f"Location: {content['location']}")
    if content.get("availability"):
        lines.append(f"Availability: {content['availability']}")
    lines.append(f"Tagline: {content['tagline']}")
    lines.append("")
    lines.append(f"About: {content['about']}")
    lines.append("")

    if content.get("stats"):
        lines.append("Headline numbers:")
        for stat in content["stats"]:
            lines.append(f"  - {stat['number']} {stat['label']}")
        lines.append("")

    lines.append("Skills:")
    for group, items in content["skills"].items():
        lines.append(f"  - {group.replace('_', '/').upper()}: {', '.join(items)}")
    lines.append("")

    lines.append("Experience:")
    for job in content["experience"]:
        lines.append(f"  - {job['role']} at {job['company']} ({job['dates']})")
        for bullet in job["bullets"]:
            lines.append(f"      * {bullet}")
    lines.append("")

    lines.append("Projects:")
    for proj in content["projects"]:
        lines.append(
            f"  - {proj['title']} [{proj['category']}]: {proj['description']} "
            f"Stack: {', '.join(proj['stack'])}."
        )
    lines.append("")

    lines.append("Education:")
    for edu in content["education"]:
        lines.append(
            f"  - {edu['degree']}, {edu['school']} ({edu['dates']}) {edu.get('detail', '')}"
        )
    lines.append("")

    highlights = (content.get("resume") or {}).get("highlights") or []
    if highlights:
        lines.append("Résumé highlights:")
        for item in highlights:
            lines.append(f"  - {item}")
        lines.append("")

    lines.append(f"Contact email: {content['email']}")
    lines.append(f"GitHub: {content['socials'].get('github', '')}")
    lines.append(f"LinkedIn: {content['socials'].get('linkedin', '')}")

    return "\n".join(lines)


def _system_prompt(mode: str = "default") -> str:
    name = CONTENT["name"]
    facts = _build_facts_block(CONTENT)

    if mode == "recruiter":
        persona = (
            f"You are {name}'s AI advocate on their portfolio, in RECRUITER MODE. "
            f"You are speaking to a hiring manager, recruiter, or technical "
            f"interviewer who is evaluating {name} for a role.\n"
            f"Your job is to make a confident, structured, evidence-based case "
            f"for hiring them.\n\n"
            f"Structure every answer like this:\n"
            f"  1. A one-line positioning statement (who {name} is, in one sentence).\n"
            f"  2. Two or three concrete pieces of evidence drawn ONLY from the "
            f"facts below — projects, metrics, awards, stack, years of experience.\n"
            f"  3. A closing line on the value {name} brings to that kind of team.\n\n"
            f"Be confident and specific, but never exaggerate, and never invent "
            f"employers, metrics, or skills that aren't below. If asked about a "
            f"stack or role that isn't in the facts, name the closest adjacent "
            f"strength instead of bluffing. Prefer short paragraphs or a tight "
            f"bullet list over long prose. Finish by inviting the reader to use "
            f"the Contact form on this page.\n"
        )
    else:
        persona = (
            f"You are {name}'s AI assistant, embedded on their portfolio site.\n"
            f"Answer questions about {name}'s background, skills, experience, and "
            f"projects using ONLY the facts below. Be warm, concise, and "
            f"professional. Keep replies to a few sentences unless more detail "
            f"is clearly needed.\n"
            f"If asked something outside this scope, say so briefly and steer "
            f"back to {name}'s work.\n"
            f"If someone describes a project idea or wants to work together, "
            f"point them to the Contact form on this page — don't negotiate "
            f"scope or price yourself.\n"
            f"Never invent experience, employers, or metrics that aren't listed "
            f"below.\n"
        )

    return f"{persona}\n--- FACTS ---\n{facts}"


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
