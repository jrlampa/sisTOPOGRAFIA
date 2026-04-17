#!/usr/bin/env python3
"""
DB Diagnostic Tool for Sis RUA
Performs a complete audit of the database state.
"""

import os
import re
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path
from urllib.parse import urlparse, unquote

def load_env():
    # Priority: project-specific .env
    env_path = Path('sisrua_unified/.env')
    if not env_path.exists():
        env_path = Path('.env')
    
    if env_path.exists():
        print(f"Loading environment from {env_path}")
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip()
    else:
        print("Warning: .env file not found.")

def get_db_connection():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment.")

    # Robust parsing of the database URL
    try:
        # We manually parse because psycopg2.connect(dsn) might fail with complex passwords
        result = urlparse(database_url)
        username = result.username
        password = unquote(result.password) if result.password else None
        database = result.path[1:]
        hostname = result.hostname
        port = result.port or 5432
        
        # Use decomposed parameters
        return psycopg2.connect(
            database=database,
            user=username,
            password=password,
            host=hostname,
            port=port,
            sslmode='require'
        )
    except Exception as e:
        print(f"Failed to connect using decomposed params: {e}")
        print("Falling back to literal DSN...")
        return psycopg2.connect(database_url)

def run_diagnostic():
    print("=" * 80)
    print("SIS RUA - DATABASE DIAGNOSTIC AUDIT")
    print("=" * 80)
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        print("[OK] Connection established successfully.")
        
        # 1. Schema Audit
        print("\n1. Schema Audit (Migrations 001-040)")
        print("-" * 40)
        
        # Check tracking table
        cur.execute("SELECT COUNT(*) as count FROM pg_tables WHERE tablename = '_migrations' AND schemaname = 'public'")
        if cur.fetchone()['count'] == 0:
            print("[ERR] Migration tracking table (_migrations) MISSING!")
        else:
            cur.execute("SELECT COUNT(*) as count FROM public._migrations")
            applied_count = cur.fetchone()['count']
            print(f"[OK] Total migrations applied: {applied_count}")
            
            # List missing if any (expectation: approx 41 files)
            migration_files = sorted(Path("sisrua_unified/migrations").glob("*.sql"))
            if not migration_files:
                 migration_files = sorted(Path("migrations").glob("*.sql"))
            
            expected_names = {f.name for f in migration_files}
            cur.execute("SELECT filename FROM public._migrations")
            applied_names = {row['filename'] for row in cur.fetchall()}
            
            missing = expected_names - applied_names
            if missing:
                print(f"[WARN] Missing migrations in DB: {sorted(list(missing))}")
            else:
                print("[OK] All migration files are accounted for in the tracking table.")

        # 2. Critical Tables Check
        print("\n2. Critical Tables Volume")
        print("-" * 40)
        critical_tables = ['jobs', 'dxf_tasks', 'bt_export_history', 'audit_logs', 'tenants', 'user_roles']
        for table in critical_tables:
            try:
                cur.execute(f"SELECT COUNT(*) as count FROM public.{table}")
                count = cur.fetchone()['count']
                print(f"  {table:<25} -> {count:>8} rows")
            except Exception:
                print(f"  {table:<25} -> [ERR] MISSING")
                conn.rollback()

        # 3. Security (RLS)
        print("\n3. Security (RLS) Status")
        print("-" * 40)
        cur.execute("""
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public' AND tablename IN ('jobs', 'dxf_tasks', 'bt_export_history', 'tenants')
            ORDER BY tablename
        """)
        for row in cur.fetchall():
            status = "ENABLED" if row['rowsecurity'] else "DISABLED [ERR]"
            print(f"  {row['tablename']:<25} -> RLS is {status}")

        # 4. Maintenance & pg_cron
        print("\n4. Maintenance Logs & pg_cron")
        print("-" * 40)
        try:
            cur.execute("SELECT jobname, schedule, active FROM cron.job")
            jobs = cur.fetchall()
            print(f"[OK] Found {len(jobs)} scheduled jobs in pg_cron.")
            
            cur.execute("SELECT status, COUNT(*) as count FROM private.maintenance_log GROUP BY status")
            maint_stats = cur.fetchall()
            print("Maintenance Log Summary (Last 90 days):")
            for stat in maint_stats:
                print(f"  {stat['status']:<15} : {stat['count']}")
                
            cur.execute("SELECT * FROM private.maintenance_log ORDER BY started_at DESC LIMIT 1")
            last_job = cur.fetchone()
            if last_job:
                print(f"Last job: {last_job['job_name']} @ {last_job['started_at']} (Status: {last_job['status']})")
        except Exception as e:
            print(f"[WARN] Maintenance check failed (maybe private schema or cron missing): {e}")
            conn.rollback()

        # 5. Performance Report (Call Health Report)
        print("\n5. Database Health Report (Internal Function)")
        print("-" * 40)
        try:
            # Check if function exists
            cur.execute("SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'db_health_report' AND nspname = 'private'")
            if cur.fetchone():
                cur.execute("SELECT * FROM private.db_health_report()")
                results = cur.fetchall()
                for report in results:
                    print(f"  {report['metric']:<18}: {report['value']} ({report['status']})")
            else:
                print("[WARN] Function private.db_health_report() not found.")
        except Exception as e:
            print(f"[WARN] Health report failed: {e}")
            conn.rollback()

        cur.close()
        conn.close()
        print("\n" + "=" * 80)
        print("DIAGNOSTIC COMPLETE")
        print("=" * 80)

    except Exception as e:
        print(f"FATAL DIAGNOSTIC ERROR: {e}")

if __name__ == "__main__":
    load_env()
    run_diagnostic()
