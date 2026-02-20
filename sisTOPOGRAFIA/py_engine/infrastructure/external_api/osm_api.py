import osmnx as ox
import geopandas as gpd
from typing import Dict, List, Any
try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class OsmApiAdapter:
    """Infrastructure adapter for OpenStreetMap (OSMnx)."""
    
    @staticmethod
    def fetch_data(lat: float, lon: float, radius: number) -> gpd.GeoDataFrame:
        """Fetches OSM features within a radius of a center point."""
        point = (lat, lon)
        Logger.info(f"Infrastructure: Fetching OSM data for {point} (R={radius}m)")
        
        # Combined fetch for buildings, roads and nature
        tags = {
            'building': True, 
            'highway': True, 
            'natural': True, 
            'landuse': True,
            'amenity': ['bench', 'waste_basket', 'street_lamp'],
            'leisure': ['park', 'garden']
        }
        
        try:
            gdf = ox.features_from_point(point, tags=tags, dist=radius)
            if gdf.empty:
                return gpd.GeoDataFrame()
                
            # Basic cleanup
            gdf = gdf[gdf.geometry.notnull()]
            return gdf
        except Exception as e:
            Logger.error(f"OSM Infrastructure Error: {e}")
            return gpd.GeoDataFrame()
