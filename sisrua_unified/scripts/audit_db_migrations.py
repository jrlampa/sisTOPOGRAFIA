#!/usr/bin/env python3
"""Static guardrails for database migrations.

This check is intentionally lightweight: it scans SQL migrations for a small
set of known breakage patterns that have already caused replay/runtime issues
in this repository.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "migrations"


@dataclass(frozen=True)
class Rule:
    code: str
    description: str
    pattern: Any


RULES = [
    Rule(
        code="DB001",
        description="Partial-index ON CONFLICT target is not replay-safe in this codebase.",
        pattern=re.compile(r"ON\s+CONFLICT\s*\(idempotency_key\)\s+WHERE", re.IGNORECASE),
    ),
    Rule(
        code="DB002",
        description="Legacy wrapper must call private.verify_backup_integrity(), not public.check_backup_integrity().",
        pattern=re.compile(r"public\.check_backup_integrity\s*\(", re.IGNORECASE),
    ),
    Rule(
        code="DB003",
        description="user_roles snapshot must not reference non-existent id column.",
        pattern=re.compile(
            r"INSERT\s+INTO\s+backup\.user_roles_snapshot\s*\([^\)]*\bid\s*,\s*user_id",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    Rule(
        code="DB004",
        description="bt_export_history did not have user_id in early migrations.",
        pattern=re.compile(
            r"CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_bt_history_user_date\s+ON\s+public\.bt_export_history\s*\(user_id",
            re.IGNORECASE,
        ),
    ),
    Rule(
        code="DB005",
        description="Jobs idempotency logic must treat cancelled as retryable terminal state.",
        pattern=re.compile(r"status\s+NOT\s+IN\s*\('failed'\)", re.IGNORECASE),
    ),
]


def iter_migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def main() -> int:
    failures: list[tuple[str, str, str]] = []

    for path in iter_migration_files():
        content = path.read_text(encoding="utf-8")
        for rule in RULES:
            if rule.pattern.search(content):
                failures.append((rule.code, path.name, rule.description))

    if failures:
        print("Database migration audit FAILED")
        for code, filename, description in failures:
            print(f"- {code} {filename}: {description}")
        return 1

    print(f"Database migration audit passed for {len(iter_migration_files())} migration(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())