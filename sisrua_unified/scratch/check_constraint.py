
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
    return re.sub(r'%(?![0-9A-Fa-f]{2})', '%25', raw_database_url)

database_url = _sanitize_database_url(os.getenv('DATABASE_URL'))
conn = psycopg2.connect(database_url)
cur = conn.cursor()

cur.execute("""
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'chk_jobs_status'
""")
print("Constraint chk_jobs_status definition:")
print(cur.fetchone()[0])

cur.close()
conn.close()
