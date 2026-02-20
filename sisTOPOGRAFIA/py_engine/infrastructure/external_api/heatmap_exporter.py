import numpy as np
import json
from typing import Dict, Any, List, Optional

class HeatmapExporter:
    """Infrastructure adapter to export analytical grids as heatmaps."""

    @staticmethod
    def export_to_json(grid: np.ndarray, lat: float, lon: float, radius: float) -> Dict[str, Any]:
        """
        Converts a numpy grid into a JSON format optimized for Leaflet.
        Includes bounding box and normalized values.
        """
        rows, cols = grid.shape
        # Normalize for visualization if not already
        max_val = grid.max()
        normalized = grid / max_val if max_val > 0 else grid
        
        # Calculate approximate bounds from lat/lon/radius
        # (Simplified: 1 degree lat approx 111km)
        lat_step = (radius * 2 / 111000) / (rows - 1)
        lon_step = (radius * 2 / (111000 * np.cos(np.radians(lat)))) / (cols - 1)
        
        start_lat = lat - (radius / 111000)
        start_lon = lon - (radius / (111000 * np.cos(np.radians(lat))))
        
        return {
            'metadata': {
                'rows': rows,
                'cols': cols,
                'start_lat': float(start_lat),
                'start_lon': float(start_lon),
                'lat_step': float(lat_step),
                'lon_step': float(lon_step),
                'max_raw_value': float(max_val)
            },
            'data': normalized.tolist()
        }

    @staticmethod
    def export_to_geojson_cells(grid: np.ndarray, lat: float, lon: float, radius: float) -> Dict[str, Any]:
        """
        Converts a grid into a GeoJSON of FeatureCollection (Cells).
        Placeholder for future cell-based vector heatmaps.
        """
        return {'type': 'FeatureCollection', 'features': []}
