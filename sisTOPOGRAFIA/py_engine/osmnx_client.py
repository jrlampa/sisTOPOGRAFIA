import hashlib
import json
import time
import osmnx as ox
import pandas as pd
import geopandas as gpd
try:
    from utils.logger import Logger
    from constants import MAX_FETCH_RADIUS_METERS
except (ImportError, ValueError):
    from .utils.logger import Logger
    from .constants import MAX_FETCH_RADIUS_METERS

# ── Cache em memória com TTL ───────────────────────────────────────────────────
# Zero custo: sem dependências externas. Cache em processo (por execução).
_OSM_CACHE: dict = {}
_OSM_CACHE_TTL_SECONDS: int = 3600  # 1 hora


def _cache_key(lat: float, lon: float, radius: float, tags: dict, polygon) -> str:
    """Gera chave única de cache baseada nos parâmetros de busca."""
    # Normaliza o polygon para lista de listas simples (json-serializável de forma determinística)
    normalized_polygon = [list(p) for p in polygon] if polygon else None
    payload = {
        'lat': round(lat, 6),
        'lon': round(lon, 6),
        'radius': radius,
        'tags': tags,
        'polygon': normalized_polygon,
    }
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


def _get_cached(key: str):
    """Retorna o valor em cache ou None se expirado/inexistente."""
    entry = _OSM_CACHE.get(key)
    if entry is None:
        return None
    if time.time() - entry['ts'] > _OSM_CACHE_TTL_SECONDS:
        del _OSM_CACHE[key]
        return None
    return entry['data']


def _set_cache(key: str, data) -> None:
    """Armazena resultado no cache com timestamp atual."""
    _OSM_CACHE[key] = {'data': data, 'ts': time.time()}


def clear_osm_cache() -> None:
    """Limpa todo o cache OSM em memória (utilitário para testes e rotação)."""
    _OSM_CACHE.clear()


def fetch_osm_data(lat, lon, radius, tags, crs='auto', polygon=None):
    """
    Fetches features from OpenStreetMap within a radius or a custom polygon.
    Utiliza cache em memória com TTL de 1 hora para evitar chamadas repetidas à API.

    Args:
        lat (float): Latitude (center if polygon is None)
        lon (float): Longitude (center if polygon is None)
        radius (float): Radius in meters (ignored if polygon is provided)
        tags (dict): Dictionary of OSM tags to fetch
        crs (str): 'auto' or EPSG code
        polygon (list): List of [lat, lon] points for the boundary

    Returns:
        GeoDataFrame: Projected GeoDataFrame with fetched features
    """
    key = _cache_key(lat, lon, radius, tags, polygon)
    cached = _get_cached(key)
    if cached is not None:
        Logger.info("Cache OSM hit — retornando dados em cache.")
        return cached

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
            result = gpd.GeoDataFrame()
            _set_cache(key, result)
            return result

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

        Logger.info(f"Successfully fetched {len(gdf_proj)} features")
        _set_cache(key, gdf_proj)
        return gdf_proj

    except Exception as e:
        Logger.error(f"Error fetching OSM data: {e}")
        raise
