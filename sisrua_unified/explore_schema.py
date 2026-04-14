#!/usr/bin/env python3
"""Explore schema do banco-alvo para identificar oportunidades de performance tuning."""

import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

# Load .env
env_path = Path('.env')
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

database_url = os.getenv('DATABASE_URL')
conn = psycopg2.connect(database_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 80)
print("EXTENSÕES DISPONÍVEIS (ESPECIALMENTE POSTGIS)")
print("=" * 80)
cur.execute("""
SELECT extname, extversion, nspname 
FROM pg_extension 
LEFT JOIN pg_namespace ON pg_namespace.oid = pg_extension.extnamespace
WHERE extname IN ('postgis', 'pg_trgm', 'pg_cron', 'extensions')
ORDER BY extname
""")
exts = cur.fetchall()
if exts:
    for e in exts:
        print(f"  {e['extname']} (v{e['extversion']}) @ {e['nspname']}")
else:
    print("  [nenhuma extensão geoespacial/advanced encontrada]")

print("\n" + "=" * 80)
print("VOLUMES DE TABELAS PRINCIPAIS")
print("=" * 80)
cur.execute("""
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty
FROM pg_tables
WHERE schemaname IN ('public', 'backup')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20
""")
tables = cur.fetchall()
for t in tables:
    print(f"  {t['schemaname']}.{t['tablename']:<35} {t['size_pretty']:>12}")

print("\n" + "=" * 80)
print("COLUNAS COM TIPOS ESPECIAIS (JSONB, TIMESTAMP, TEXT)")
print("=" * 80)
cur.execute("""
SELECT 
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type
FROM information_schema.columns c
WHERE c.table_schema IN ('public', 'backup')
  AND c.data_type IN ('jsonb', 'json', 'geometry', 'geography', 
                      'timestamp with time zone', 'timestamp without time zone', 
                      'text', 'character varying')
ORDER BY c.table_schema, c.table_name, c.ordinal_position
""")
cols = cur.fetchall()
current_table = None
for col in cols:
    if col['table_name'] != current_table:
        print(f"\n  {col['table_schema']}.{col['table_name']}:")
        current_table = col['table_name']
    print(f"    {col['column_name']:<25} {col['data_type']:<20}")

print("\n" + "=" * 80)
print("TABELAS CANDIDATAS PARA PARTICIONAMENTO (TIME-SERIES)")
print("=" * 80)
for table in ['audit_logs', 'jobs', 'dxf_tasks', 'bt_export_history']:
    cur.execute(f"""
    SELECT 
      COUNT(*) as row_count,
      pg_size_pretty(pg_total_relation_size('public.{table}')) as size
    FROM public.{table}
    """)
    result = cur.fetchone()
    print(f"  {table:<30} {result['row_count']:>10} rows  {result['size']:>12}")

print("\n" + "=" * 80)
print("ÍNDICES ATUAIS")
print("=" * 80)
cur.execute("""
SELECT
  t.tablename,
  i.indexname,
  ix.indisunique,
  ix.indisprimary
FROM pg_indexes i
JOIN pg_class ic ON ic.relname = i.indexname
JOIN pg_index ix ON ix.indexrelid = ic.oid
JOIN pg_tables t ON t.schemaname = i.schemaname AND t.tablename = i.tablename
WHERE i.schemaname = 'public'
  AND t.tablename IN ('audit_logs', 'jobs', 'dxf_tasks', 'bt_export_history', 'constants_catalog', 'user_roles')
ORDER BY t.tablename, i.indexname
""")
indices = cur.fetchall()
for idx in indices:
    unique = "(UNIQUE)" if idx['indisunique'] else ""
    primary = "(PRIMARY)" if idx['indisprimary'] else ""
    print(f"  {idx['tablename']:<30} {idx['indexname']:<40} {unique} {primary}".strip())

print("\n" + "=" * 80)
cur.close()
conn.close()
