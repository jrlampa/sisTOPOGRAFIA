#!/usr/bin/env python3
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
for t in ("dxf_tasks", "jobs"):
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position", (t,))
    print(f"{t} columns:", [r["column_name"] for r in cur.fetchall()])
cur.close()
conn.close()
