#!/usr/bin/env python3
"""
Test script: Generate DXF with 10 points
"""
import os
import sys
from pathlib import Path
import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment
from datetime import datetime

# Load .env manually
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()

# Create output directory
output_dir = Path(__file__).parent / "public" / "dxf"
output_dir.mkdir(parents=True, exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_file = output_dir / f"test_10_points_{timestamp}.dxf"

print("=" * 70)
print("TEST: GENERATING DXF WITH 10 POINTS")
print("=" * 70)
print(f"Creating DXF file: {output_file}")

# Create DXF document
doc = ezdxf.new("R2018", setup=True)
doc.units = units.M

msp = doc.modelspace()

# Define layers
doc.layers.add("POINTS", color=1)  # Red
doc.layers.add("LABELS", color=2)  # Yellow
doc.layers.add("GRID", color=7)  # White

# Generate 10 points
print("\n🔹 Adding 10 points in a 5x2 grid:")
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
        msp.add_text(
            f"P{point_number}", dxfattribs={"layer": "LABELS", "color": 2, "height": 2}
        ).set_pos((x + 2, y + 2), align=TextEntityAlignment.LEFT)

        print(f"   {point_number:2d}. | {x:8.2f} | {y:8.2f} | {z:8.2f}")
        point_number += 1

# Add grid reference
print("\n✏️  Adding reference grid...")
for x in range(0, 80, 10):
    msp.add_line((x, 0), (x, 100), dxfattribs={"layer": "GRID", "color": 7})
for y in range(0, 110, 10):
    msp.add_line((0, y), (80, y), dxfattribs={"layer": "GRID", "color": 7})

# Add title and timestamp
msp.add_text(
    "DXF Test - 10 Points", dxfattribs={"layer": "LABELS", "color": 2, "height": 3}
).set_pos((5, 105), align=TextEntityAlignment.LEFT)
msp.add_text(
    f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
    dxfattribs={"layer": "LABELS", "color": 2, "height": 2},
).set_pos((5, 101), align=TextEntityAlignment.LEFT)

# Save DXF
doc.saveas(str(output_file))

# Verify
if output_file.exists():
    file_size = output_file.stat().st_size
    print(f"\n✅ DXF file created successfully!")
    print(f"📦 File size: {file_size} bytes")
    print(f"📍 Location: {output_file.resolve()}")
    print(f"📊 Points: 10")
    print(f"📐 Dimensions: 80m x 100m area")
    print("\n" + "=" * 70)
    print("✅ DXF GENERATION TEST COMPLETED SUCCESSFULLY")
    print("=" * 70)
else:
    print(f"❌ Failed to create DXF")
    sys.exit(1)
