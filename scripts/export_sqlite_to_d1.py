"""Create an ignored, idempotent D1 import file from a read-only SQLite DB."""
import argparse
from hashlib import sha256
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "instance" / "portfolio.db"
DEFAULT_OUTPUT = ROOT / "migration-private" / "sqlite-import.sql"


def sql(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''").replace("\x00", "") + "'"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--include-chat", action="store_true", help="Chat rows are excluded by default because they are usually test/session data.")
    args = parser.parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    private_root = (ROOT / "migration-private").resolve()
    if private_root not in output.parents:
        raise SystemExit("Output must stay under ignored migration-private/")
    if not source.is_file():
        raise SystemExit(f"SQLite source not found: {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    digest = sha256(source.read_bytes()).hexdigest()
    connection = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    contacts = connection.execute("SELECT id,name,email,project_type,budget,message,created_at FROM contacts ORDER BY id").fetchall()
    chats = connection.execute("SELECT id,session_id,role,content,created_at FROM chat_messages ORDER BY id").fetchall() if args.include_chat else []
    lines = [
        "-- PRIVATE D1 IMPORT: contains user data; never commit this file.",
        "-- Generated read-only from SQLite; safe to rerun because source keys are unique.",
        f"INSERT OR IGNORE INTO migration_runs(id) VALUES ({sql('sqlite-' + digest)});",
    ]
    for row in contacts:
        source_key = "sqlite-contact-" + sha256((digest + ":" + str(row["id"])).encode()).hexdigest()
        values = [row[x] for x in ["name", "email", "project_type", "budget", "message", "created_at"]] + [source_key]
        lines.append("INSERT OR IGNORE INTO contacts(name,email,project_type,budget,message,created_at,request_id) VALUES(" + ",".join(map(sql, values)) + ");")
    for row in chats:
        source_key = "sqlite-chat-" + sha256((digest + ":" + str(row["id"])).encode()).hexdigest()
        values = [row[x] for x in ["session_id", "role", "content", "created_at"]] + [source_key]
        lines.append("INSERT OR IGNORE INTO chat_messages(session_id,role,content,created_at,source_key) VALUES(" + ",".join(map(sql, values)) + ");")
    output.write_text("\n".join(lines) + "\n", encoding="utf8")
    print(f"Wrote {len(contacts)} contacts and {len(chats)} chat messages to ignored {output.relative_to(ROOT)}")
    if not args.include_chat:
        print("Chat excluded. Review classification before rerunning with --include-chat.")


if __name__ == "__main__":
    main()
