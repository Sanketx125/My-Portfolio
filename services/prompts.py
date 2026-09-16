"""Pure portfolio prompts shared with the production build."""
from content import CONTENT

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


