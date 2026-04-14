#!/usr/bin/env python3
import os
from pathlib import Path
import psycopg2

env_path = Path('.env')
for line in env_path.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ[k.strip()] = v.strip()

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
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
