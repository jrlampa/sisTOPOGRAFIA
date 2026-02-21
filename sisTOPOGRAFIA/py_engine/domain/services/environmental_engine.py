import geopandas as gpd
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon
import os

try:
    from utils.logger import Logger
    from infrastructure.adapters.icmbio_api_adapter import ICMBioApiAdapter
    from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
except ImportError:
    from .utils.logger import Logger
    from ..infrastructure.adapters.icmbio_api_adapter import ICMBioApiAdapter
    from ..infrastructure.adapters.inea_api_adapter import IneaApiAdapter

class EnvironmentalEngine:
    """"Handles environmental constraints processing like APPs (Permanent Preservation Areas)."""

    APP_BUFFER_METERS = 30.0

    @staticmethod
    def extract_and_buffer_waterways(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """
        Receives the main GeoDataFrame, filters for waterways (rivers, streams)
        and natural water bodies, and calculates a 30m buffer (APP).
        
        Returns:
            GeoDataFrame containing only the generated APP polygons.
        """
        Logger.info("Processing Environmental Constraints (APP)...")
        
        water_features = []
        
        # Look for waterways (lines)
        if 'waterway' in gdf.columns:
            water_lines = gdf[gdf['waterway'].notna()].copy()
            if not water_lines.empty:
                water_features.append(water_lines)
                
        # Look for natural water bodies (polygons)
        if 'natural' in gdf.columns:
            water_polys = gdf[gdf['natural'] == 'water'].copy()
            if not water_polys.empty:
                water_features.append(water_polys)
                
        if not water_features:
            Logger.info("No waterways found for APP calculation.")
            return gpd.GeoDataFrame(columns=['geometry', 'app_type'])
            
        # Combine all water geometries
        water_gdf = pd.concat(water_features, ignore_index=True)
        
        # Ensure we are in a projected coordinate system (meters) for accurate buffering
        # Controller fetched and auto-projected to UTM (crs='auto' usually does this)
        # If it's EPSG:4326, buffering in degrees will be wrong.
        crs_is_geographic = water_gdf.crs and water_gdf.crs.is_geographic
        
        if crs_is_geographic:
            Logger.info("Warning: GeoDataFrame is in geographic CRS (degrees). Buffering might be inaccurate. Projecting to Web Mercator for buffering...", "warning")
            water_gdf = water_gdf.to_crs(epsg=3857)
            
        # Generate 30m buffer
        app_geometries = water_gdf.geometry.buffer(EnvironmentalEngine.APP_BUFFER_METERS)
        
        app_gdf = gpd.GeoDataFrame({'geometry': app_geometries, 'app_type': 'APP_30M'}, crs=water_gdf.crs)
        
        # Dissolve overlapping buffers into a single continuous polygon area
        app_gdf = app_gdf.dissolve(by='app_type', as_index=False)
        
        # Re-project back if we altered it
        if crs_is_geographic:
            app_gdf = app_gdf.to_crs(epsg=4326)
            
        Logger.info(f"Generated APP buffer ({EnvironmentalEngine.APP_BUFFER_METERS}m).")
        return app_gdf

    @staticmethod
    def extract_land_use(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Extracts and standardizes landuse polygons."""
        if 'landuse' not in gdf.columns:
            return gpd.GeoDataFrame(columns=['geometry', 'landuse_type'])
            
        landuse_gdf = gdf[gdf['landuse'].notna()].copy()
        
        # Standardize missing labels
        landuse_gdf['landuse_type'] = landuse_gdf['landuse']
        
        Logger.info(f"Extracted {len(landuse_gdf)} Land Use polygons.")
        return landuse_gdf

    @staticmethod
    def fetch_uc_fallback(bbox: tuple, target_type: str) -> dict:
        """
        Attempts to read from the compiled geometric cache.
        Returns a dict with {'gdf': GeoDataFrame, 'vintage_year': int}
        """
        cache_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'cache')
        
        # Mapping to possible file names users might compile
        filenames = {
            'UC_FEDERAL': ['uc_federal.geojson', 'uc_br.geojson'],
            'UC_ESTADUAL': ['uc_estadual.geojson', 'uc_rj.geojson', 'ucs_vigente.geojson'],
            'UC_MUNICIPAL': ['uc_municipal.geojson', 'uc_macabu.geojson']
        }
        
        files_to_check = filenames.get(target_type, [])
        
        for fname in files_to_check:
            filepath = os.path.join(cache_dir, fname)
            if os.path.exists(filepath):
                try:
                    Logger.info(f"Fallback activated: Reading local cache {fname} for {target_type}")
                    gdf = gpd.read_file(filepath)
                    
                    # Optional: We could clip the GDF to the bbox here for speed, 
                    # but simple read is fine for smaller region catches.
                    
                    vintage = 2024
                    if 'vintage_year' in gdf.columns and not gdf.empty:
                         vintage_val = gdf['vintage_year'].iloc[0]
                         if pd.notna(vintage_val): vintage = int(vintage_val)
                         
                    # Filter geometries that intersect roughly with bounding box
                    minx, miny, maxx, maxy = bbox
                    bbox_poly = Polygon([(minx, miny), (maxx, miny), (maxx, maxy), (minx, maxy)])
                    gdf = gdf[gdf.geometry.intersects(bbox_poly)].copy()
                    
                    gdf['TOPO_type'] = target_type
                    return {'gdf': gdf, 'vintage_year': vintage}
                    
                except Exception as e:
                    Logger.error(f"Fallback Cache failed parsing {fname}: {e}")
                    
        return {'gdf': gpd.GeoDataFrame(), 'vintage_year': None}

    @classmethod
    def process_all_conservation_units(cls, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> dict:
        """
        Orchestrates the fetching of UCs at all spheres (Federal, State, Municipal).
        Implements fallback cache directly if APIs fail or are unavailable.
        Returns {
           'combined_gdf': GeoDataFrame,
           'metadata': {'fallback_used': bool, 'vintage_years': []}
        }
        """
        bbox = (min_lon, min_lat, max_lon, max_lat)
        layers = []
        metadata = {'fallback_used': False, 'messages': []}
        
        # 1. Federal (ICMBio)
        gdf_fed = ICMBioApiAdapter.fetch_uc_federal(min_lon, min_lat, max_lon, max_lat)
        if gdf_fed is None:
            # Fallback
            fb = cls.fetch_uc_fallback(bbox, 'UC_FEDERAL')
            gdf_fed = fb['gdf']
            if not gdf_fed.empty:
                metadata['fallback_used'] = True
                metadata['messages'].append(f"UC Federal (Offline Cache: {fb['vintage_year']})")
                
        if gdf_fed is not None and not gdf_fed.empty: layers.append(gdf_fed)
            
        # 2. Estadual (INEA)
        gdf_est = IneaApiAdapter.fetch_uc_estadual(min_lon, min_lat, max_lon, max_lat)
        if gdf_est is None:
             # Fallback
             fb = cls.fetch_uc_fallback(bbox, 'UC_ESTADUAL')
             gdf_est = fb['gdf']
             if not gdf_est.empty:
                 metadata['fallback_used'] = True
                 metadata['messages'].append(f"UC Estadual (Offline Cache: {fb['vintage_year']})")
                 
        if gdf_est is not None and not gdf_est.empty: layers.append(gdf_est)
            
        # 3. Municipal (Always Cache/Fallback in this version, no national API exists)
        fb_mun = cls.fetch_uc_fallback(bbox, 'UC_MUNICIPAL')
        gdf_mun = fb_mun['gdf']
        if not gdf_mun.empty:
             metadata['fallback_used'] = True
             metadata['messages'].append(f"UC Municipal (Offline Cache: {fb_mun['vintage_year']})")
             layers.append(gdf_mun)
             
        # Combine all geometries
        if layers:
             combined_gdf = pd.concat(layers, ignore_index=True)
             return {'combined_gdf': combined_gdf, 'metadata': metadata}
             
        return {'combined_gdf': gpd.GeoDataFrame(), 'metadata': metadata}
