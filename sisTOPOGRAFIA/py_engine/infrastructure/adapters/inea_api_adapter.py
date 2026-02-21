import requests
import geopandas as gpd
from typing import Optional
from utils.logger import Logger

class IneaApiAdapter:
    """
    Adapter for the Rio de Janeiro State Environmental Agency (INEA).
    Fetches State Conservation Units (UCs) based on a geographic bounding box.
    """
    # Exemplo: Usando i3Geo do INEA ou proxy REST conhecido
    BASE_URL = "https://inea.rj.gov.br/geoserver/wfs" 
    TIMEOUT = 10

    @staticmethod
    def _is_in_rj(min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> bool:
        """Simple bounding box check for Rio de Janeiro state roughly"""
        rj_bbox = (-44.9, -23.4, -40.9, -20.7)
        return not (min_lon > rj_bbox[2] or max_lon < rj_bbox[0] or min_lat > rj_bbox[3] or max_lat < rj_bbox[1])

    @classmethod
    def fetch_uc_estadual(cls, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> Optional[gpd.GeoDataFrame]:
        """
        Queries the INEA API for State UCs if the bounding box is within Rio de Janeiro.
        Returns a GeoDataFrame or None if the request fails/times out.
        """
        if not cls._is_in_rj(min_lon, min_lat, max_lon, max_lat):
            return gpd.GeoDataFrame() # Return empty gracefully if outside RJ
            
        params = {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": "inea:uc_estadual", # Mock typeName
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "bbox": f"{min_lon},{min_lat},{max_lon},{max_lat},EPSG:4326"
        }

        try:
            Logger.debug(f"Fetching INEA State UCs for bbox: {min_lon},{min_lat},{max_lon},{max_lat}")
            response = requests.get(cls.BASE_URL, params=params, timeout=cls.TIMEOUT)
            
            # Since INEA endpoints are historically unstable, we fail gracefully
            if response.status_code != 200:
                Logger.warn(f"INEA API returned status code {response.status_code}. Executing Fallback.")
                return None
                
            data = response.json()
            if 'features' not in data or len(data['features']) == 0:
                return gpd.GeoDataFrame()
                
            gdf = gpd.GeoDataFrame.from_features(data['features'])
            gdf.set_crs(epsg=4326, inplace=True)
            
            # The instruction was to replace 'sisTOPO_type' with 'TOPO_type'.
            # The provided code snippet for replacement was syntactically incorrect.
            # Assuming the intent is to simply change the key name in the assignment.
            gdf['TOPO_type'] = 'UC_ESTADUAL'
            gdf['name'] = gdf.get('nome', 'UC Estadual')
            gdf['vintage_year'] = 'API-Realtime'
            
            return gdf
            
        except requests.exceptions.RequestException as e:
            Logger.warn(f"INEA API request failed or timed out: {e}. Executing Fallback.")
            return None
        except Exception as e:
            Logger.warn(f"Failed to parse INEA data: {e}")
            return None
