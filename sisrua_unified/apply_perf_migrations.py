#!/usr/bin/env python3
"""Apply migrations 023 and 024 to target database."""

import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

env_path = Path('.env')
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

database_url = os.getenv('DATABASE_URL')
migrations_dir = Path('migrations')

# Migrations to apply
migrations_to_apply = [
    '023_advanced_performance_indexes.sql',
    '024_db_maintenance_schedule.sql',
]

conn = psycopg2.connect(database_url)
conn.autocommit = True
cur = conn.cursor(cursor_factory=RealDictCursor)

for migration_file in migrations_to_apply:
    migration_path = migrations_dir / migration_file
    
    if not migration_path.exists():
        print(f"❌ {migration_file}: arquivo não encontrado")
        continue
    
    # Check if already applied
    cur.execute(
        "SELECT 1 FROM public._migrations WHERE filename = %s",
        (migration_file,)
    )
    if cur.fetchone():
        print(f"⏭️  {migration_file}: já aplicada")
        continue
    
    print(f"📝 {migration_file}: aplicando...")
    
    try:
        # Read migration content
        migration_sql = migration_path.read_text(encoding='utf-8')
        
        # Execute migration
        cur.execute(migration_sql)
        
        # Manually track it (if the migration itself doesn't do it)
        cur.execute(
            "INSERT INTO public._migrations (filename) VALUES (%s) ON CONFLICT (filename) DO NOTHING",
            (migration_file,)
        )
        
        print(f"✅ {migration_file}: aplicada com sucesso")
    except Exception as e:
        print(f"❌ {migration_file}: ERRO - {e}")
        conn.rollback()

# Verify
print("\n" + "=" * 80)
print("MIGRATIONS AGORA APLICADAS (023-024)")
print("=" * 80)
cur.execute(
    "SELECT filename, applied_at FROM public._migrations WHERE filename IN (%s, %s) ORDER BY applied_at",
    ('023_advanced_performance_indexes.sql', '024_db_maintenance_schedule.sql')
)
for row in cur.fetchall():
    print(f"  ✅ {row['filename']:<50} {row['applied_at']}")

# Verify objects created
print("\n" + "=" * 80)
print("ÍNDICES BRIN (de 023)")
print("=" * 80)
cur.execute("""
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' AND indexname LIKE 'idx_brin_%'
ORDER BY indexname
""")
for row in cur.fetchall():
    print(f"  ✅ {row['indexname']}")

print("\n" + "=" * 80)
print("MATERIALIZED VIEWS (de 023)")
print("=" * 80)
cur.execute("""
SELECT matviewname FROM pg_matviews 
WHERE schemaname = 'public' 
ORDER BY matviewname
""")
for row in cur.fetchall():
    print(f"  ✅ {row['matviewname']}")

print("\n" + "=" * 80)
print("MAINTENANCE LOG TABLE (de 024)")
print("=" * 80)
cur.execute("""
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'private' AND table_name = 'maintenance_log'
)
""")
exists = cur.fetchone()[0]
print(f"  {'✅' if exists else '❌'} private.maintenance_log")

print("\n" + "=" * 80)
print("CRON JOBS AGORA AGENDADOS (de 024)")
print("=" * 80)
cur.execute("""
SELECT jobname, schedule FROM cron.job 
WHERE jobname IN (
  'vacuum_analyze_jobs_daily',
  'refresh_materialized_views_hourly',
  'archive_old_audit_logs_nightly'
) 
ORDER BY jobname
""")
for row in cur.fetchall():
    print(f"  ✅ {row['jobname']:<40} schedule={row['schedule']}")

cur.close()
conn.close()
