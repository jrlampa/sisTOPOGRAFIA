
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

try:
    job_id = 'test-manual-upsert'
    cur.execute("""
        INSERT INTO jobs (id, status, progress, updated_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (id) DO UPDATE
          SET status = EXCLUDED.status,
              progress = EXCLUDED.progress,
              updated_at = NOW()
    """, (job_id, 'queued', 0))
    conn.commit()
    print("Upsert successful!")
except Exception as e:
    print(f"Upsert failed: {e}")
    conn.rollback()

cur.close()
conn.close()
