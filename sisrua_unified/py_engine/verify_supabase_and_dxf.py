#!/usr/bin/env python3
"""
Complete test: Verify Supabase connection and generate DXF with 10 points
"""
import os
import sys
from pathlib import Path
import ezdxf
from ezdxf import units
from datetime import datetime

# Load .env manually
env_file = Path(".env")
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()

# Create output directory
output_dir = Path("public/dxf")
output_dir.mkdir(parents=True, exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_file = output_dir / f"test_10_points_{timestamp}.dxf"

print("=" * 70)
print("COMPLETE TEST: SUPABASE + DXF GENERATION")
print("=" * 70)

# Test 1: Verify Supabase connection
print("\n[TEST 1] Verifying Supabase Connection...")
try:
    import psycopg2

    url = os.getenv("DATABASE_URL")
    if not url:
        print("❌ DATABASE_URL not found")
        sys.exit(1)

    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute("SELECT NOW(), version();")
    result = cur.fetchone()
    print(f"✅ SUPABASE Connected!")
    print(f"   Time: {result[0]}")
    print(f"   Version: {result[1][:50]}...")

    # Check tables
    cur.execute(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
    )
    table_count = cur.fetchone()[0]
    print(f"   Public tables: {table_count}")

    cur.close()
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

# Test 2: Generate DXF with 10 points
print("\n[TEST 2] Generating DXF with 10 Points...")
print(f"📝 Output file: {output_file}")

# Create DXF document
doc = ezdxf.new("R2018", setup=True)
doc.units = units.M

msp = doc.modelspace()

# Define layers
doc.layers.add("POINTS", color=1)  # Red
doc.layers.add("LABELS", color=2)  # Yellow
doc.layers.add("GRID", color=7)  # White

# Generate 10 points
print("\n🔹 Points being added:")
print("   No. | X (m)    | Y (m)    | Z (m)    ")
print("   " + "-" * 50)

point_number = 1
for i in range(5):
    for j in range(2):
        x = 10 + (j * 30)
        y = 10 + (i * 20)
        z = 0

        # Add point, circle, and label
        msp.add_point((x, y, z), dxfattribs={"layer": "POINTS", "color": 1})
        msp.add_circle((x, y), 1.5, dxfattribs={"layer": "POINTS", "color": 1})

        # Add text label
        text = msp.add_text(
            f"P{point_number}", dxfattribs={"layer": "LABELS", "color": 2, "height": 2}
        )
        text.dxf.insert = (x + 2, y + 2, 0)

        print(f"   {point_number:2d}. | {x:8.2f} | {y:8.2f} | {z:8.2f}")
        point_number += 1

# Add grid reference
print("\n✏️  Adding 8x11 reference grid...")
for x in range(0, 80, 10):
    msp.add_line((x, 0), (x, 100), dxfattribs={"layer": "GRID", "color": 7})
for y in range(0, 110, 10):
    msp.add_line((0, y), (80, y), dxfattribs={"layer": "GRID", "color": 7})

# Add title
title_text = msp.add_text(
    "DXF Test - 10 Points", dxfattribs={"layer": "LABELS", "color": 2, "height": 3}
)
title_text.dxf.insert = (5, 105, 0)

time_text = msp.add_text(
    f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
    dxfattribs={"layer": "LABELS", "color": 2, "height": 2},
)
time_text.dxf.insert = (5, 101, 0)

# Save DXF
doc.saveas(str(output_file))

# Verify
if output_file.exists():
    file_size = output_file.stat().st_size
    print(f"\n✅ DXF File Created!")
    print(f"   Size: {file_size} bytes")
    print(f"   Points: 10")
    print(f"   Area: 80m x 100m")
    print(f"   Location: {output_file.resolve()}")

    # Summary
    print("\n" + "=" * 70)
    print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
    print("=" * 70)
    print("Summary:")
    print("  ✓ Supabase connection verified")
    print("  ✓ DXF file generated with 10 points")
    print("  ✓ Test files ready for use")
else:
    print(f"❌ Failed to create DXF")
    sys.exit(1)
