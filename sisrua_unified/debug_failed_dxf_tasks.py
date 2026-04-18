#!/usr/bin/env python3
import os
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2
from psycopg2.extras import RealDictCursor


def load_env() -> None:
    env_file = Path(".env")
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()


def connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL nao definido")

    parsed = urlparse(database_url)
    password = unquote(parsed.password) if parsed.password else None
    return psycopg2.connect(
        database=parsed.path[1:],
        user=parsed.username,
        password=password,
        host=parsed.hostname,
        port=parsed.port or 5432,
        sslmode="require",
    )


def main() -> None:
    load_env()
    conn = connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'dxf_tasks'
        """
    )
    cols = {r["column_name"] for r in cur.fetchall()}
    error_col = "error_message" if "error_message" in cols else "error" if "error" in cols else None
    progress_col = "progress" if "progress" in cols else None

    print("=== FAILED DXF TASKS SUMMARY ===")
    cur.execute(
        """
        SELECT
          count(*) AS total_failed,
          min(created_at) AS first_failed_at,
          max(updated_at) AS last_failed_updated_at
        FROM public.dxf_tasks
        WHERE status = 'failed'
        """
    )
    row = cur.fetchone()
    print(f"total_failed={row['total_failed']}")
    print(f"first_failed_at={row['first_failed_at']}")
    print(f"last_failed_updated_at={row['last_failed_updated_at']}")

    if error_col:
        print("\n=== FAILED BY ERROR MESSAGE (TOP 10) ===")
        cur.execute(
            f"""
            SELECT
              COALESCE({error_col}, '<null>') AS error_message,
              count(*) AS qty,
              min(created_at) AS first_seen,
              max(updated_at) AS last_seen
            FROM public.dxf_tasks
            WHERE status = 'failed'
            GROUP BY COALESCE({error_col}, '<null>')
            ORDER BY qty DESC, last_seen DESC
            LIMIT 10
            """
        )
        for r in cur.fetchall():
            msg = str(r["error_message"]).replace("\n", " ")
            if len(msg) > 180:
                msg = msg[:177] + "..."
            print(f"qty={r['qty']:<3} first={r['first_seen']} last={r['last_seen']} msg={msg}")
    else:
        print("\n=== FAILED BY ERROR MESSAGE (TOP 10) ===")
        print("Sem coluna de erro (nem error_message nem error) em dxf_tasks")

    print("\n=== MOST RECENT FAILED TASKS (TOP 10) ===")
    select_progress = progress_col if progress_col else "NULL::integer"
    select_error = f"LEFT(COALESCE({error_col}, '<null>'), 220)" if error_col else "'<no-error-column>'"
    cur.execute(
        f"""
        SELECT
            task_id,
            status,
            {select_progress} AS progress,
            created_at,
            updated_at,
            {select_error} AS error_message
        FROM public.dxf_tasks
        WHERE status = 'failed'
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 10
        """
    )
    for r in cur.fetchall():
        print(
            f"task_id={r['task_id']} created={r['created_at']} updated={r['updated_at']} "
            f"progress={r['progress']} msg={r['error_message']}"
        )

    # Check possible relationship with recent core changes.
    print("\n=== FAILED TASKS IN LAST 7 DAYS ===")
    cur.execute(
        """
        SELECT count(*) AS failed_last_7d
        FROM public.dxf_tasks
        WHERE status = 'failed'
          AND COALESCE(updated_at, created_at) >= now() - interval '7 days'
        """
    )
    print(f"failed_last_7d={cur.fetchone()['failed_last_7d']}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
