#!/usr/bin/env python3
"""
Test the 'ANALISE REGIÃO' button workflow with mock data.
Simulates the full flow that happens when user clicks the button.
"""

import requests
import time
import json

# Configuration
BACKEND_URL = "http://localhost:3001"
FRONTEND_URL = "http://localhost:3000"

# Test coordinates
TEST_LAT = -23.5505
TEST_LNG = -46.6333
TEST_RADIUS = 500

print("=" * 70)
print("TESTING 'ANALISE REGIÃO' BUTTON WORKFLOW")
print("=" * 70)
print(f"\nBackend: {BACKEND_URL}")
print(f"Frontend: {FRONTEND_URL}")
print(f"Test location: São Paulo ({TEST_LAT}, {TEST_LNG})")
print(f"Radius: {TEST_RADIUS}m\n")

# Step 1: Check backend health
print("STEP 1: Backend Health Check")
print("-" * 70)
try:
    response = requests.get(f"{BACKEND_URL}/api/osm", timeout=2)
    print("✓ Backend is responding")
except Exception as e:
    print(f"✗ Backend not responding: {e}")
    exit(1)

# Step 2: Test OSM endpoint (will fail but should fallback to mock)
print("\nSTEP 2: Test OSM Endpoint (with automatic fallback)")
print("-" * 70)

osm_payload = {"lat": TEST_LAT, "lng": TEST_LNG, "radius": TEST_RADIUS}

print(f"POST {BACKEND_URL}/api/osm")
print(f"Body: {json.dumps(osm_payload, indent=2)}\n")

try:
    start = time.time()
    response = requests.post(f"{BACKEND_URL}/api/osm", json=osm_payload, timeout=35)
    elapsed = time.time() - start

    if response.status_code == 200:
        data = response.json()
        elements = data.get("elements", [])
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Time: {elapsed:.2f}s")
        print(f"✓ Elements returned: {len(elements)}")

        if elements:
            print(f"\nSample element (first):")
            print(f"  Type: {elements[0].get('type')}")
            print(f"  Tags: {elements[0].get('tags')}")
    else:
        print(f"✗ Status: {response.status_code}")
        print(f"✗ Response: {response.text[:200]}")

except requests.exceptions.Timeout:
    print(f"✗ Request timeout after 35s")
except Exception as e:
    print(f"✗ Error: {e}")

# Step 3: Test elevation endpoint
print("\nSTEP 3: Test Elevation Endpoint")
print("-" * 70)

try:
    # Create mock coordinates for elevation fetch
    elevation_url = f"https://api.open-meteo.com/v1/elevation?latitude={TEST_LAT}&longitude={TEST_LNG}"
    response = requests.get(elevation_url, timeout=5)

    if response.status_code == 200:
        data = response.json()
        elev = data.get("elevation", [None])[0]
        print(f"✓ Open-Meteo API: {response.status_code}")
        print(f"✓ Elevation at test location: {elev}m")
    else:
        print(f"✗ Status: {response.status_code}")

except Exception as e:
    print(f"✗ Error: {e}")

# Final summary
print("\n" + "=" * 70)
print("WORKFLOW TEST COMPLETE")
print("=" * 70)
print("\n✅ If all steps show ✓, the button should work!")
print("\nNext steps:")
print("1. Open browser: http://localhost:3000")
print("2. Click 'ANALISE REGIÃO' button")
print("3. Should see analysis results (using mock data if Overpass is down)")
print("\nMonitor backend logs in terminal for details:")
print(f"  npm run server")
