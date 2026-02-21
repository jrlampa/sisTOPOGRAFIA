import hashlib
import json
import os
import pickle
import tempfile
import time
import osmnx as ox
import pandas as pd
import geopandas as gpd
try:
    from utils.logger import Logger
    from constants import MAX_FETCH_RADIUS_METERS
except (ImportError, ValueError):  # pragma: no cover
    from .utils.logger import Logger
    from .constants import MAX_FETCH_RADIUS_METERS

# ── Cache em memória com TTL ───────────────────────────────────────────────────
# Zero custo: sem dependências externas. Cache em processo (por execução).
_OSM_CACHE: dict = {}
_OSM_CACHE_TTL_SECONDS: int = 3600  # 1 hora

# ── Cache em disco (persistente entre requisições no mesmo container) ───────────
# Configurável via OSM_CACHE_DIR. Padrão: /tmp/sistopografia_osm_cache
_OSM_CACHE_DIR: str = os.environ.get(
    'OSM_CACHE_DIR',
    os.path.join(tempfile.gettempdir(), 'sistopografia_osm_cache')
)


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


def _disk_cache_path(key: str) -> str:
    """Retorna o caminho do arquivo de cache em disco para a chave dada."""
    return os.path.join(_OSM_CACHE_DIR, f"osm_{key}.pkl")


def _get_disk_cached(key: str):
    """Retorna dados do cache em disco ou None se ausente/expirado/corrompido."""
    path = _disk_cache_path(key)
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'rb') as f:
            entry = pickle.load(f)
        if time.time() - entry['ts'] > _OSM_CACHE_TTL_SECONDS:
            try:
                os.remove(path)
            except OSError:
                pass
            return None
        return entry['data']
    except Exception:
        # Cache corrompido — ignora silenciosamente
        return None


def _set_disk_cache(key: str, data) -> None:
    """Persiste resultado no cache em disco (falhas são silenciosas)."""
    try:
        os.makedirs(_OSM_CACHE_DIR, exist_ok=True)
        path = _disk_cache_path(key)
        with open(path, 'wb') as f:
            pickle.dump({'data': data, 'ts': time.time()}, f)
    except Exception:
        pass  # Cache em disco é opcional — não propaga erros


def clear_osm_cache() -> None:
    """Limpa todo o cache OSM em memória e em disco (utilitário para testes e rotação)."""
    _OSM_CACHE.clear()
    try:
        if os.path.isdir(_OSM_CACHE_DIR):
            for fname in os.listdir(_OSM_CACHE_DIR):
                if fname.startswith('osm_') and fname.endswith('.pkl'):
                    try:
                        os.remove(os.path.join(_OSM_CACHE_DIR, fname))
                    except OSError:
                        pass
    except Exception:
        pass


def fetch_osm_data(lat, lon, radius, tags, crs='auto', polygon=None):
    """
    Fetches features from OpenStreetMap within a radius or a custom polygon.
    Utiliza cache L1 (memória, por processo) e L2 (disco, por container) com TTL de 1 hora.
    Zero custo — sem dependências externas além do sistema de arquivos.

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

    # L1: cache em memória (rápido, por processo)
    cached = _get_cached(key)
    if cached is not None:
        Logger.info("Cache OSM hit (memória) — retornando dados em cache.")
        return cached

    # L2: cache em disco (persiste entre requisições no mesmo container)
    disk_cached = _get_disk_cached(key)
    if disk_cached is not None:
        Logger.info("Cache OSM hit (disco) — carregando do cache persistente.")
        _set_cache(key, disk_cached)  # promove para L1
        return disk_cached

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
            _set_disk_cache(key, result)
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
        _set_disk_cache(key, gdf_proj)
        return gdf_proj

    except Exception as e:
        Logger.error(f"Error fetching OSM data: {e}")
        raise
