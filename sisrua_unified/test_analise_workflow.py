#!/usr/bin/env python3
"""
Test the 'ANALISE REGIÃO' button workflow by simulating API calls:
1. Call /api/osm endpoint to get OSM data
2. Call Open-Meteo elevation API
3. Report any errors
"""

import requests
import json
import time
from urllib.parse import urlencode

# Test coordinates - Downtown São Paulo
TEST_LAT = -23.5505
TEST_LNG = -46.6333
TEST_RADIUS = 500  # 500 meters

print("=" * 70)
print("SIMULATING 'ANALISE REGIÃO' BUTTON WORKFLOW")
print("=" * 70)
print(f"\nTest Parameters:")
print(f"  Location: São Paulo Downtown ({TEST_LAT}, {TEST_LNG})")
print(f"  Radius: {TEST_RADIUS}m")
print(f"\nNote: Backend must be running on http://localhost:5000\n")

# Test 1: Check if backend is running
print("=" * 70)
print("STEP 1: Checking if backend is running...")
print("=" * 70)

backend_url = "http://localhost:5000"
try:
    response = requests.get(f"{backend_url}/api/health", timeout=2)
    print(f"✓ Backend is running: {response.status_code}")
except Exception as e:
    print(f"❌ Backend not running: {e}")
    print("\n⚠️  Please start the backend with: npm run dev")
    print("   (in a separate terminal)")
    exit(1)

# Test 2: Call /api/osm endpoint
print("\n" + "=" * 70)
print("STEP 2: Fetching OSM data...")
print("=" * 70)

osm_url = f"{backend_url}/api/osm"
osm_payload = {"lat": TEST_LAT, "lng": TEST_LNG, "radius": TEST_RADIUS}

print(f"POST {osm_url}")
print(f"Body: {json.dumps(osm_payload, indent=2)}")

try:
    response = requests.post(osm_url, json=osm_payload, timeout=35)

    if response.status_code == 200:
        data = response.json()
        elements = data.get("elements", [])
        print(f"✓ OSM API responded: {response.status_code}")
        print(f"✓ Found {len(elements)} elements")
        if elements:
            print(f"  Sample tags: {', '.join(elements[0].keys())}")
    else:
        print(f"❌ OSM API error: {response.status_code}")
        print(f"   Response: {response.text[:200]}")

except requests.exceptions.Timeout:
    print(f"❌ OSM API timeout (>35s) - Overpass server may be slow")
except requests.exceptions.ConnectionError as e:
    print(f"❌ Connection error: {e}")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 3: Call Open-Meteo elevation API
print("\n" + "=" * 70)
print("STEP 3: Fetching elevation data...")
print("=" * 70)

# Create a simple 3x3 grid for elevation test
gridSize = 3
R = 6378137
dLat = (TEST_RADIUS / R) * (180 / 3.141592653589793)
dLng = (TEST_RADIUS / (R * 0.7188)) * (180 / 3.141592653589793)  # cos(-23.55°) ≈ 0.7188

minLat = TEST_LAT - dLat
maxLat = TEST_LAT + dLat
minLng = TEST_LNG - dLng
maxLng = TEST_LNG + dLng

lats = []
lngs = []
for i in range(gridSize):
    for j in range(gridSize):
        lats.append(minLat + i * (maxLat - minLat) / (gridSize - 1))
        lngs.append(minLng + j * (maxLng - minLng) / (gridSize - 1))

elevation_url = f"https://api.open-meteo.com/v1/elevation?latitude={','.join(f'{l:.6f}' for l in lats)}&longitude={','.join(f'{l:.6f}' for l in lngs)}"

print(f"GET Open-Meteo (grid: {gridSize}x{gridSize})")

try:
    response = requests.get(elevation_url, timeout=5)

    if response.status_code == 200:
        data = response.json()
        elevations = data.get("elevation", [])
        print(f"✓ Elevation API responded: {response.status_code}")
        print(f"✓ Retrieved {len(elevations)} elevation points")
        if elevations:
            print(f"  Min elevation: {min(elevations):.1f}m")
            print(f"  Max elevation: {max(elevations):.1f}m")
            print(f"  Avg elevation: {sum(elevations)/len(elevations):.1f}m")
    else:
        print(f"❌ Elevation API error: {response.status_code}")

except Exception as e:
    print(f"❌ Error: {e}")

# Final summary
print("\n" + "=" * 70)
print("WORKFLOW TEST COMPLETE")
print("=" * 70)
print("\n✅ If all steps passed, the 'ANALISE REGIÃO' button should work!")
print("⚠️  If you see any ❌ errors above, check the backend logs:")
print("   npm run dev  (in terminal)")
