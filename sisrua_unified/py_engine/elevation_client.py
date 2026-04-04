"""
Unified Elevation Client - Uses TOPODATA for Brazil, Open-Elevation for international
"""
import requests
import numpy as np
import subprocess
import json
from utils.logger import Logger

BATCH_SIZE = 100

# Brazil bounding box (approximate)
BRAZIL_BOUNDS = {
    'north': 5.3,
    'south': -33.7,
    'east': -34.8,
    'west': -73.8
}

def is_within_brazil(lat, lon):
    """Check if coordinates are within Brazil territory"""
    return (BRAZIL_BOUNDS['south'] <= lat <= BRAZIL_BOUNDS['north'] and
            BRAZIL_BOUNDS['west'] <= lon <= BRAZIL_BOUNDS['east'])

def fetch_elevation_topodata(lat, lon):
    """
    Fetch elevation from TOPODATA using topodata_reader.py
    Returns elevation in meters or None if failed
    """
    try:
        result = subprocess.run(
            ['python', 'topodata_reader.py', str(lat), str(lon)],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get('elevation')
    except Exception as e:
        Logger.error(f"TOPODATA elevation fetch failed: {e}")
    return None

def fetch_elevation_grid(north, south, east, west, resolution=50):
    """
    Generates a grid of points and fetches elevation.
    Uses TOPODATA for Brazilian territory (30m resolution)
    Uses Open-Elevation for international areas (~90m resolution)
    
    Returns:
        tuple: (list of (lat, lon, elev), rows, cols)
    """
    # Check if area is entirely within Brazil
    center_lat = (north + south) / 2
    center_lon = (east + west) / 2
    
    use_topodata = is_within_brazil(center_lat, center_lon)
    
    if use_topodata:
        Logger.info("Using INPE TOPODATA (30m resolution) for Brazilian terrain")
        return _fetch_elevation_grid_topodata(north, south, east, west, resolution)
    else:
        Logger.info("Using Open-Elevation (~90m resolution) for international terrain")
        return _fetch_elevation_grid_open_elevation(north, south, east, west, resolution)

def _fetch_elevation_grid_topodata(north, south, east, west, resolution):
    """Fetch elevation using TOPODATA service"""
    Logger.info("Generating terrain grid for Brazil...")
    
    # TOPODATA resolution is ~30m (0.00027 degrees)
    step = max(0.0003, (resolution / 111000.0))
    
    rows = min(50, int(np.ceil((north - south) / step)))
    cols = min(50, int(np.ceil((east - west) / step)))
    
    lats = np.linspace(south, north, rows)
    lons = np.linspace(west, east, cols)
    
    locations = []
    for lat in lats:
        for lon in lons:
            locations.append((float(lat), float(lon)))
    
    total_points = len(locations)
    Logger.info(f"Querying TOPODATA elevation for {total_points} points ({rows}x{cols} grid)...")
    
    elevations = []
    success_count = 0
    
    for i, (lat, lon) in enumerate(locations):
        elev = fetch_elevation_topodata(lat, lon)
        if elev is not None:
            elevations.append((lat, lon, elev))
            success_count += 1
        else:
            elevations.append((lat, lon, 0))
        
        if (i + 1) % 10 == 0:
            Logger.info(f"TOPODATA progress: {i+1}/{total_points}")
    
    Logger.info(f"TOPODATA: {success_count}/{total_points} elevation points retrieved")
    return elevations, rows, cols

def _fetch_elevation_grid_open_elevation(north, south, east, west, resolution):
    """Fetch elevation using Open-Elevation API (original implementation)"""
    from concurrent.futures import ThreadPoolExecutor
    
    Logger.info("Generating terrain grid...")
    
    step = max(0.0001, (resolution / 111000.0))
    
    rows = min(100, int(np.ceil((north - south) / step)))
    cols = min(100, int(np.ceil((east - west) / step)))
    
    lats = np.linspace(south, north, rows)
    lons = np.linspace(west, east, cols)
    
    locations = []
    for lat in lats:
        for lon in lons:
            locations.append({'latitude': float(lat), 'longitude': float(lon)})
    
    total_points = len(locations)
    Logger.info(f"Querying elevation for {total_points} points ({rows}x{cols} grid)...")
    
    def fetch_batch(batch):
        try:
            resp = requests.post(
                "https://api.open-elevation.com/api/v1/lookup",
                json={"locations": batch},
                headers={'Content-Type': 'application/json'},
                timeout=15
            )
            if resp.status_code == 200:
                return [(r['latitude'], r['longitude'], r['elevation']) for r in resp.json()['results']]
        except Exception as e:
            Logger.error(f"Elevation batch failed: {e}")
        return [(loc['latitude'], loc['longitude'], 0) for loc in batch]

    batches = [locations[i:i+BATCH_SIZE] for i in range(0, total_points, BATCH_SIZE)]
    elevations = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(fetch_batch, batches))
        for res in results:
            elevations.extend(res)
                
    return elevations, rows, cols
