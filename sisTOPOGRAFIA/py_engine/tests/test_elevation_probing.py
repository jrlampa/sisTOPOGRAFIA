import sys
import os

# Add py_engine to path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from infrastructure.external_api.elevation_api import ElevationApiAdapter
from utils.logger import Logger

def test_elevation_probing():
    Logger.info("Testing Elevation Probing System...")
    adapter = ElevationApiAdapter()
    
    # Test provider selection
    best = adapter.select_best_provider()
    print(f"BEST PROVIDER SELECTED: {best['name']}")
    
    # Test grid fetching (small resolution for speed)
    # Testing coordinate in Brazil (UTM 23K area)
    lat, lon = -22.15, -42.92
    radius = 500
    
    Logger.info(f"Fetching grid for lat={lat}, lon={lon}, radius={radius}")
    grid = adapter.fetch_grid(lat, lon, radius, resolution=5)
    
    if grid and len(grid) == 5:
        print("Successfully fetched 5x5 grid.")
        print(f"Sample Point (Center): {grid[2][2]}")
        if grid[2][2][2] != 0:
            Logger.success("Elevation data looks valid (Non-zero altitude).")
        else:  # pragma: no cover
            Logger.warn("Elevation data exists but is zero. Check API response.")
    else:  # pragma: no cover
        Logger.error("Failed to fetch grid or invalid grid size.")

if __name__ == "__main__":
    test_elevation_probing()
