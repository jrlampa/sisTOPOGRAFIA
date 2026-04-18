#!/usr/bin/env python3
import os
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2
from psycopg2.extras import RealDictCursor

for line in Path("sisrua_unified/.env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip()

r = urlparse(os.getenv("DATABASE_URL"))
pw = unquote(r.password) if r.password else None
conn = psycopg2.connect(database=r.path[1:], user=r.username, password=pw, host=r.hostname, port=r.port or 5432, sslmode="require")
cur = conn.cursor(cursor_factory=RealDictCursor)

print("--- audit_logs columns ---")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' ORDER BY ordinal_position")
for row in cur.fetchall():
    print(f"  {row['column_name']:<30} {row['data_type']}")

print()
print("--- anon grants DML (INSERT/UPDATE/DELETE) count ---")
cur.execute("""
    SELECT table_name, count(*) AS cnt, array_agg(privilege_type) AS privs
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='anon' AND privilege_type IN ('INSERT','UPDATE','DELETE')
    GROUP BY table_name ORDER BY table_name
""")
rows = cur.fetchall()
print(f"Total tabelas com anon DML: {len(rows)}")
for row in rows:
    print(f"  {row['table_name']}")

print()
print("--- SECURITY DEFINER functions search_path status ---")
cur.execute("""
    SELECT p.proname, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
""")
for row in cur.fetchall():
    cfg = row["proconfig"] or []
    has_sp = any("search_path" in c for c in cfg)
    icon = "OK" if has_sp else "MISSING"
    print(f"  [{icon}] {row['proname']:<45} search_path_in_config={has_sp}")

print()
print("--- Tables with RLS ON but ZERO policies ---")
cur.execute("""
    SELECT t.tablename
    FROM pg_tables t
    LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
    WHERE t.schemaname = 'public' AND t.rowsecurity = true
    GROUP BY t.tablename
    HAVING COUNT(p.policyname) = 0
""")
rows = cur.fetchall()
if rows:
    for row in rows:
        print(f"  [CRITICAL] {row['tablename']}")
else:
    print("  Nenhuma! Todas com RLS tem policies.")

print()
print("--- Checking partition inheritance of RLS ---")
cur.execute("""
    SELECT parent.relname AS parent, child.relname AS child, child.relrowsecurity AS child_rls
    FROM pg_inherits
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
    JOIN pg_namespace n ON n.oid = parent.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY parent.relname, child.relname
    LIMIT 50
""")
for row in cur.fetchall():
    rls = "RLS=ON" if row["child_rls"] else "RLS=OFF"
    print(f"  {row['parent']:<30} -> {row['child']:<35} {rls}")

cur.close()
conn.close()
