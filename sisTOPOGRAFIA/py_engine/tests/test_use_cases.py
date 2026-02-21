"""
test_use_cases.py — Testes unitários para a Camada de Aplicação (DDD).
Cobre OsmFetcherUseCase, EnvironmentalExtractorUseCase e HydrologyService
sem chamadas de rede reais (dados sintéticos / mocks).
"""
import pytest
import sys
import os
import numpy as np
from unittest.mock import patch, MagicMock
from shapely.geometry import LineString, Polygon, Point
import geopandas as gpd
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── 1. OsmFetcherUseCase — Construção de Tags ─────────────────────────────────

class TestOsmFetcherBuildTags:
    """Verifica a lógica pura de build_tags() sem chamadas OSM."""

    def _make_fetcher(self, layers_config):
        from application.use_cases.osm_fetcher import OsmFetcherUseCase
        return OsmFetcherUseCase(
            lat=-22.15018, lon=-42.92185, radius=500,
            layers_config=layers_config, crs='auto'
        )

    def test_buildings_tag_included_when_enabled(self):
        fetcher = self._make_fetcher({'buildings': True})
        tags = fetcher.build_tags()
        assert 'building' in tags and tags['building'] is True

    def test_buildings_tag_excluded_when_disabled(self):
        fetcher = self._make_fetcher({'buildings': False, 'roads': True})
        tags = fetcher.build_tags()
        assert 'building' not in tags

    def test_roads_tag_included_when_enabled(self):
        fetcher = self._make_fetcher({'roads': True})
        tags = fetcher.build_tags()
        assert 'highway' in tags and tags['highway'] is True

    def test_vegetation_includes_waterway(self):
        """Vegetação deve incluir waterway para APP e hidrologia."""
        fetcher = self._make_fetcher({'vegetation': True})
        tags = fetcher.build_tags()
        assert 'waterway' in tags

    def test_vegetation_includes_natural_water(self):
        fetcher = self._make_fetcher({'vegetation': True})
        tags = fetcher.build_tags()
        assert 'natural' in tags
        assert 'water' in tags['natural']

    def test_furniture_adds_amenity(self):
        fetcher = self._make_fetcher({'furniture': True})
        tags = fetcher.build_tags()
        assert 'amenity' in tags
        assert 'bench' in tags['amenity']

    def test_empty_config_returns_default_tags(self):
        """Config vazia: build_tags usa defaults (buildings=True, roads=True)."""
        fetcher = self._make_fetcher({})
        tags = fetcher.build_tags()
        # Por padrão, buildings e roads são True quando não especificado
        assert 'building' in tags
        assert 'highway' in tags

    def test_all_layers_enabled(self):
        fetcher = self._make_fetcher({
            'buildings': True, 'roads': True,
            'vegetation': True, 'furniture': True
        })
        tags = fetcher.build_tags()
        assert 'building' in tags
        assert 'highway' in tags
        assert 'waterway' in tags
        assert 'amenity' in tags


# ── 2. EnvironmentalExtractorUseCase — APP 30m Buffer ────────────────────────

class TestEnvironmentalExtractor:
    """Verifica extração de APP 30m a partir de GeoDataFrames sintéticos."""

    def _make_waterway_gdf(self):
        """GDF projetado (UTM) com um rio linear."""
        return gpd.GeoDataFrame(
            {
                'geometry': [LineString([(0, 0), (500, 0)])],
                'waterway': ['river'],
                'name': ['Rio Teste'],
            },
            crs='EPSG:32724'  # UTM Sul 24 — metros
        )

    def _make_natural_water_gdf(self):
        """GDF projetado com um corpo d'água poligonal."""
        return gpd.GeoDataFrame(
            {
                'geometry': [Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])],
                'natural': ['water'],
            },
            crs='EPSG:32724'
        )

    def _make_no_water_gdf(self):
        """GDF sem nenhuma feição hídrica."""
        return gpd.GeoDataFrame(
            {
                'geometry': [Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])],
                'building': ['yes'],
            },
            crs='EPSG:32724'
        )

    def test_app_buffer_generated_for_waterway(self):
        from domain.services.environmental_engine import EnvironmentalEngine
        gdf = self._make_waterway_gdf()
        app_gdf = EnvironmentalEngine.extract_and_buffer_waterways(gdf)
        assert not app_gdf.empty, "APP não foi gerada para rio linear"
        assert 'app_type' in app_gdf.columns
        assert app_gdf.iloc[0]['app_type'] == 'APP_30M'

    def test_app_buffer_width_is_30m(self):
        from domain.services.environmental_engine import EnvironmentalEngine
        gdf = self._make_waterway_gdf()
        app_gdf = EnvironmentalEngine.extract_and_buffer_waterways(gdf)
        # O buffer de 30m a partir de uma linha de 500m em UTM deve ter largura ≥ 30m
        geom = app_gdf.geometry.iloc[0]
        # Verificar que o buffer engloba pontos a 30m do rio
        assert geom.contains(Point(250, 29)), "APP não cobre os 30m esperados"
        assert not geom.contains(Point(250, 31)), "Buffer APP deve ter exatamente 30m de largura"

    def test_app_buffer_generated_for_natural_water(self):
        from domain.services.environmental_engine import EnvironmentalEngine
        gdf = self._make_natural_water_gdf()
        app_gdf = EnvironmentalEngine.extract_and_buffer_waterways(gdf)
        assert not app_gdf.empty, "APP não foi gerada para corpo d'água poligonal"

    def test_no_waterway_returns_empty_gdf(self):
        from domain.services.environmental_engine import EnvironmentalEngine
        gdf = self._make_no_water_gdf()
        app_gdf = EnvironmentalEngine.extract_and_buffer_waterways(gdf)
        assert app_gdf.empty, "APP não deve ser gerada sem feições hídricas"

    def test_land_use_extraction(self):
        from domain.services.environmental_engine import EnvironmentalEngine
        gdf = gpd.GeoDataFrame(
            {
                'geometry': [Polygon([(0, 0), (100, 0), (100, 100), (0, 100)])],
                'landuse': ['residential'],
            },
            crs='EPSG:32724'
        )
        landuse_gdf = EnvironmentalEngine.extract_land_use(gdf)
        assert not landuse_gdf.empty
        assert landuse_gdf.iloc[0]['landuse_type'] == 'residential'

    def test_land_use_empty_without_column(self):
        from domain.services.environmental_engine import EnvironmentalEngine
        gdf = gpd.GeoDataFrame(
            {'geometry': [Point(0, 0)]},
            crs='EPSG:32724'
        )
        landuse_gdf = EnvironmentalEngine.extract_land_use(gdf)
        assert landuse_gdf.empty

    def test_extractor_resolve_bounds_fallback(self):
        """_resolve_bounds usa raio quando bounds são inválidos."""
        from application.use_cases.environmental_extractor import EnvironmentalExtractorUseCase
        extractor = EnvironmentalExtractorUseCase(
            lat=-22.15018, lon=-42.92185, radius=500
        )
        gdf_empty = gpd.GeoDataFrame(columns=['geometry'])
        gdf_empty = gdf_empty.set_geometry('geometry')
        bounds = extractor._resolve_bounds(gdf_empty)
        # Deve retornar bounds baseado em raio/111320
        assert len(bounds) == 4
        # lon - delta < lon < lon + delta
        assert bounds[0] < -42.92185 < bounds[2]
        assert bounds[1] < -22.15018 < bounds[3]

    def test_process_all_uc_returns_valid_structure_when_apis_offline(self):
        """process_all_conservation_units deve retornar estrutura válida com APIs offline."""
        from domain.services.environmental_engine import EnvironmentalEngine
        import requests

        with patch('infrastructure.adapters.icmbio_api_adapter.requests.get',
                   side_effect=requests.exceptions.Timeout("offline")), \
             patch('infrastructure.adapters.inea_api_adapter.requests.get',
                   side_effect=requests.exceptions.Timeout("offline")):
            result = EnvironmentalEngine.process_all_conservation_units(
                min_lon=-43.0, min_lat=-23.0, max_lon=-42.0, max_lat=-22.0
            )
        assert 'combined_gdf' in result
        assert 'metadata' in result


# ── 3. HydrologyService — Talwegs ────────────────────────────────────────────

class TestHydrologyService:
    """Testa HydrologyService.extract_talwegs() com grade sintética."""

    def _make_valley_grid(self, rows=10, cols=10):
        """Grade em forma de vale (Z alto nas bordas, baixo no centro)."""
        z = np.zeros((rows, cols))
        for r in range(rows):
            for c in range(cols):
                z[r, c] = abs(c - cols // 2) * 2.0  # Vale central
        return z

    def _make_flat_grid(self, rows=10, cols=10):
        return np.ones((rows, cols)) * 100.0

    def test_valley_grid_returns_paths(self):
        from domain.services.hydrology import HydrologyService
        z = self._make_valley_grid()
        paths = HydrologyService.extract_talwegs(z, dx=10.0, dy=10.0, threshold=0.0)
        assert isinstance(paths, list)
        # Um vale claro deve gerar pelo menos alguns talwegs
        assert len(paths) > 0

    def test_flat_grid_no_significant_talwegs(self):
        from domain.services.hydrology import HydrologyService
        z = self._make_flat_grid()
        # Com limiar alto, terreno plano não deve gerar talwegs
        paths = HydrologyService.extract_talwegs(z, dx=10.0, dy=10.0, threshold=1000.0)
        assert isinstance(paths, list)
        assert len(paths) == 0

    def test_each_path_is_two_points(self):
        """Cada segmento de talweg deve ter exatamente 2 pontos [p1, p2]."""
        from domain.services.hydrology import HydrologyService
        z = self._make_valley_grid()
        paths = HydrologyService.extract_talwegs(z, dx=10.0, dy=10.0, threshold=0.0)
        for seg in paths:
            assert len(seg) == 2, "Cada segmento de talweg deve ter 2 pontos"
            assert len(seg[0]) == 2, "Cada ponto deve ter 2 coordenadas [x, y]"
            assert len(seg[1]) == 2


# ── 4. OsmFetcherUseCase — Fetch (mock) ──────────────────────────────────────

class TestOsmFetcherFetch:
    """Testa OsmFetcherUseCase.fetch() com osmnx mockado."""

    def test_fetch_returns_none_on_exception(self):
        from application.use_cases.osm_fetcher import OsmFetcherUseCase
        fetcher = OsmFetcherUseCase(
            lat=-22.15018, lon=-42.92185, radius=100,
            layers_config={'buildings': True}, crs='auto'
        )
        with patch('application.use_cases.osm_fetcher.fetch_osm_data',
                   side_effect=Exception("Rede indisponível")):
            result = fetcher.fetch({'building': True})
        assert result is None

    def test_fetch_circle_calls_with_correct_args(self):
        from application.use_cases.osm_fetcher import OsmFetcherUseCase
        fetcher = OsmFetcherUseCase(
            lat=-22.15018, lon=-42.92185, radius=100,
            layers_config={'buildings': True}, crs='auto',
            selection_mode='circle'
        )
        mock_gdf = gpd.GeoDataFrame({'geometry': [Point(0, 0)]})
        with patch('application.use_cases.osm_fetcher.fetch_osm_data',
                   return_value=mock_gdf) as mock_fn:
            result = fetcher.fetch({'building': True})
        mock_fn.assert_called_once_with(
            -22.15018, -42.92185, 100, {'building': True}, crs='auto'
        )
        assert result is not None
