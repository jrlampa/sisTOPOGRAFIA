
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

database_url = re.sub(r'%(?![0-9A-Fa-f]{2})', '%25', os.getenv('DATABASE_URL'))
conn = psycopg2.connect(database_url)
cur = conn.cursor()

print("Schema for 'dxf_tasks' table:")
cur.execute("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'dxf_tasks'
ORDER BY ordinal_position
""")
for col, dtype, null in cur.fetchall():
    print(f"  {col:<25} {dtype:<25} Nullable: {null}")

print("\nIndexes for 'dxf_tasks' table:")
cur.execute("""
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'dxf_tasks'
""")
for name, definition in cur.fetchall():
    print(f"  {name:<25} {definition}")

cur.close()
conn.close()
