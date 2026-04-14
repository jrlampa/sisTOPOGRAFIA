#!/usr/bin/env python3
"""
Test script to verify Supabase connection and generate a DXF with 10 points
"""

import sys
import os
from pathlib import Path
import json
from datetime import datetime

# Add py_engine to path
script_dir = Path(__file__).parent
py_engine_dir = script_dir / "py_engine"
sys.path.insert(0, str(py_engine_dir))

# Test 1: Verify Supabase Connection
print("=" * 70)
print("TEST 1: VERIFYING SUPABASE CONNECTION")
print("=" * 70)

try:
    import psycopg2
    from psycopg2.pool import SimpleConnectionPool
    from urllib.parse import urlparse

    # Parse DATABASE_URL from .env
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        sys.exit(1)

    print(f"📍 Database URL: {database_url[:50]}...")

    # Parse connection string
    parsed = urlparse(database_url)
    print(f"🔗 Host: {parsed.hostname}")
    print(f"🔗 Database: {parsed.path.lstrip('/')}")
    print(f"🔗 User: {parsed.username}")

    # Attempt connection
    print("\n🔄 Connecting to Supabase PostgreSQL...")
    try:
        connection = psycopg2.connect(database_url)
        cursor = connection.cursor()

        # Execute a simple test query
        cursor.execute("SELECT NOW() as timestamp, version() as version;")
        result = cursor.fetchone()

        print("✅ Connection successful!")
        print(f"📅 Server time: {result[0]}")
        print(f"🗄️  PostgreSQL version: {result[1][:50]}...")

        # Check if migrations table exists
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'constants_catalog_snapshots'
            );
        """
        )
        snapshots_exists = cursor.fetchone()[0]
        print(
            f"📊 constants_catalog_snapshots table: {'✅ EXISTS' if snapshots_exists else '❌ NOT FOUND'}"
        )

        # Get table count
        cursor.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
        )
        table_count = cursor.fetchone()[0]
        print(f"📊 Total public tables: {table_count}")

        cursor.close()
        connection.close()
        print("\n✅ Supabase connection verified successfully!")

    except Exception as e:
        print(f"❌ Connection error: {e}")
        sys.exit(1)

except ImportError:
    print("❌ psycopg2 not installed. Installing...")
    os.system("pip install psycopg2-binary > /dev/null 2>&1")
    print("⚠️  Please run the script again after installation")
    sys.exit(1)

# Test 2: Generate DXF with 10 points
print("\n" + "=" * 70)
print("TEST 2: GENERATING DXF WITH 10 POINTS")
print("=" * 70)

try:
    import ezdxf
    from ezdxf import units
    from ezdxf.enums import TextEntityAlignment

    # Create output directory
    output_dir = script_dir / "public" / "dxf"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"test_10_points_{timestamp}.dxf"

    print(f"\n📝 Creating DXF with 10 points...")
    print(f"📂 Output file: {output_file}")

    # Create a new DXF document
    doc = ezdxf.new("R2018", setup=True)
    doc.units = units.M  # Meters

    # Set header variables
    doc.header["$ACADVER"] = "AC1032"  # AutoCAD 2018
    doc.header["$INSUNITS"] = 6  # Meters

    # Get the modelspace
    msp = doc.modelspace()

    # Define layers
    doc.layers.add("POINTS", color=1)  # Red
    doc.layers.add("LABELS", color=2)  # Yellow
    doc.layers.add("GRID", color=7)  # White

    # Generate 10 points in a grid pattern
    points_data = []
    print("\n🔹 Points being added:")
    print("   No. | X (m)    | Y (m)    | Z (m)    | Description")
    print("   " + "-" * 60)

    point_number = 1
    for i in range(5):  # 5 rows
        for j in range(2):  # 2 columns = 10 points
            x = 10 + (j * 30)
            y = 10 + (i * 20)
            z = 0

            point_tuple = (x, y, z)
            points_data.append(point_tuple)

            # Add point as a 3D point
            msp.add_point((x, y, z), dxfattribs={"layer": "POINTS", "color": 1})

            # Add a small circle around point
            msp.add_circle((x, y), 1.5, dxfattribs={"layer": "POINTS", "color": 1})

            # Add label with point number
            msp.add_text(
                f"P{point_number}",
                dxfattribs={"layer": "LABELS", "color": 2, "height": 2},
            ).set_pos((x + 2, y + 2), align=TextEntityAlignment.LEFT)

            print(
                f"   {point_number:2d}. | {x:8.2f} | {y:8.2f} | {z:8.2f} | Point #{point_number}"
            )
            point_number += 1

    # Add a reference grid
    print("\n✏️  Adding reference grid...")
    for x in range(0, 80, 10):
        msp.add_line((x, 0), (x, 100), dxfattribs={"layer": "GRID", "color": 7})
    for y in range(0, 110, 10):
        msp.add_line((0, y), (80, y), dxfattribs={"layer": "GRID", "color": 7})

    # Add title block
    msp.add_text(
        "DXF Test - 10 Points", dxfattribs={"layer": "LABELS", "color": 2, "height": 3}
    ).set_pos((5, 105), align=TextEntityAlignment.LEFT)

    msp.add_text(
        f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
        dxfattribs={"layer": "LABELS", "color": 2, "height": 2},
    ).set_pos((5, 101), align=TextEntityAlignment.LEFT)

    # Save the DXF file
    doc.saveas(str(output_file))

    # Verify file was created
    if output_file.exists():
        file_size = output_file.stat().st_size
        print(f"\n✅ DXF file created successfully!")
        print(f"📦 File size: {file_size} bytes")
        print(f"📍 Location: {output_file}")
        print(f"📊 Points in file: 10")
        print(f"📐 Grid reference: 5 x 2 points in 80m x 100m area")

        # Create a summary JSON
        summary = {
            "test_date": datetime.now().isoformat(),
            "status": "SUCCESS",
            "supabase_connection": "VERIFIED",
            "dxf_file": str(output_file),
            "dxf_file_size": file_size,
            "points_count": 10,
            "points": [
                {
                    "number": i + 1,
                    "x": points_data[i][0],
                    "y": points_data[i][1],
                    "z": points_data[i][2],
                }
                for i in range(len(points_data))
            ],
        }

        summary_file = output_dir / f"test_summary_{timestamp}.json"
        with open(summary_file, "w") as f:
            json.dump(summary, f, indent=2)

        print(f"📋 Summary saved: {summary_file}")

    else:
        print(f"❌ Failed to create DXF file")
        sys.exit(1)

except ImportError:
    print("❌ ezdxf not installed. Installing...")
    os.system("pip install ezdxf > /dev/null 2>&1")
    print("⚠️  Please run the script again after installation")
    sys.exit(1)

print("\n" + "=" * 70)
print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
print("=" * 70)
