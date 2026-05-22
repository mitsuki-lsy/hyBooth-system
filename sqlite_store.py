import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


def connect(db_path):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_state (
            state_key TEXT PRIMARY KEY,
            state_value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY,
            file_name TEXT,
            mime_type TEXT,
            size INTEGER,
            storage_name TEXT,
            category TEXT,
            uploaded_by INTEGER,
            order_id INTEGER,
            company_id INTEGER,
            created_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            user_name TEXT,
            action TEXT,
            detail TEXT,
            target_type TEXT,
            target_id TEXT,
            created_at TEXT
        )
        """
    )
    return conn


def main():
    if len(sys.argv) < 3:
        print("usage: sqlite_store.py <db_path> <read|write>", file=sys.stderr)
        sys.exit(2)

    db_path = sys.argv[1]
    command = sys.argv[2]
    conn = connect(db_path)

    if command == "read":
        row = conn.execute(
            "SELECT state_value FROM app_state WHERE state_key = ?", ("main",)
        ).fetchone()
        print(row[0] if row else "")
        return

    if command == "write":
        payload = sys.stdin.read()
        payload = payload.encode("utf-8", "replace").decode("utf-8", "replace")
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO app_state (state_key, state_value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(state_key) DO UPDATE SET
              state_value = excluded.state_value,
              updated_at = excluded.updated_at
            """,
            ("main", payload, now),
        )
        conn.commit()
        print("ok")
        return

    print(f"unknown command: {command}", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
