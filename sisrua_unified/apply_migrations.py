#!/usr/bin/env python3
"""
Apply all Supabase migrations to the database
"""
import os
import psycopg2
from pathlib import Path

# Load .env
env_file = Path(".env")
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("ERROR: DATABASE_URL not found")
    exit(1)

try:
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    # Apply migrations
    migrations = sorted(Path("migrations").glob("*.sql"))
    print(f"Found {len(migrations)} migration files\n")

    for migration_file in migrations:
        with open(migration_file, "r") as f:
            sql = f.read()

        print(f"Applying: {migration_file.name}...")
        try:
            cur.execute(sql)
            conn.commit()
            print(f"✅ {migration_file.name} applied successfully\n")
        except Exception as e:
            conn.rollback()
            error_msg = str(e)[:200]
            print(f"⚠️  {migration_file.name}\n   Error: {error_msg}\n")

    # Verify tables
    print("Verifying created tables:")
    cur.execute(
        """
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name
    """
    )
    tables = cur.fetchall()
    for table in tables:
        print(f"  ✓ {table[0]}")

    print(f"\n✅ Total tables: {len(tables)}")
    cur.close()
    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
    exit(1)
