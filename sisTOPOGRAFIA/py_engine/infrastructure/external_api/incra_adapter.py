import requests
import json
try:
    from ...utils.logger import Logger
except (ImportError, ValueError):  # pragma: no cover
    try:
        from py_engine.utils.logger import Logger
    except:
        class Logger:
            @staticmethod
            def info(msg): print(f"INFO: {msg}")
            @staticmethod
            def warn(msg): print(f"WARN: {msg}")
            @staticmethod
            def error(msg): print(f"ERROR: {msg}")

class INCRAAdapter:
    """
    Adaptador para o SIGEF (INCRA) via WFS (Acervo Fundiário).
    """
    # Acervo Fundiário Público
    WFS_URL = "https://acervo.incra.gov.br/geoserver/wfs"
    # Camada de parcelas certificadas (SIGEF)
    LAYER = "acervo:parcela_certificada_sigef"

    @staticmethod
    def get_parcels_nearby(min_lat: float, min_lon: float, max_lat: float, max_lon: float):
        """
        Busca parcelas certificadas do SIGEF dentro de um Bounding Box.
        Retorna GeoJSON com limites e dados do detentor.
        """
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": INCRAAdapter.LAYER,
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "bbox": f"{min_lat},{min_lon},{max_lat},{max_lon},urn:ogc:def:crs:EPSG::4326"
        }

        try:
            Logger.info(f"Consultando INCRA SIGEF para BBOX: {min_lat},{min_lon} a {max_lat},{max_lon}")
            response = requests.get(INCRAAdapter.WFS_URL, params=params, timeout=20)
            response.raise_for_status()
            
            data = response.json()
            features = data.get("features", [])
            
            results = []
            for feat in features:
                props = feat.get("properties", {})
                geom = feat.get("geometry", {})
                
                results.append({
                    "id": props.get("codigo_parcela", "S/N"),
                    "detentor": props.get("nome_detentor", "N/A"),
                    "imovel": props.get("nome_imovel", "N/A"),
                    "area_ha": props.get("area_hectares", 0.0),
                    "situacao": props.get("situacao_parcela", "Certificada"),
                    "geometria": geom
                })
            
            Logger.info(f"Encontradas {len(results)} parcelas certificadas no SIGEF.")
            return results

        except Exception as e:
            # Algumas instâncias do INCRA são instáveis
            Logger.warn(f"Falha ao consultar INCRA SIGEF: {e}")
            return []

if __name__ == "__main__":
    # Teste rápido em área rural
    test_bbox = [-22.15, -42.92, -22.14, -42.91]
    parcelas = INCRAAdapter.get_parcels_nearby(*test_bbox)
    print(json.dumps(parcelas, indent=2))
