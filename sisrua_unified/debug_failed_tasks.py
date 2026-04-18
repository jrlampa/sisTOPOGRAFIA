#!/usr/bin/env python3
"""Investiga os 18 dxf_tasks com status failed."""
import os
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2
from psycopg2.extras import RealDictCursor

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()

r = urlparse(os.getenv("DATABASE_URL"))
pw = unquote(r.password) if r.password else None
conn = psycopg2.connect(database=r.path[1:], user=r.username, password=pw, host=r.hostname, port=r.port or 5432, sslmode="require")
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=== dxf_tasks FAILED — detalhes ===")
cur.execute("""
    SELECT id, status, error, created_at, updated_at
    FROM public.dxf_tasks
    WHERE status = 'failed'
    ORDER BY updated_at DESC
    LIMIT 10
""")
for row in cur.fetchall():
    print(f"\n  id={row['id']}")
    print(f"  status={row['status']}")
    print(f"  error={str(row['error'])[:200]}")
    print(f"  created={row['created_at']}  updated={row['updated_at']}")

print("\n=== dxf_tasks — distribuição de erro ===")
cur.execute("""
    SELECT LEFT(error, 80) AS error_prefix, COUNT(*) AS cnt
    FROM public.dxf_tasks
    WHERE status = 'failed'
    GROUP BY error_prefix
    ORDER BY cnt DESC
""")
for row in cur.fetchall():
    print(f"  [{row['cnt']}x] {row['error_prefix']}")

print("\n=== jobs com status processing/queued (stuck?) ===")
cur.execute("""
    SELECT id, status, created_at, updated_at,
           NOW() - updated_at AS age
    FROM public.jobs
    ORDER BY created_at DESC
""")
for row in cur.fetchall():
    age = str(row["age"]).split(".")[0] if row["age"] else "?"
    print(f"  {row['status']:<15} age={age}  id={row['id']}")

cur.close()
conn.close()
