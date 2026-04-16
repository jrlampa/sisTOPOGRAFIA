#!/usr/bin/env python3
import os
import re
from pathlib import Path
import psycopg2

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
cur = conn.cursor()

print("Colunas de constants_catalog:")
cur.execute("""
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'constants_catalog'
ORDER BY ordinal_position
""")
for col, dtype in cur.fetchall():
    print(f"  {col:<25} {dtype}")

cur.close()
conn.close()
