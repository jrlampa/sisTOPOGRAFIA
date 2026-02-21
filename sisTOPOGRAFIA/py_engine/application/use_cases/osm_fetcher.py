"""
Use Case: OsmFetcherUseCase
Responsabilidade única: buscar features do OpenStreetMap via osmnx.
DDD — Application Layer.
"""
from typing import Optional, Dict
import geopandas as gpd

try:
    from osmnx_client import fetch_osm_data
    from utils.logger import Logger
except ImportError:  # pragma: no cover
    from osmnx_client import fetch_osm_data
    from utils.logger import Logger


class OsmFetcherUseCase:
    """
    Constrói o dicionário de tags OSM a partir da configuração de layers
    e busca as features correspondentes para um ponto/raio ou polígono.
    """

    def __init__(self, lat: float, lon: float, radius: float,
                 layers_config: Dict, crs: str,
                 selection_mode: str = 'circle', polygon=None):
        self.lat = lat
        self.lon = lon
        self.radius = radius
        self.layers_config = layers_config
        self.crs = crs
        self.selection_mode = selection_mode
        self.polygon = polygon

    # ── Public API ───────────────────────────────────────────────────────────

    def build_tags(self) -> Dict:
        """Retorna o dicionário de tags OSM baseado na configuração de layers."""
        tags: Dict = {}
        if self.layers_config.get('buildings', True):
            tags['building'] = True
        
        if self.layers_config.get('roads', True):
            tags['highway'] = True
            
        if self.layers_config.get('vegetation', True):
            tags.update({
                'natural': ['wood', 'scrub', 'heath', 'grassland', 'tree', 'tree_row', 'water'],
                'landuse': ['forest', 'grass', 'residential', 'commercial', 'industrial'],
                'waterway': True
            })
            
        if self.layers_config.get('furniture', False):
            tags['amenity'] = ['bench', 'waste_basket', 'bicycle_parking', 'fountain', 'bus_station']
            # Only add street_lamp if highway fetch is not already broad (True)
            if tags.get('highway') is not True:
                current_hw = tags.get('highway', [])
                if isinstance(current_hw, list):
                    if 'street_lamp' not in current_hw:
                        current_hw.append('street_lamp')
                    tags['highway'] = current_hw
                else:
                    tags['highway'] = ['street_lamp']

        if self.layers_config.get('equipment', False):
            tags['leisure'] = ['park', 'playground', 'sports_centre', 'pitch', 'garden']
            tags['man_made'] = ['tower', 'water_tower', 'chimney', 'flagpole', 'reservoir_covered']

        if self.layers_config.get('infrastructure', False):
            tags['power'] = ['line', 'tower', 'substation', 'pole', 'cable']
            tags['telecom'] = True

        return tags

    def fetch(self, tags: Dict) -> Optional[gpd.GeoDataFrame]:
        """Executa a busca OSM. Retorna GeoDataFrame ou None em caso de falha."""
        try:
            if self.selection_mode == 'polygon' and self.polygon:
                return fetch_osm_data(
                    self.lat, self.lon, self.radius, tags,
                    crs=self.crs, polygon=self.polygon
                )
            return fetch_osm_data(self.lat, self.lon, self.radius, tags, crs=self.crs)
        except Exception as e:
            Logger.error(f"OSM Fetch Error: {str(e)}")
            return None
