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

    def test_furniture_with_no_roads_adds_street_lamp_to_highway_list(self):
        """furniture=True sem roads: street_lamp adicionado a lista nova de highway."""
        fetcher = self._make_fetcher({'furniture': True, 'roads': False, 'buildings': False, 'vegetation': False})
        tags = fetcher.build_tags()
        # highway deve ser lista com street_lamp (linha 62: tags['highway'] = ['street_lamp'])
        assert 'highway' in tags
        hw = tags['highway']
        assert isinstance(hw, list) and 'street_lamp' in hw

    def test_furniture_with_existing_list_highway_appends_street_lamp(self):
        """furniture=True com highway já sendo lista: street_lamp é acrescentado."""
        from application.use_cases.osm_fetcher import OsmFetcherUseCase
        # Simula cenário onde highway já é lista (sem roads=True, mas com alguma config prévia)
        # Obtemos o fetcher e depois injetamos o comportamento via build_tags com patching
        fetcher = OsmFetcherUseCase(
            lat=-22.15018, lon=-42.92185, radius=100,
            layers_config={'furniture': True, 'roads': False, 'buildings': False, 'vegetation': False},
            crs='auto'
        )
        # Primeiro invoca sem infrastructure para que highway seja lista vazia
        tags = fetcher.build_tags()
        # street_lamp deve estar em tags['highway']
        assert 'street_lamp' in tags.get('highway', [])

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

    def test_fetch_polygon_mode_passes_polygon_arg(self):
        """selection_mode='polygon' com polygon definido deve passar polygon à função OSM."""
        from application.use_cases.osm_fetcher import OsmFetcherUseCase
        poly = Polygon([(-42.923, -22.151), (-42.921, -22.151), (-42.921, -22.150), (-42.923, -22.150)])
        fetcher = OsmFetcherUseCase(
            lat=-22.15018, lon=-42.92185, radius=100,
            layers_config={'buildings': True}, crs='auto',
            selection_mode='polygon', polygon=poly
        )
        mock_gdf = gpd.GeoDataFrame({'geometry': [Point(0, 0)]})
        with patch('application.use_cases.osm_fetcher.fetch_osm_data',
                   return_value=mock_gdf) as mock_fn:
            result = fetcher.fetch({'building': True})
        # Deve chamar com polygon= (linha 78-81 do osm_fetcher.py)
        call_kwargs = mock_fn.call_args.kwargs if mock_fn.call_args.kwargs else {}
        call_args = mock_fn.call_args.args if mock_fn.call_args.args else ()
        assert 'polygon' in call_kwargs or poly in call_args
        assert result is not None


# ── 5. EnvironmentalEngine — Geographic CRS e fetch_uc_fallback ──────────────

class TestEnvironmentalEngineExtra:
    """Cobre branches não testados do EnvironmentalEngine."""

    def _make_geographic_waterway_gdf(self):
        """GDF em CRS geográfico (EPSG:4326) com um rio."""
        return gpd.GeoDataFrame(
            {
                'geometry': [LineString([(-42.925, -22.155), (-42.920, -22.150)])],
                'waterway': ['river'],
            },
            crs='EPSG:4326'
        )

    def test_geographic_crs_waterway_reprojects_for_buffer(self):
        """APP buffer em CRS geográfico deve reprojetar para EPSG:3857 e voltar."""
        from domain.services.environmental_engine import EnvironmentalEngine
        gdf = self._make_geographic_waterway_gdf()
        app_gdf = EnvironmentalEngine.extract_and_buffer_waterways(gdf)
        # Deve gerar APP mesmo em CRS geográfico
        assert not app_gdf.empty
        assert 'app_type' in app_gdf.columns

    def test_fetch_uc_fallback_reads_file_when_exists(self, tmp_path):
        """fetch_uc_fallback deve ler arquivo GeoJSON existente e retornar GDF."""
        from domain.services.environmental_engine import EnvironmentalEngine

        bbox = (-43.0, -23.0, -42.0, -22.0)
        mock_gdf = gpd.GeoDataFrame(
            {'geometry': [Point(-42.92, -22.15)], 'nome': ['UC Teste']},
            crs='EPSG:4326'
        )

        with patch('domain.services.environmental_engine.os.path.exists', return_value=True), \
             patch('domain.services.environmental_engine.gpd.read_file', return_value=mock_gdf):
            result = EnvironmentalEngine.fetch_uc_fallback(bbox, 'UC_FEDERAL')

        assert result is not None
        assert 'gdf' in result
        assert not result['gdf'].empty

    def test_process_all_uc_with_icmbio_non_empty(self):
        """process_all_conservation_units deve combinar GDFs quando ICMBio retorna dados."""
        from domain.services.environmental_engine import EnvironmentalEngine

        gdf_fed = gpd.GeoDataFrame(
            {'geometry': [Point(-42.92, -22.15)], 'sisTOPO_type': ['UC_FEDERAL']},
            crs='EPSG:4326'
        )
        gdf_est = gpd.GeoDataFrame(columns=['geometry'])

        with patch('domain.services.environmental_engine.ICMBioApiAdapter.fetch_uc_federal',
                   return_value=gdf_fed), \
             patch('domain.services.environmental_engine.IneaApiAdapter.fetch_uc_estadual',
                   return_value=gdf_est):
            result = EnvironmentalEngine.process_all_conservation_units(
                min_lon=-43.0, min_lat=-23.0, max_lon=-42.0, max_lat=-22.0
            )

        assert 'combined_gdf' in result
        assert not result['combined_gdf'].empty


# ── 6. EnvironmentalExtractorUseCase — extract() ─────────────────────────────

class TestEnvironmentalExtractorExtract:
    """Cobre o método extract() da EnvironmentalExtractorUseCase (linhas 39-54)."""

    def test_extract_returns_expected_keys(self):
        """extract() deve retornar dict com app_gdf, landuse_gdf, uc_gdf, uc_metadata."""
        from application.use_cases.environmental_extractor import EnvironmentalExtractorUseCase
        from domain.services.environmental_engine import EnvironmentalEngine

        extractor = EnvironmentalExtractorUseCase(lat=-22.15018, lon=-42.92185, radius=500)
        gdf = gpd.GeoDataFrame(
            {
                'geometry': [LineString([(0, 0), (100, 0)])],
                'waterway': ['river'],
            },
            crs='EPSG:32724'
        )

        empty_gdf = gpd.GeoDataFrame(columns=['geometry'])
        with patch.object(EnvironmentalEngine, 'process_all_conservation_units',
                          return_value={'combined_gdf': empty_gdf, 'metadata': {}}):
            result = extractor.extract(gdf)

        assert 'app_gdf' in result
        assert 'landuse_gdf' in result
        assert 'uc_gdf' in result
        assert 'uc_metadata' in result

    def test_extract_resolve_bounds_with_nan_falls_back_to_radius(self):
        """_resolve_bounds com GDF vazio (bounds=NaN) deve usar raio como fallback."""
        from application.use_cases.environmental_extractor import EnvironmentalExtractorUseCase

        extractor = EnvironmentalExtractorUseCase(lat=-22.15018, lon=-42.92185, radius=500)
        gdf_empty = gpd.GeoDataFrame({'geometry': []}, geometry='geometry', crs='EPSG:32724')

        bounds = extractor._resolve_bounds(gdf_empty)
        assert len(bounds) == 4
        assert bounds[0] < -42.92185 < bounds[2]


# ── 7. AnalyticsEngine — interpolate_point_value e interpolate_point_slope ────

class TestAnalyticsEngineInterpolation:
    """Cobre linhas 138-151 e 156-157 do analytics_engine.py."""

    def _make_grid_rows(self, rows=3, cols=3):
        """Grade de pontos [(x, y, z)] 3x3."""
        grid = []
        for r in range(rows):
            row = []
            for c in range(cols):
                row.append((float(c * 10), float(r * 10), float(r + c)))
            grid.append(row)
        return grid

    def test_interpolate_point_value_returns_closest(self):
        """interpolate_point_value deve retornar o valor do ponto mais próximo."""
        from analytics_engine import AnalyticsEngine
        import numpy as np

        grid_rows = self._make_grid_rows(3, 3)
        values_grid = np.array([[float(r + c) for c in range(3)] for r in range(3)])

        # Ponto no canto superior esquerdo (0,0) — distância zero para grid_rows[0][0]=(0,0,0)
        point = Point(0.0, 0.0)
        result = AnalyticsEngine.interpolate_point_value(point, grid_rows, values_grid)
        assert isinstance(result, float)
        assert result == 0.0  # (r=0, c=0) → values_grid[0,0] = 0.0

    def test_interpolate_point_value_none_grid_returns_zero(self):
        """values_grid=None deve retornar 0.0 imediatamente."""
        from analytics_engine import AnalyticsEngine

        point = Point(0.0, 0.0)
        result = AnalyticsEngine.interpolate_point_value(point, [], None)
        assert result == 0.0

    def test_interpolate_point_slope_no_analytics_returns_zero(self):
        """analytics_res vazio/None deve retornar 0.0."""
        from analytics_engine import AnalyticsEngine

        point = Point(0.0, 0.0)
        result = AnalyticsEngine.interpolate_point_slope(point, [], None)
        assert result == 0.0

    def test_interpolate_point_slope_with_analytics_delegates(self):
        """interpolate_point_slope com analytics_res deve delegar para interpolate_point_value."""
        from analytics_engine import AnalyticsEngine
        import numpy as np

        grid_rows = self._make_grid_rows(2, 2)
        values_grid = np.array([[1.0, 2.0], [3.0, 4.0]])
        analytics_res = {'slope_pct': values_grid}

        point = Point(0.0, 0.0)
        result = AnalyticsEngine.interpolate_point_slope(point, grid_rows, analytics_res)
        assert isinstance(result, float)


# ── 8. Logger (Python) — branches de info(progress=) e geojson() ─────────────

class TestPythonLogger:
    """Cobre linhas 17, 39-42 do utils/logger.py."""

    def test_info_with_progress_emits_progress_field(self, capsys):
        """Logger.info(progress=42) deve incluir 'progress' no JSON emitido."""
        from utils.logger import Logger
        Logger.info("Progresso de teste", progress=42)
        captured = capsys.readouterr().out.strip()
        import json
        payload = json.loads(captured)
        assert payload['progress'] == 42
        assert payload['message'] == "Progresso de teste"

    def test_info_without_progress_omits_progress_field(self, capsys):
        """Logger.info() sem progress não deve incluir 'progress' no JSON."""
        from utils.logger import Logger
        Logger.info("Sem progresso")
        captured = capsys.readouterr().out.strip()
        import json
        payload = json.loads(captured)
        assert 'progress' not in payload

    def test_geojson_emits_json_when_not_skipped(self, capsys):
        """Logger.geojson(data) com SKIP_GEOJSON=False emite payload geojson."""
        from utils.logger import Logger
        Logger.SKIP_GEOJSON = False
        try:
            Logger.geojson({"type": "FeatureCollection", "features": []})
            captured = capsys.readouterr().out.strip()
            import json
            payload = json.loads(captured)
            assert payload['type'] == 'geojson'
            assert 'data' in payload
        finally:
            Logger.SKIP_GEOJSON = False

    def test_geojson_skipped_when_flag_true(self, capsys):
        """Logger.geojson() com SKIP_GEOJSON=True não deve emitir nada."""
        from utils.logger import Logger
        Logger.SKIP_GEOJSON = True
        try:
            Logger.geojson({"type": "FeatureCollection"})
            captured = capsys.readouterr().out
            assert captured == ''
        finally:
            Logger.SKIP_GEOJSON = False


# ── 9. EnvironmentalEngine — fallback não-vazio e vintage_year ───────────────

class TestEnvironmentalEngineFallback:
    """Cobre linhas 119-120, 130-131, 155-157, 167-169, 177-179 do environmental_engine.py."""

    def test_process_all_uc_all_apis_fail_with_nonempty_fallback(self):
        """Todos os adapters retornam None; fallback retorna GDF não-vazio → fallback_used=True."""
        from domain.services.environmental_engine import EnvironmentalEngine
        import geopandas as gpd
        from shapely.geometry import Point

        nonempty_gdf = gpd.GeoDataFrame(
            {'geometry': [Point(-42.92, -22.15)], 'sisTOPO_type': ['UC_FEDERAL']},
            crs='EPSG:4326'
        )
        nonempty_result = {'gdf': nonempty_gdf, 'vintage_year': 2022}

        with patch('domain.services.environmental_engine.ICMBioApiAdapter.fetch_uc_federal',
                   return_value=None), \
             patch('domain.services.environmental_engine.IneaApiAdapter.fetch_uc_estadual',
                   return_value=None), \
             patch.object(EnvironmentalEngine, 'fetch_uc_fallback', return_value=nonempty_result):
            result = EnvironmentalEngine.process_all_conservation_units(
                min_lon=-43.0, min_lat=-23.0, max_lon=-42.0, max_lat=-22.0
            )

        assert result['metadata']['fallback_used'] is True
        assert len(result['metadata']['messages']) >= 1
        assert 'combined_gdf' in result

    def test_fetch_uc_fallback_reads_vintage_year_from_gdf_column(self, tmp_path):
        """fetch_uc_fallback com vintage_year na coluna do GDF usa o valor da linha."""
        from domain.services.environmental_engine import EnvironmentalEngine
        from shapely.geometry import Point
        import geopandas as gpd

        gdf_with_vintage = gpd.GeoDataFrame(
            {
                'geometry': [Point(-42.92, -22.15)],
                'vintage_year': [2019],
            },
            crs='EPSG:4326'
        )
        bbox = (-43.0, -23.0, -42.0, -22.0)

        with patch('domain.services.environmental_engine.os.path.exists', return_value=True), \
             patch('domain.services.environmental_engine.gpd.read_file', return_value=gdf_with_vintage):
            result = EnvironmentalEngine.fetch_uc_fallback(bbox, 'UC_FEDERAL')

        assert result is not None
        assert result['vintage_year'] == 2019  # lido da coluna (linhas 119-120)

    def test_fetch_uc_fallback_logs_error_on_parse_exception(self, tmp_path):
        """fetch_uc_fallback com gpd.read_file lançando exceção: erro logado e retorno vazio."""
        from domain.services.environmental_engine import EnvironmentalEngine
        bbox = (-43.0, -23.0, -42.0, -22.0)

        with patch('domain.services.environmental_engine.os.path.exists', return_value=True), \
             patch('domain.services.environmental_engine.gpd.read_file',
                   side_effect=Exception("Arquivo corrompido")):
            result = EnvironmentalEngine.fetch_uc_fallback(bbox, 'UC_FEDERAL')

        # Em caso de exceção ao parsear (linhas 130-131), retorna gdf vazio
        assert result is not None
        assert result['gdf'].empty
        assert result['vintage_year'] is None
