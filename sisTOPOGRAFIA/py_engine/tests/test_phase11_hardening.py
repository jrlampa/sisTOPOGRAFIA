"""
Fase 11 - Test Hardening:
1. Testa a correcao do bug waterway -> sisTOPO_HIDROGRAFIA
2. Testa circuit breaker (APIs offline -> fallback gracioso)
3. Testa que DXF e gerado mesmo com todas as APIs governamentais indisponiveis
"""
import pytest
import sys
import os
from unittest.mock import patch, MagicMock
from shapely.geometry import LineString, Polygon, Point
import geopandas as gpd
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator

# ── Fixture ──────────────────────────────────────────────────────────────────

@pytest.fixture
def gen(tmp_path):
    return DXFGenerator(str(tmp_path / "test_hardening.dxf"))


# ── 1. Bug Regression: waterway NUNCA deve cair em sisTOPO_EQUIPAMENTOS ──────

class TestWaterwayLayerClassification:
    """Garante que rios e cursos d'agua vao para sisTOPO_HIDROGRAFIA."""

    def test_waterway_river(self, gen):
        tags = {"waterway": "river", "name": "Rio Macabu"}
        assert gen.determine_layer(tags, None) == "sisTOPO_HIDROGRAFIA"

    def test_waterway_stream(self, gen):
        tags = {"waterway": "stream"}
        assert gen.determine_layer(tags, None) == "sisTOPO_HIDROGRAFIA"

    def test_waterway_canal(self, gen):
        tags = {"waterway": "canal"}
        assert gen.determine_layer(tags, None) == "sisTOPO_HIDROGRAFIA"

    def test_natural_water(self, gen):
        tags = {"natural": "water"}
        assert gen.determine_layer(tags, None) == "sisTOPO_HIDROGRAFIA"

    def test_natural_wetland(self, gen):
        tags = {"natural": "wetland"}
        assert gen.determine_layer(tags, None) == "sisTOPO_HIDROGRAFIA"

    def test_waterway_with_amenity_tag_does_NOT_go_to_equipamentos(self, gen):
        """Cenario do bug original: feature com waterway E amenity deve ir para HIDROGRAFIA."""
        tags = {"waterway": "river", "amenity": "fountain"}
        layer = gen.determine_layer(tags, None)
        assert layer == "sisTOPO_HIDROGRAFIA", (
            f"Bug reintroduzido! Layer foi '{layer}' mas deveria ser 'sisTOPO_HIDROGRAFIA'"
        )

    def test_waterway_never_goes_to_equipamentos(self, gen):
        """Waterway JAMAIS deve resultar em sisTOPO_EQUIPAMENTOS."""
        for wtype in ["river", "stream", "canal", "ditch", "drain"]:
            tags = {"waterway": wtype}
            layer = gen.determine_layer(tags, None)
            assert layer != "sisTOPO_EQUIPAMENTOS", (
                f"waterway={wtype} foi para EQUIPAMENTOS — bug de precedencia!"
            )

    def test_hidrografia_layer_exists_in_doc(self, gen):
        """Layer sisTOPO_HIDROGRAFIA deve estar definida no documento DXF."""
        assert "sisTOPO_HIDROGRAFIA" in gen.doc.layers, (
            "Layer sisTOPO_HIDROGRAFIA nao foi criada em dxf_styles.py!"
        )


# ── 2. Circuit Breaker: APIs offline nao travam o DXF ────────────────────────

class TestAPICircuitBreaker:
    """Garante que falhas nas APIs governamentais nao interrompem a geracao do DXF."""

    def test_icmbio_timeout_returns_none(self):
        """ICMBioAdapter deve retornar None (nao lancar excecao) quando API falha."""
        from infrastructure.adapters.icmbio_api_adapter import ICMBioApiAdapter
        import requests

        # patch no modulo onde requests.get e chamado
        with patch("infrastructure.adapters.icmbio_api_adapter.requests.get",
                   side_effect=requests.exceptions.Timeout("timeout simulado")):
            result = ICMBioApiAdapter.fetch_uc_federal(-43.0, -23.0, -42.0, -22.0)
            assert result is None, "ICMBio deveria retornar None em timeout"

    def test_inea_connection_error_returns_none(self):
        """IneaAdapter deve retornar None quando conexao falha (dentro do RJ)."""
        from infrastructure.adapters.inea_api_adapter import IneaApiAdapter
        import requests

        # Bbox dentro do RJ para ativar o request (fora do RJ retorna GDF vazio sem chamar a API)
        with patch("infrastructure.adapters.inea_api_adapter.requests.get",
                   side_effect=requests.exceptions.ConnectionError("conexao recusada")):
            result = IneaApiAdapter.fetch_uc_estadual(-43.5, -23.0, -41.0, -22.0)
            assert result is None, "INEA deveria retornar None em ConnectionError"

    def test_environmental_engine_continues_without_apis(self):
        """EnvironmentalEngine deve retornar resultado vazio (nao excecao) se ambas as APIs falham."""
        from domain.services.environmental_engine import EnvironmentalEngine
        import requests

        with patch("infrastructure.adapters.icmbio_api_adapter.requests.get",
                   side_effect=requests.exceptions.Timeout("todas as APIs offline")), \
             patch("infrastructure.adapters.inea_api_adapter.requests.get",
                   side_effect=requests.exceptions.Timeout("todas as APIs offline")):
            result = EnvironmentalEngine.process_all_conservation_units(
                min_lon=-43.0, min_lat=-23.0, max_lon=-42.0, max_lat=-22.0
            )
            # Deve retornar estrutura valida, nao None e nao lancar excecao
            assert result is not None
            assert "combined_gdf" in result
            assert "metadata" in result

    def test_dxf_generated_even_with_all_apis_offline(self, gen, tmp_path):
        """DXF deve ser gerado mesmo com todas as APIs indisponiveis."""
        import requests
        from domain.services.environmental_engine import EnvironmentalEngine

        with patch("infrastructure.adapters.icmbio_api_adapter.requests.get",
                   side_effect=requests.exceptions.Timeout("offline")), \
             patch("infrastructure.adapters.inea_api_adapter.requests.get",
                   side_effect=requests.exceptions.Timeout("offline")):
            # Simular feature basica (rio) que sempre vai existir via OSM
            data = {
                "geometry": [LineString([(0, 0), (100, 100)])],
                "waterway": ["river"],
                "name": ["Rio Teste"],
            }
            gdf = gpd.GeoDataFrame(data, crs="EPSG:32724")
            gen.add_features(gdf)
            gen.save()

            assert os.path.exists(gen.filename), "DXF nao foi gerado com APIs offline!"
            assert os.path.getsize(gen.filename) > 1000, "DXF parece vazio!"


# ── 3. Consistência das Layers ────────────────────────────────────────────────

class TestLayerConsistency:
    """Verifica se todas as layers referenciadas no determine_layer existem no DXF."""

    EXPECTED_LAYERS = [
        "sisTOPO_EDIFICACAO",
        "sisTOPO_VIAS",
        "sisTOPO_VEGETACAO",
        "sisTOPO_EQUIPAMENTOS",
        "sisTOPO_MOBILIARIO_URBANO",
        "sisTOPO_HIDROGRAFIA",
        "sisTOPO_RESTRICAO_APP_30M",
        "sisTOPO_USO_RESIDENCIAL",
        "sisTOPO_USO_COMERCIAL",
        "sisTOPO_USO_INDUSTRIAL",
        "sisTOPO_USO_VEGETACAO",
        "sisTOPO_UC_FEDERAL",
        "sisTOPO_UC_ESTADUAL",
        "sisTOPO_UC_MUNICIPAL",
        "sisTOPO_INFRA_POWER_HV",
        "sisTOPO_INFRA_POWER_LV",
        "sisTOPO_INFRA_TELECOM",
    ]

    def test_all_expected_layers_exist(self, gen):
        """Todas as layers do padrao sisTOPO_ devem estar registradas no documento."""
        missing = [l for l in self.EXPECTED_LAYERS if l not in gen.doc.layers]
        assert not missing, f"Layers ausentes no DXF: {missing}"
