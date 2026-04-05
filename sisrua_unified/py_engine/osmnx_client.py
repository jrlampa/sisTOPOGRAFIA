import osmnx as ox
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
try:
    from utils.logger import Logger
    from constants import MAX_FETCH_RADIUS_METERS
except (ImportError, ValueError):
    from .utils.logger import Logger
    from .constants import MAX_FETCH_RADIUS_METERS


def _clip_to_boundary(gdf_proj, lat, lon, radius, polygon):
    """
    Clips a projected GeoDataFrame to the exact selection boundary.

    OSMnx returns full geometries for every feature that *touches* the query
    area — roads extend far outside the circle/polygon.  This function trims
    all features to the boundary the user actually drew, then removes any
    degenerate results (empty geoms, too-short lines, single-point remnants).
    """
    try:
        crs = gdf_proj.crs

        if polygon and len(polygon) >= 3:
            # Polygon selection: project the user-drawn polygon to UTM
            from shapely.geometry import Polygon as ShapelyPolygon
            boundary_4326 = ShapelyPolygon([(p[1], p[0]) for p in polygon])
            boundary_gdf = gpd.GeoDataFrame(geometry=[boundary_4326], crs='EPSG:4326')
            boundary_proj = boundary_gdf.to_crs(crs).geometry.iloc[0]
        else:
            # Circle selection: buffer the center point by radius in metres
            center_gdf = gpd.GeoDataFrame(geometry=[Point(lon, lat)], crs='EPSG:4326')
            center_proj = center_gdf.to_crs(crs).geometry.iloc[0]
            boundary_proj = center_proj.buffer(radius)

        if not boundary_proj.is_valid:
            boundary_proj = boundary_proj.buffer(0)  # auto-repair

        clipped = gpd.clip(gdf_proj, boundary_proj)

        # Remove empty / null geometries produced by the clip
        mask = clipped.geometry.notna() & ~clipped.geometry.is_empty
        clipped = clipped[mask].copy()

        # Drop degenerate linestrings (< 0.5 m after clip) to prevent corrupt DXF
        def _keep(geom):
            from shapely.geometry import LineString, MultiLineString, Polygon, MultiPolygon, Point as Pt
            if isinstance(geom, (LineString, MultiLineString)):
                return geom.length >= 0.5
            if isinstance(geom, (Polygon, MultiPolygon)):
                return geom.area >= 0.1
            return True  # Points always kept

        clipped = clipped[clipped.geometry.apply(_keep)].copy()
        clipped = clipped.reset_index(drop=True)

        Logger.info(
            f"Clipped {len(gdf_proj)} → {len(clipped)} features to selection boundary"
        )
        return clipped

    except Exception as e:
        Logger.error(f"Clip to boundary failed (returning unclipped): {e}")
        return gdf_proj

def fetch_osm_data(lat, lon, radius, tags, crs='auto', polygon=None):
    """
    Fetches features from OpenStreetMap within a radius or a custom polygon.
    
    Args:
        lat (float): Latitude (center if polygon is None)
        lon (float): Longitude (center if polygon is None)
        radius (float): Radius in meters (ignored if polygon is provided)
        tags (dict): Dictionary of OSM tags to fetch
        crs (str): 'auto' or EPSG code
        polygon (list): List of [lat, lon] points for the boundary
        
    Returns:
        GeoDataFrame: Projected GeoDataFrame clipped to the selection boundary
    """
    try:
        if polygon and len(polygon) >= 3:
            from shapely.geometry import Polygon as ShapelyPolygon
            
            # Shapely uses (x, y) which is (lon, lat) for geographic coordinates
            boundary = ShapelyPolygon([(p[1], p[0]) for p in polygon])
            
            Logger.info(f"Fetching OSM data from polygon with {len(polygon)} points (CRS={crs})")
            gdf = ox.features.features_from_polygon(boundary, tags)
        else:
            # Validate radius
            if radius > MAX_FETCH_RADIUS_METERS:
                raise ValueError(f"Radius too large. Max {MAX_FETCH_RADIUS_METERS}m.")
                
            Logger.info(f"Fetching OSM data from ({lat}, {lon}) radius={radius}m (CRS={crs})")
            gdf = ox.features.features_from_point((lat, lon), tags, dist=radius)
        
        if gdf.empty:
            Logger.info("No features found in the specified area")
            return gpd.GeoDataFrame()
            
        # Project to appropriate CRS for accurate distance calculations
        if crs and crs != 'auto':
            try:
                gdf_proj = gdf.to_crs(crs)
                Logger.info(f"Projected to custom CRS: {crs}")
            except Exception as e:
                Logger.info(f"Failed to project to {crs}: {e}. Falling back to auto projection.")
                gdf_proj = ox.projection.project_gdf(gdf)
        else:
            # Auto-project to UTM suitable for the latitude
            gdf_proj = ox.projection.project_gdf(gdf)

        # Clip features to the exact selection boundary so lines/roads don't
        # extend beyond the circle or polygon the user marked.
        gdf_proj = _clip_to_boundary(gdf_proj, lat, lon, radius, polygon)

        if gdf_proj.empty:
            Logger.info("No features remain after clipping to selection boundary")
            return gpd.GeoDataFrame()

        Logger.info(f"Successfully fetched {len(gdf_proj)} features")
        return gdf_proj
        
    except Exception as e:
        Logger.error(f"Error fetching OSM data: {e}")
        raise
