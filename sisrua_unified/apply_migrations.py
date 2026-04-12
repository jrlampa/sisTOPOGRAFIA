#!/usr/bin/env python3
"""
Apply all Supabase migrations to the database with state tracking.

Tracking table: public._migrations
  - Records every successfully applied migration file by name.
  - Skipped on re-runs → migrations are never executed twice.

Bootstrap behaviour (legacy state):
  - If _migrations is empty AND bt_export_history already exists (migrations
    001-010 were applied before tracking was introduced), the table is seeded
    with all current migration filenames so future runs skip them cleanly.

Exit codes:
  0 — success (all pending migrations applied or nothing to do)
  1 — fatal error (migration failed or DB connection error)
"""
import os
import sys
import psycopg2
from pathlib import Path

# ── Load .env ────────────────────────────────────────────────────────────────
env_file = Path(".env")
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("ERROR: DATABASE_URL not found in environment or .env file", file=sys.stderr)
    sys.exit(1)

# ── Helpers ───────────────────────────────────────────────────────────────────


def ensure_tracking_table(cur: "psycopg2.cursor") -> None:
    """Create _migrations tracking table if it does not exist."""
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS _migrations (
            filename   TEXT        PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """
    )


def get_applied(cur: "psycopg2.cursor") -> set[str]:
    """Return the set of already-applied migration filenames."""
    cur.execute("SELECT filename FROM _migrations ORDER BY filename")
    return {row[0] for row in cur.fetchall()}


def legacy_tables_exist(cur: "psycopg2.cursor") -> bool:
    """Return True when migrations 001-010 were applied before tracking existed."""
    cur.execute(
        """
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'bt_export_history'
    """
    )
    return cur.fetchone() is not None


def seed_legacy_state(cur: "psycopg2.cursor", migration_files: list[Path]) -> None:
    """
    Register all current migration files as already applied without executing
    them.  Used once to bootstrap the tracking table when migrating from the
    legacy (untracked) workflow.
    """
    for f in migration_files:
        cur.execute(
            "INSERT INTO _migrations (filename) VALUES (%s) ON CONFLICT DO NOTHING",
            (f.name,),
        )
    print(
        f"  ℹ️  Legacy bootstrap: registered {len(migration_files)} migration(s) "
        "as already applied (they were applied before state tracking existed)."
    )


# ── Main ──────────────────────────────────────────────────────────────────────

try:
    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # 1. Ensure tracking table exists
    ensure_tracking_table(cur)
    conn.commit()

    # 2. Discover migration files
    migration_files = sorted(Path("migrations").glob("*.sql"))
    print(f"Found {len(migration_files)} migration file(s) in migrations/\n")

    # 3. Bootstrap legacy state (one-time, runs only when tracking table is empty)
    applied = get_applied(cur)
    if not applied and legacy_tables_exist(cur):
        print("Detected legacy untracked database. Seeding tracking table...")
        seed_legacy_state(cur, migration_files)
        conn.commit()
        applied = get_applied(cur)

    # 4. Apply pending migrations
    pending = [f for f in migration_files if f.name not in applied]
    skipped = len(migration_files) - len(pending)

    if skipped:
        print(f"Skipping {skipped} already-applied migration(s).\n")

    if not pending:
        print("✅ Database is up to date — no pending migrations.")
    else:
        print(f"Applying {len(pending)} pending migration(s)...\n")

    for migration_file in pending:
        sql = migration_file.read_text(encoding="utf-8")
        print(f"  → Applying: {migration_file.name} ...")
        try:
            cur.execute(sql)
            cur.execute(
                "INSERT INTO _migrations (filename) VALUES (%s)",
                (migration_file.name,),
            )
            conn.commit()
            print(f"  ✅ {migration_file.name} applied and recorded.\n")
        except Exception as exc:
            conn.rollback()
            print(
                f"\n  ❌ FAILED: {migration_file.name}\n" f"     {exc}\n",
                file=sys.stderr,
            )
            print(
                "Aborting: fix the migration above before re-running.",
                file=sys.stderr,
            )
            cur.close()
            conn.close()
            sys.exit(1)

    # 5. Final summary
    print("\nDatabase tables in public schema:")
    cur.execute(
        """
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
    """
    )
    for (table_name,) in cur.fetchall():
        print(f"  ✓ {table_name}")

    cur.execute("SELECT COUNT(*) FROM _migrations")
    total_tracked = cur.fetchone()[0]
    print(f"\n✅ Done. {total_tracked} migration(s) tracked in _migrations.")

    cur.close()
    conn.close()

except Exception as exc:
    print(f"ERROR: {exc}", file=sys.stderr)
    sys.exit(1)
