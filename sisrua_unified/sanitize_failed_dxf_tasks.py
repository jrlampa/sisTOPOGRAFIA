#!/usr/bin/env python3
"""
Safe operational sanitation for failed dxf_tasks.

Default mode is dry-run (no DB changes).
Use --apply to execute updates.

Actions:
- missing_input: mark task as cancelled
- python_runtime (with valid lat/lon/radius): requeue task safely
- other/not_reprocessable: keep as-is
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse, unquote

import psycopg2
from psycopg2.extras import RealDictCursor


CLASS_MISSING_INPUT = "missing_input"
CLASS_PYTHON_RUNTIME = "python_runtime"
CLASS_NOT_REPROCESSABLE = "not_reprocessable"
CLASS_OTHER = "other"


def load_env() -> None:
    env_file = Path(".env")
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


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


def to_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def is_core_input_valid(payload: Dict[str, Any] | None) -> bool:
    if not isinstance(payload, dict):
        return False

    lat = to_number(payload.get("lat"))
    lon = to_number(payload.get("lon"))
    radius = to_number(payload.get("radius"))

    if lat is None or lon is None or radius is None:
        return False
    if lat < -90 or lat > 90:
        return False
    if lon < -180 or lon > 180:
        return False
    if radius < 10 or radius > 5000:
        return False
    return True


def classify_failed_task(error: str | None, payload: Dict[str, Any] | None) -> str:
    e = (error or "").lower()
    valid = is_core_input_valid(payload)

    if (
        (not valid)
        or "missing required parameters" in e
        or "invalid dxf input fields" in e
        or "invalid queued payload fields" in e
        or "lat=undefined" in e
        or "lon=undefined" in e
        or "radius=undefined" in e
    ):
        return CLASS_MISSING_INPUT

    if (
        "python script" in e
        or "failed to spawn python" in e
        or "python worker" in e
        or "module not found" in e
        or "no module named" in e
    ):
        return CLASS_PYTHON_RUNTIME if valid else CLASS_NOT_REPROCESSABLE

    return CLASS_OTHER


def get_source(payload: Dict[str, Any] | None) -> Tuple[str, str | None]:
    if not isinstance(payload, dict):
        return ("unknown_source", None)

    request_meta = payload.get("requestMeta")
    if not isinstance(request_meta, dict):
        return ("unknown_source", None)

    source = request_meta.get("source") or request_meta.get("endpoint") or "unknown_source"
    request_id = request_meta.get("requestId")
    return (str(source), str(request_id) if request_id else None)


def fetch_failed(cur: RealDictCursor, limit: int) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT task_id, status, attempts, error, payload, created_at, updated_at
        FROM public.dxf_tasks
        WHERE status = 'failed'
        ORDER BY updated_at DESC
        LIMIT %s
        """,
        [limit],
    )
    return list(cur.fetchall())


def apply_cancel(cur: RealDictCursor, task_id: str) -> bool:
    cur.execute(
        """
        UPDATE public.dxf_tasks
           SET status = 'cancelled',
               error = COALESCE(error, 'Sanitized by script: missing_input') || ' | sanitized=missing_input',
               finished_at = NOW(),
               updated_at = NOW()
         WHERE task_id = %s
           AND status = 'failed'
         RETURNING task_id
        """,
        [task_id],
    )
    return cur.fetchone() is not None


def apply_requeue(cur: RealDictCursor, task_id: str) -> bool:
    cur.execute(
        """
        UPDATE public.dxf_tasks
           SET status = 'queued',
               attempts = 0,
               error = NULL,
               started_at = NULL,
               finished_at = NULL,
               updated_at = NOW()
         WHERE task_id = %s
           AND status = 'failed'
         RETURNING task_id
        """,
        [task_id],
    )
    return cur.fetchone() is not None


def main() -> None:
    parser = argparse.ArgumentParser(description="Sanitize and reprocess failed dxf_tasks safely")
    parser.add_argument("--limit", type=int, default=200, help="Max failed rows to inspect (default: 200)")
    parser.add_argument("--apply", action="store_true", help="Apply updates (default is dry-run)")
    args = parser.parse_args()

    load_env()
    conn = connect()
    conn.autocommit = False

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        rows = fetch_failed(cur, max(1, min(args.limit, 500)))

        by_class = {
            CLASS_MISSING_INPUT: 0,
            CLASS_PYTHON_RUNTIME: 0,
            CLASS_NOT_REPROCESSABLE: 0,
            CLASS_OTHER: 0,
        }
        by_source: Dict[str, int] = {}

        plan: List[Dict[str, Any]] = []
        for row in rows:
            payload = row.get("payload")
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except json.JSONDecodeError:
                    payload = None

            classification = classify_failed_task(row.get("error"), payload)
            source, request_id = get_source(payload)
            by_class[classification] += 1
            by_source[source] = by_source.get(source, 0) + 1

            action = "skip"
            if classification == CLASS_MISSING_INPUT:
                action = "cancel"
            elif classification == CLASS_PYTHON_RUNTIME:
                action = "requeue"

            plan.append(
                {
                    "task_id": row.get("task_id"),
                    "classification": classification,
                    "action": action,
                    "source": source,
                    "request_id": request_id,
                    "error": row.get("error"),
                }
            )

        print("=== FAILED DXF SANITATION PREVIEW ===")
        print(f"analyzed={len(plan)}")
        print(f"by_class={json.dumps(by_class, ensure_ascii=True)}")
        print(f"by_source={json.dumps(by_source, ensure_ascii=True)}")

        for item in plan[:30]:
            err = str(item.get("error") or "")
            err = err.replace("\n", " ")
            if len(err) > 180:
                err = err[:177] + "..."
            print(
                f"task_id={item['task_id']} class={item['classification']} action={item['action']} "
                f"source={item['source']} request_id={item['request_id']} error={err}"
            )

        if not args.apply:
            print("\nDry-run mode: no changes applied. Use --apply to execute updates.")
            conn.rollback()
            return

        cancelled = 0
        requeued = 0
        skipped = 0

        for item in plan:
            task_id = str(item["task_id"])
            action = item["action"]
            if action == "cancel":
                if apply_cancel(cur, task_id):
                    cancelled += 1
                else:
                    skipped += 1
            elif action == "requeue":
                if apply_requeue(cur, task_id):
                    requeued += 1
                else:
                    skipped += 1
            else:
                skipped += 1

        conn.commit()
        print("\n=== SANITATION APPLIED ===")
        print(f"cancelled={cancelled} requeued={requeued} skipped={skipped}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
