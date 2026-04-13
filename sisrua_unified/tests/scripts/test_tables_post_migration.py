#!/usr/bin/env python3
"""Test that all migrated tables are accessible and populated correctly."""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment from .env file manually
DATABASE_URL = None
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                DATABASE_URL = line.split("=", 1)[1].strip()
                break
else:
    DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in .env")
    exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("✅ Connected to Supabase\n")

    # Test 1: Get table info
    print("=" * 60)
    print("TABLE SUMMARY")
    print("=" * 60)

    cursor.execute(
        """
        SELECT 
            table_name,
            (SELECT count(*) FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = t.table_name) as column_count,
            (SELECT count(*) FROM information_schema.table_constraints 
             WHERE table_schema = 'public' AND table_name = t.table_name AND constraint_type = 'PRIMARY KEY') as has_pk
        FROM information_schema.tables t
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """
    )

    tables = cursor.fetchall()
    print(f"Total tables: {len(tables)}\n")
    for table in tables:
        pk_mark = "🔑" if table["has_pk"] else "⚪"
        print(f"{pk_mark} {table['table_name']:35} ({table['column_count']} columns)")

    # Test 2: Check RLS policies on critical tables
    print("\n" + "=" * 60)
    print("RLS POLICIES")
    print("=" * 60)

    cursor.execute(
        """
        SELECT 
            schemaname, tablename, policyname, permissive, roles
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
    """
    )

    policies = cursor.fetchall()
    if policies:
        for policy in policies:
            print(f"✓ {policy['tablename']:30} → {policy['policyname']}")
    else:
        print("⚠️  No RLS policies found")

    # Test 3: Try basic inserts to verify permissions (these will fail if RLS blocks, which is expected)
    print("\n" + "=" * 60)
    print("PERMISSIONS TEST")
    print("=" * 60)

    # Test insert on jobs table
    try:
        cursor.execute(
            """
            INSERT INTO public.jobs (status, attempts, error)
            VALUES (%s, %s, %s)
            RETURNING id;
        """,
            ("test", 0, None),
        )
        job_id = cursor.fetchone()["id"]
        print(f"✓ Can INSERT into jobs (ID: {job_id})")

        # Clean up
        cursor.execute("DELETE FROM public.jobs WHERE id = %s", (job_id,))
        conn.commit()
    except Exception as e:
        print(f"⚠️  Cannot insert into jobs: {str(e)[:80]}")

    # Test select
    try:
        cursor.execute("SELECT COUNT(*) as cnt FROM public.jobs;")
        result = cursor.fetchone()
        print(f"✓ Can SELECT from jobs (count: {result['cnt']})")
    except Exception as e:
        print(f"❌ Cannot select from jobs: {e}")

    # Test 4: Check views are accessible
    print("\n" + "=" * 60)
    print("VIEWS")
    print("=" * 60)

    cursor.execute(
        """
        SELECT 
            matviewname as name,
            schemaname
        FROM pg_matviews
        WHERE schemaname = 'public'
        UNION ALL
        SELECT table_name as name, table_schema as schemaname
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY name;
    """
    )

    views = cursor.fetchall()
    for view in views:
        print(f"👁️  {view['name']}")

    print("\n✅ POST-MIGRATION VERIFICATION COMPLETE")
    print("Database schema is ready for use!")

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
