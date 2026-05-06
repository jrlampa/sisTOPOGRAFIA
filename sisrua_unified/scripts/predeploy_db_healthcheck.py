#!/usr/bin/env python3
"""Pre-deploy database healthcheck gate.

Fail-fast checks:
1) Static migration anti-regression scan (audit_db_migrations.py)
2) Database connectivity
3) Migration drift against public._migrations
4) Critical function presence
5) Dangerous anon/authenticated DML grants
6) Critical RLS enablement
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import psycopg2


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "migrations"


def load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def fail(message: str) -> None:
    print(f"❌ {message}")
    raise SystemExit(1)


def run_static_audit() -> None:
    print("[1/6] Static migration audit")
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "audit_db_migrations.py")],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
    )
    if result.stdout:
        print(result.stdout.strip())
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr.strip())
        fail("Static migration audit failed")
    print("✅ Static migration audit passed")


def get_database_url() -> str:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        fail("DATABASE_URL not found (env or .env)")
    return database_url


def get_local_migrations() -> set[str]:
    return {p.name for p in MIGRATIONS_DIR.glob("*.sql")}


def get_applied_migrations(cur: "psycopg2.extensions.cursor") -> set[str]:
    cur.execute("SELECT to_regclass('public._migrations')")
    if cur.fetchone()[0] is None:
        fail("Table public._migrations does not exist")
    cur.execute("SELECT filename FROM public._migrations")
    return {row[0] for row in cur.fetchall()}


def check_migration_drift(cur: "psycopg2.extensions.cursor") -> None:
    print("[3/6] Migration drift check")
    local = get_local_migrations()
    applied = get_applied_migrations(cur)

    pending = sorted(local - applied)
    extra = sorted(applied - local)

    if pending:
        fail(f"Pending migrations detected: {pending[:10]}")
    if extra:
        fail(f"Extra/applied-only migrations detected: {extra[:10]}")

    print(f"✅ Drift check passed ({len(local)} local, {len(applied)} applied)")


def check_critical_functions(cur: "psycopg2.extensions.cursor") -> None:
    print("[4/6] Critical functions check")
    required = {
        ("private", "verify_backup_integrity"),
        ("public", "current_tenant_id"),
        ("public", "find_or_claim_job"),
    }
    cur.execute(
        """
        SELECT n.nspname, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE (n.nspname, p.proname) IN ((%s,%s),(%s,%s),(%s,%s))
        """,
        (
            "private",
            "verify_backup_integrity",
            "public",
            "current_tenant_id",
            "public",
            "find_or_claim_job",
        ),
    )
    found = {(row[0], row[1]) for row in cur.fetchall()}
    missing = sorted(required - found)
    if missing:
        fail(f"Missing critical function(s): {missing}")
    print("✅ Critical functions present")


def check_dangerous_grants(cur: "psycopg2.extensions.cursor") -> None:
    print("[5/6] Grant hardening check")
    cur.execute(
        """
        SELECT table_schema, table_name, grantee, privilege_type
        FROM information_schema.table_privileges
        WHERE table_schema = 'public'
          AND grantee IN ('anon', 'authenticated')
          AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
        ORDER BY table_name, grantee, privilege_type
        """
    )
    violations = cur.fetchall()
    if violations:
        sample = [f"{r[1]}:{r[2]}:{r[3]}" for r in violations[:12]]
        fail(f"Dangerous DML grants found for anon/authenticated: {sample}")
    print("✅ No dangerous anon/authenticated DML grants")


def check_critical_rls(cur: "psycopg2.extensions.cursor") -> None:
    print("[6/6] Critical RLS check")
    critical_tables = [
        "jobs",
        "dxf_tasks",
        "bt_export_history",
        "audit_logs",
        "constants_catalog",
        "user_roles",
        "tenants",
    ]
    cur.execute(
        """
        SELECT c.relname, c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = ANY(%s)
        ORDER BY c.relname
        """,
        (critical_tables,),
    )
    rows = cur.fetchall()
    found = {r[0] for r in rows}
    missing_tables = sorted(set(critical_tables) - found)
    if missing_tables:
        fail(f"Critical table(s) missing: {missing_tables}")

    no_rls = sorted([name for name, enabled in rows if not enabled])
    if no_rls:
        fail(f"Critical table(s) with RLS disabled: {no_rls}")
    print("✅ Critical RLS enabled")


def main() -> int:
    print("=== Pre-deploy DB healthcheck ===")
    run_static_audit()

    database_url = get_database_url()
    print("[2/6] Database connectivity check")
    try:
        conn = psycopg2.connect(database_url)
    except Exception as exc:
        fail(f"Unable to connect to database: {exc}")

    try:
        conn.autocommit = False
        cur = conn.cursor()
        cur.execute("SELECT 1")
        print("✅ Database connection OK")

        check_migration_drift(cur)
        check_critical_functions(cur)
        check_dangerous_grants(cur)
        check_critical_rls(cur)
    finally:
        conn.close()

    print("✅ Pre-deploy DB healthcheck PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
