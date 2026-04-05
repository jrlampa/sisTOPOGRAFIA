"""
TOPODATA INPE - GeoTIFF Elevation Reader

Reads elevation data from INPE's TOPODATA GeoTIFF tiles.
Uses rasterio for efficient GeoTIFF processing.

TOPODATA provides 30m resolution SRTM data for Brazilian territory.
"""

import sys
import argparse
import json
from pathlib import Path
import os

try:
    import rasterio
    from rasterio.sample import sample_gen
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

# ── Compat helpers used by warmup_topodata_cache.py ─────────────────────────

TILE_CACHE_DIR = Path(__file__).parent / "cache" / "topodata"


def get_cache_path(lat: float, lng: float) -> Path:
    """Return the expected cache path for the SRTM tile covering (lat, lng)."""
    TILE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tile_lat = int(lat // 1) * (1 if lat >= 0 else 1)
    tile_lng = int(lng // 1) * (1 if lng >= 0 else 1)
    ns = "N" if tile_lat >= 0 else "S"
    ew = "E" if tile_lng >= 0 else "W"
    name = f"{ns}{abs(tile_lat):02d}{ew}{abs(tile_lng):03d}.hgt"
    return TILE_CACHE_DIR / name


def download_tile(lat: float, lng: float) -> dict:
    """
    Download the SRTM tile for the given coordinate using srtm.py.
    The library auto-downloads and caches tiles on first use.
    Returns dict with 'success' key.
    """
    try:
        import srtm
        data = srtm.get_data()
        elev = data.get_elevation(lat, lng)
        return {"success": elev is not None, "elevation": elev, "lat": lat, "lng": lng}
    except Exception as e:
        return {"success": False, "error": str(e)}

def read_elevation(tiff_path: str, lat: float, lng: float) -> dict:
    """
    Read elevation at specific coordinates from GeoTIFF.
    
    Args:
        tiff_path: Path to GeoTIFF file
        lat: Latitude
        lng: Longitude
        
    Returns:
        dict with elevation data or error
    """
    if not HAS_RASTERIO:
        return {
            "error": "rasterio not installed. Install with: pip install rasterio",
            "elevation": None
        }
    
    try:
        with rasterio.open(tiff_path) as src:
            # Sample elevation at coordinate
            # rasterio expects (x, y) which is (lng, lat)
            coords = [(lng, lat)]
            values = list(src.sample(coords))
            
            elevation = values[0][0]  # First band, first value
            
            # Handle nodata values
            if elevation == src.nodata or elevation is None:
                elevation = 0
            
            return {
                "elevation": float(elevation),
                "lat": lat,
                "lng": lng,
                "file": Path(tiff_path).name
            }
    except Exception as e:
        return {
            "error": str(e),
            "elevation": None
        }

def read_elevation_grid(tiff_path: str, north: float, south: float, 
                        east: float, west: float, rows: int = 10, cols: int = 10) -> dict:
    """
    Read elevation grid from GeoTIFF.
    
    Args:
        tiff_path: Path to GeoTIFF file
        north, south, east, west: Bounding box
        rows, cols: Grid dimensions
        
    Returns:
        dict with grid data
    """
    if not HAS_RASTERIO:
        return {
            "error": "rasterio not installed. Install with: pip install rasterio",
            "points": []
        }
    
    try:
        with rasterio.open(tiff_path) as src:
            points = []
            
            for r in range(rows):
                lat = south + (north - south) * r / (rows - 1)
                for c in range(cols):
                    lng = west + (east - west) * c / (cols - 1)
                    
                    coords = [(lng, lat)]
                    values = list(src.sample(coords))
                    elevation = values[0][0]
                    
                    if elevation == src.nodata or elevation is None:
                        elevation = 0
                    
                    points.append({
                        "lat": lat,
                        "lng": lng,
                        "elevation": float(elevation),
                        "row": r,
                        "col": c
                    })
            
            return {
                "points": points,
                "rows": rows,
                "cols": cols,
                "file": Path(tiff_path).name
            }
    except Exception as e:
        return {
            "error": str(e),
            "points": []
        }

def get_tiff_info(tiff_path: str) -> dict:
    """Get GeoTIFF metadata."""
    if not HAS_RASTERIO:
        return {
            "error": "rasterio not installed",
            "exists": Path(tiff_path).exists()
        }
    
    try:
        with rasterio.open(tiff_path) as src:
            bounds = src.bounds
            return {
                "width": src.width,
                "height": src.height,
                "bands": src.count,
                "crs": str(src.crs),
                "bounds": {
                    "left": bounds.left,
                    "bottom": bounds.bottom,
                    "right": bounds.right,
                    "top": bounds.top
                },
                "resolution": src.res,
                "nodata": src.nodata
            }
    except Exception as e:
        return {
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description='Read elevation from TOPODATA GeoTIFF')
    parser.add_argument('--file', required=True, help='Path to GeoTIFF file')
    parser.add_argument('--lat', type=float, help='Latitude')
    parser.add_argument('--lng', type=float, help='Longitude')
    parser.add_argument('--grid', action='store_true', help='Read grid instead of single point')
    parser.add_argument('--north', type=float, help='Grid north bound')
    parser.add_argument('--south', type=float, help='Grid south bound')
    parser.add_argument('--east', type=float, help='Grid east bound')
    parser.add_argument('--west', type=float, help='Grid west bound')
    parser.add_argument('--rows', type=int, default=10, help='Grid rows')
    parser.add_argument('--cols', type=int, default=10, help='Grid cols')
    parser.add_argument('--info', action='store_true', help='Get TIFF info only')
    
    args = parser.parse_args()
    
    if args.info:
        result = get_tiff_info(args.file)
    elif args.grid:
        if None in [args.north, args.south, args.east, args.west]:
            print(json.dumps({"error": "Grid bounds required (--north, --south, --east, --west)"}))
            sys.exit(1)
        result = read_elevation_grid(
            args.file, args.north, args.south, args.east, args.west,
            args.rows, args.cols
        )
    else:
        if None in [args.lat, args.lng]:
            print(json.dumps({"error": "Coordinates required (--lat, --lng)"}))
            sys.exit(1)
        result = read_elevation(args.file, args.lat, args.lng)
    
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
