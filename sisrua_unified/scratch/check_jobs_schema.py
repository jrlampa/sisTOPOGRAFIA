
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
if not database_url:
    raise RuntimeError('DATABASE_URL não definido.')

conn = psycopg2.connect(database_url)
cur = conn.cursor()

print("Schema for 'jobs' table:")
cur.execute("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
ORDER BY ordinal_position
""")
for col, dtype, null in cur.fetchall():
    print(f"  {col:<25} {dtype:<25} Nullable: {null}")

print("\nConstraints for 'jobs' table:")
cur.execute("""
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'jobs'::regclass
""")
for conname, contype in cur.fetchall():
    print(f"  {conname:<25} Type: {contype}")

print("\nIndexes for 'jobs' table:")
cur.execute("""
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'jobs'
""")
for name, definition in cur.fetchall():
    print(f"  {name:<25} {definition}")

cur.close()
conn.close()
