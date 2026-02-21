import math

def utm_zone(longitude: float) -> int:
    """
    Calculates the UTM zone for a given longitude.
    Zone = int((lon + 180) / 6) + 1
    Clamped between 1 and 60.
    """
    zone = int((longitude + 180) // 6) + 1
    return max(1, min(60, zone))

def sirgas2000_utm_epsg(latitude: float, longitude: float) -> int:
    """
    Determines the EPSG code for SIRGAS 2000 / UTM zone based on lat/lon.
    Brazil spans both Southern (most) and Northern hemispheres.
    - South (S): EPSG:31960 + zone
    - North (N): EPSG:31954 + zone
    """
    zone = utm_zone(longitude)
    if latitude >= 0:
        # SIRGAS 2000 / UTM zone 18N (31972) to 22N (31976)
        # Formula: 31954 + zone. Zone 20N -> 31954 + 20 = 31974.
        return 31954 + zone
    else:
        # SIRGAS 2000 / UTM zone 18S (31978) to 25S (31985)
        # Formula: 31960 + zone. Zone 23S -> 31960 + 23 = 31983.
        return 31960 + zone


def validate_coordinates(lat: float, lon: float, radius: float) -> None:
    """
    Valida entradas de coordenadas e raio antes do processamento.
    Lança ValueError com mensagem descritiva em caso de entrada inválida.
    Esta função é a linha de defesa do motor Python contra dados não sanitizados.
    """
    if not math.isfinite(lat) or not (-90 <= lat <= 90):
        raise ValueError(f"Latitude inválida: {lat!r}. Esperado: -90 a 90.")
    if not math.isfinite(lon) or not (-180 <= lon <= 180):
        raise ValueError(f"Longitude inválida: {lon!r}. Esperado: -180 a 180.")
    if not math.isfinite(radius) or radius <= 0:
        raise ValueError(f"Raio inválido: {radius!r}. Deve ser > 0.")
    if radius > 10000:
        raise ValueError(f"Raio excessivo: {radius!r}. Máximo permitido: 10000m.")


def wgs84_to_utm(lat: float, lon: float) -> tuple:
    """
    Converte coordenadas WGS84 (lat, lon) para UTM SIRGAS 2000 (easting, northing).
    Retorna (easting, northing) em metros no fuso UTM correspondente.
    Usa pyproj com EPSG SIRGAS 2000 compatível com ABNT NBR 13133.
    """
    from pyproj import Transformer
    epsg = sirgas2000_utm_epsg(lat, lon)
    transformer = Transformer.from_crs('EPSG:4326', f'EPSG:{epsg}', always_xy=True)
    easting, northing = transformer.transform(lon, lat)
    return easting, northing
