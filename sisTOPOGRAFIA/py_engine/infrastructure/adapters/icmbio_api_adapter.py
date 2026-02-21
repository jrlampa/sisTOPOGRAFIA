import requests
import geopandas as gpd
from typing import Optional, Dict, Any
from utils.logger import Logger

class ICMBioApiAdapter:
    """
    Adapter for the Brazilian Federal Environmental Agency (ICMBio/MMA) Open Data APIs.
    Fetches Federal Conservation Units (UCs) based on a geographic bounding box.
    """
    # WFS endpoint from CSR/ICMBio
    BASE_URL = "https://geoservicos.icmbio.gov.br/geoserver/icmbio/wfs"
    TIMEOUT = 10 # Soft-fail quickly to use cache

    @classmethod
    def fetch_uc_federal(cls, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> Optional[gpd.GeoDataFrame]:
        """
        Queries the ICMBio WFS for Federal UCs crossing the specified bounding box.
        Returns a GeoDataFrame or None if the request times out/fails.
        """
        params = {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": "icmbio:limite_unidade_conservacao_federal",
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "bbox": f"{min_lon},{min_lat},{max_lon},{max_lat},EPSG:4326"
        }

        try:
            Logger.debug(f"Fetching ICMBio Federal UCs for bbox: {min_lon},{min_lat},{max_lon},{max_lat}")
            response = requests.get(cls.BASE_URL, params=params, timeout=cls.TIMEOUT)
            response.raise_for_status()
            
            data = response.json()
            if 'features' not in data or len(data['features']) == 0:
                return gpd.GeoDataFrame() # Empty but valid GeoDataFrame
                
            gdf = gpd.GeoDataFrame.from_features(data['features'])
            gdf.set_crs(epsg=4326, inplace=True)
            
            # Standardize attributes for the engine
            gdf['TOPO_type'] = 'UC_FEDERAL'
            gdf['name'] = gdf.get('nome', 'UC Federal')
            gdf['vintage_year'] = 'API-Realtime'
            
            return gdf
            
        except requests.exceptions.RequestException as e:
            Logger.warn(f"ICMBio API request failed or timed out: {e}")
            return None
        except Exception as e:
            Logger.warn(f"Failed to parse ICMBio data: {e}")
            return None
