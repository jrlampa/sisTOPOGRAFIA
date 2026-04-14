#!/usr/bin/env python3
"""Apply migration 034 (time-series partitioning) to target database."""

import os
from pathlib import Path
import psycopg2

env_path = Path('.env')
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

database_url = os.getenv('DATABASE_URL')
migrations_dir = Path('migrations')
migration_file = '034_time_series_partitioning.sql'
migration_path = migrations_dir / migration_file

conn = psycopg2.connect(database_url)
conn.autocommit = True
cur = conn.cursor()

print(f"📝 {migration_file}: aplicando...")

try:
    # Read migration content
    migration_sql = migration_path.read_text(encoding='utf-8')
    
    # Execute migration
    cur.execute(migration_sql)
    
    # Track it
    cur.execute(
        "INSERT INTO public._migrations (filename) VALUES (%s) ON CONFLICT (filename) DO NOTHING",
        (migration_file,)
    )
    
    print(f"✅ {migration_file}: aplicada com sucesso")
except Exception as e:
    print(f"❌ {migration_file}: ERRO - {e}")
    import traceback
    traceback.print_exc()

# Verify
print("\n" + "=" * 80)
print("TABELAS PARTICIONADAS CRIADAS")
print("=" * 80)
cur.execute("""
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename ~ '_partitioned$'
ORDER BY tablename
""")
for schema, table in cur.fetchall():
    print(f"  ✅ {table}")

print("\n" + "=" * 80)
print("PARTIÇÕES (exemplos dos últimos 3 meses)")
print("=" * 80)
cur.execute("""
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename ~ '^(audit_logs|jobs|dxf_tasks|bt_export_history)_[0-9]{4}_[0-9]{2}$'
ORDER BY tablename DESC
LIMIT 20
""")
for schema, table in cur.fetchall():
    print(f"  ✅ {table}")

cur.close()
conn.close()
