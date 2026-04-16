#!/usr/bin/env python3
"""Verificar quais migrations foram aplicadas."""

import os
import re
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

env_path = Path('.env')
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()


def _sanitize_database_url(raw_database_url: str | None) -> str | None:
    if not raw_database_url:
        return raw_database_url
    # Corrige '%' cru (não seguido de 2 hex) para evitar erro de parse em URLs.
    return re.sub(r'%(?![0-9A-Fa-f]{2})', '%25', raw_database_url)


database_url = _sanitize_database_url(os.getenv('DATABASE_URL'))
if not database_url:
    raise RuntimeError(
        'DATABASE_URL não definido. Configure no ambiente ou em .env'
    )

conn = psycopg2.connect(database_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 80)
print("MIGRATIONS JÁ APLICADAS (todas)")
print("=" * 80)
cur.execute(
    "SELECT filename, applied_at FROM public._migrations ORDER BY applied_at"
)
migrations = cur.fetchall()
for m in migrations:
    print(f"  {m['filename']:<50} {m['applied_at']}")

print("\n" + "=" * 80)
print("STATUS: MIGRATIONS 019-033")
print("=" * 80)
required = {
    '019_audit_soft_delete_indices.sql',
    '020_user_roles_rbac.sql',
    '021_audit_soft_delete_business_tables.sql',
    '022_database_backup_restore.sql',
    '023_advanced_performance_indexes.sql',
    '024_db_maintenance_schedule.sql',
}
applied = {m['filename'] for m in migrations}
missing = required - applied

if missing:
    print("\n❌ FALTAM aplicar:")
    for m in sorted(missing):
        print(f"    • {m}")
else:
    print("\n✅ Todas as migrations 019-024 foram aplicadas!")

cur.close()
conn.close()
