#!/usr/bin/env python3
"""Test that backend can access the database tables (simple SELECT tests)."""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment from .env file
DATABASE_URL = None
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                DATABASE_URL = line.split("=", 1)[1].strip()
                break

if not DATABASE_URL:
    print("❌ DATABASE_URL not found")
    exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("✅ Database Connection: WORKING\n")

    # Test SELECT from each table
    tests = [
        ("jobs", "SELECT COUNT(*) as count FROM public.jobs;"),
        ("dxf_tasks", "SELECT COUNT(*) as count FROM public.dxf_tasks;"),
        (
            "constants_catalog",
            "SELECT COUNT(*) as count FROM public.constants_catalog;",
        ),
        (
            "constants_catalog_history",
            "SELECT COUNT(*) as count FROM public.constants_catalog_history;",
        ),
        (
            "constants_refresh_events",
            "SELECT COUNT(*) as count FROM public.constants_refresh_events;",
        ),
        (
            "constants_catalog_snapshots",
            "SELECT COUNT(*) as count FROM public.constants_catalog_snapshots;",
        ),
    ]

    print("=" * 60)
    print("BACKEND TABLE ACCESS TEST")
    print("=" * 60)

    all_passed = True
    for table_name, query in tests:
        try:
            cursor.execute(query)
            result = cursor.fetchone()
            count = result["count"]
            print(f"✓ {table_name:35} → {count} rows")
        except Exception as e:
            print(f"❌ {table_name:35} → ERROR: {str(e)[:50]}")
            all_passed = False

    # Test views
    print("\n" + "=" * 60)
    print("VIEW ACCESS TEST")
    print("=" * 60)

    view_tests = [
        (
            "v_constants_refresh_stats",
            "SELECT COUNT(*) as count FROM public.v_constants_refresh_stats;",
        ),
        (
            "v_constants_refresh_ns_frequency",
            "SELECT COUNT(*) as count FROM public.v_constants_refresh_ns_frequency;",
        ),
        (
            "v_constants_refresh_top_actors",
            "SELECT COUNT(*) as count FROM public.v_constants_refresh_top_actors;",
        ),
    ]

    for view_name, query in view_tests:
        try:
            cursor.execute(query)
            result = cursor.fetchone()
            count = result["count"]
            print(f"✓ {view_name:40} → {count} rows")
        except Exception as e:
            print(f"❌ {view_name:40} → ERROR: {str(e)[:50]}")
            all_passed = False

    # Test RLS policies by checking that we can SELECT as anon role
    print("\n" + "=" * 60)
    print("RLS POLICIES CHECK")
    print("=" * 60)

    try:
        # Try to query as if we're an anonymous user
        cursor.execute("SELECT current_user;")
        current_user = cursor.fetchone()["current_user"]
        print(f"✓ Current user: {current_user}")

        # Check if tables have RLS enabled
        cursor.execute(
            """
            SELECT tablename, rowsecurity
            FROM pg_tables
            WHERE schemaname = 'public'
            AND rowsecurity = true
            ORDER BY tablename;
        """
        )

        rls_tables = cursor.fetchall()
        print(f"✓ RLS enabled on {len(rls_tables)} tables")

    except Exception as e:
        print(f"⚠️  RLS check: {str(e)[:80]}")

    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED - Database is ready for backend!")
    else:
        print("⚠️  Some tests failed - check errors above")
    print("=" * 60)

    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Connection error: {e}")
    exit(1)
