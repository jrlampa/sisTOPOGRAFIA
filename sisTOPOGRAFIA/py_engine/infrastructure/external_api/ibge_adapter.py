import requests
import json
import math
try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
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

class IBGEAdapter:
    """
    Adaptador para o Banco de Dados Geodésicos (BDG) do IBGE via WFS.
    """
    WFS_URL = "https://geoservicos.ibge.gov.br/geoserver/wfs"
    LAYER = "CGEO:estacoes_geodesicas"

    @staticmethod
    def get_stations_nearby(min_lat: float, min_lon: float, max_lat: float, max_lon: float):
        """
        Busca estações geodésicas dentro de um Bounding Box.
        Retorna uma lista de marcos com coordenadas e metadados.
        """
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": IBGEAdapter.LAYER,
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "bbox": f"{min_lat},{min_lon},{max_lat},{max_lon},urn:ogc:def:crs:EPSG::4326"
        }

        try:
            Logger.info(f"Consultando IBGE BDG para BBOX: {min_lat},{min_lon} a {max_lat},{max_lon}")
            response = requests.get(IBGEAdapter.WFS_URL, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            features = data.get("features", [])
            
            results = []
            for feat in features:
                props = feat.get("properties", {})
                geom = feat.get("geometry", {})
                coords = geom.get("coordinates", [0, 0])
                
                # Normalizar dados para o sisTOPOGRAFIA
                results.append({
                    "id": props.get("nome", "S/N"),
                    "type": props.get("tipo_estacao", "Marco"),
                    "lat": coords[1],
                    "lon": coords[0],
                    "altitude": props.get("altitude_ortometrica", 0.0),
                    "municipio": props.get("municipio", "N/A"),
                    "situacao": props.get("situacao", "Ativo")
                })
            
            Logger.info(f"Encontrados {len(results)} marcos geodésicos oficiais.")
            return results

        except Exception as e:
            Logger.error(f"Erro ao consultar IBGE BDG: {e}")
            return []

if __name__ == "__main__":
    # Teste rápido: Área de Búzios
    test_bbox = [-22.76, -41.90, -22.74, -41.88]
    marcos = IBGEAdapter.get_stations_nearby(*test_bbox)
    print(json.dumps(marcos, indent=2))
