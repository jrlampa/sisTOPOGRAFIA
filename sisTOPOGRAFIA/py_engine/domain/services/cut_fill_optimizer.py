import numpy as np
import pyproj
from pyproj import Transformer
from shapely.geometry import Polygon, Point

try:
    from ...utils.geo import sirgas2000_utm_epsg
    from ...elevation_client import fetch_elevation_grid
except ImportError:
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
    from utils.geo import sirgas2000_utm_epsg
    from elevation_client import fetch_elevation_grid

class CutFillOptimizer:
    def __init__(self, polygon_points, target_z):
        """
        Calculates voxel cut/fill between a current terrain DEM and a flat planar Pad.
        polygon_points: list of [lat, lon]
        target_z: float (elevation of the flat pad)
        """
        self.polygon_points = polygon_points
        self.target_z = target_z

    def calculate(self):
        if len(self.polygon_points) < 3:
            raise ValueError("Polygon must have at least 3 points")

        # 1. Determine bounding box for DEM extraction
        lats = [p[0] for p in self.polygon_points]
        lons = [p[1] for p in self.polygon_points]
        
        north, south = max(lats), min(lats)
        east, west = max(lons), min(lons)
        
        # 2. Fetch elevation grid with a small buffer, asking for high resolution
        buffer = 0.0001 # ~11m
        elevations, rows, cols = fetch_elevation_grid(
            north + buffer, south - buffer, 
            east + buffer, west - buffer, 
            resolution=2 # Request incredibly high resolution (2 meters) to sample small pads precisely
        )
        
        if not elevations:
            raise Exception("No elevation data received from the DEM provider.")

        # 3. Project polygon to local UTM for meters-based square calculations (Voxel Area)
        center_lat = sum(lats) / len(lats)
        center_lon = sum(lons) / len(lons)
        epsg = sirgas2000_utm_epsg(center_lat, center_lon)
        
        # WGS84 = EPSG:4326
        transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
        
        utm_poly_points = []
        for p in self.polygon_points:
            # pyproj always_xy=True strictly expects (lon, lat)
            x, y = transformer.transform(p[1], p[0])
            utm_poly_points.append((x, y))
            
        shapely_poly = Polygon(utm_poly_points)
        poly_area = shapely_poly.area
        
        if poly_area <= 0:
            raise ValueError("Polygon area is zero or invalid.")

        # 4. Integrate Voxels Volume (Differential Earthworks)
        # Determine the footprint surface area of each individual elevation sample (dx * dy)
        if cols <= 1 or rows <= 1:
            # Fallback: Divide the exact polygon area over the fetched grid amount proportionally
            cell_area = poly_area / max(1, len(elevations))
        else:
            x1, y1 = transformer.transform(west - buffer, south - buffer)
            x2, y2 = transformer.transform(east + buffer, north + buffer)
            dx = abs(x2 - x1) / (cols - 1) if cols > 1 else 1.0
            dy = abs(y2 - y1) / (rows - 1) if rows > 1 else 1.0
            cell_area = dx * dy

        total_cut = 0.0
        total_fill = 0.0
        points_inside = 0
        
        for (lat, lon, elev) in elevations:
            x, y = transformer.transform(lon, lat)
            pt = Point(x, y)
            
            # If the voxel lies inside the spatial bounds of the designated Pad
            if shapely_poly.contains(pt):
                points_inside += 1
                dz = self.target_z - elev
                volume = abs(dz) * cell_area
                
                if dz > 0:  
                    # Pad is above ground level -> Fill (Aterro) required
                    total_fill += volume
                elif dz < 0: 
                    # Pad is excavating below ground -> Cut (Corte) required
                    total_cut += volume
                    
        # If the DEM grid missed inside points due to extreme smallness, estimate based on average 
        if points_inside == 0:
            # We fallback to naive single-point testing using just the center
            center_elev = sum([p[2] for p in elevations]) / max(1, len(elevations))
            dz = self.target_z - center_elev
            volume = abs(dz) * poly_area
            if dz > 0:
                total_fill = volume
            else:
                total_cut = volume

        return {
            "cut": total_cut,
            "fill": total_fill,
            "area": poly_area,
            "pointsSampled": points_inside,
            "targetZ": self.target_z
        }
