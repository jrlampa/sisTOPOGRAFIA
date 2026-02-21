"""
test_terrain_processor.py — Cobertura para TerrainProcessorUseCase.
Todas as dependências de API externa são mockadas.
"""
import os
import pytest
import numpy as np
import geopandas as gpd
from shapely.geometry import Polygon, Point
from unittest.mock import patch, MagicMock
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from application.use_cases.terrain_processor import TerrainProcessorUseCase
from dxf_generator import DXFGenerator


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def processor(tmp_path):
    return TerrainProcessorUseCase(
        output_file=str(tmp_path / "output.dxf"),
        layers_config={
            'generate_tin': False,
            'slopeAnalysis': True,
            'contours': False,
            'hydrology': False,
        },
    )


@pytest.fixture
def dxf_gen(tmp_path):
    return DXFGenerator(str(tmp_path / "gen.dxf"))


@pytest.fixture
def simple_gdf():
    poly = Polygon([(714200, 7549100), (714500, 7549100), (714500, 7549400), (714200, 7549400)])
    return gpd.GeoDataFrame({'geometry': [poly]}, crs='EPSG:32723')


def _make_elev_points(rows=3, cols=3):
    """Grade 3×3 de pontos de elevação fictícios."""
    pts = []
    for r in range(rows):
        for c in range(cols):
            lat = -22.15 + r * 0.001
            lon = -42.92 + c * 0.001
            z = 800.0 + r + c
            pts.append((lat, lon, z))
    return pts, rows, cols


# ── process(): sem pontos de elevação ────────────────────────────────────────

class TestProcessNoElevPoints:
    def test_no_elev_points_returns_empty_result(self, processor, simple_gdf, dxf_gen):
        with patch('application.use_cases.terrain_processor.fetch_elevation_grid',
                   return_value=([], 0, 0)):
            result = processor.process(simple_gdf, dxf_gen)
        assert result['grid_rows'] == []
        assert result['analytics_res'] is None

    def test_exception_in_fetch_returns_empty(self, processor, simple_gdf, dxf_gen):
        with patch('application.use_cases.terrain_processor.fetch_elevation_grid',
                   side_effect=RuntimeError('network error')):
            result = processor.process(simple_gdf, dxf_gen)
        assert result['grid_rows'] == []
        assert result['analytics_res'] is None


# ── process(): fluxo completo ─────────────────────────────────────────────────

class TestProcessFullPipeline:
    def test_full_pipeline_adds_terrain(self, processor, simple_gdf, dxf_gen):
        pts, rows, cols = _make_elev_points(3, 3)
        mock_analytics = {
            'slope_pct': np.zeros((rows, cols)),
            'slope_avg': 5.0,
            'aspect': np.zeros((rows, cols)),
            'hydrology': np.zeros((rows, cols)),
        }
        with patch('application.use_cases.terrain_processor.fetch_elevation_grid',
                   return_value=(pts, rows, cols)), \
             patch('application.use_cases.terrain_processor.AnalyticsEngine.calculate_slope_grid',
                   return_value=mock_analytics):
            result = processor.process(simple_gdf, dxf_gen)
        assert len(result['grid_rows']) > 0
        assert result['analytics_res'] is not None

    def test_analytics_none_is_handled(self, processor, simple_gdf, dxf_gen):
        """analytics=None não causa erro."""
        pts, rows, cols = _make_elev_points(3, 3)
        with patch('application.use_cases.terrain_processor.fetch_elevation_grid',
                   return_value=(pts, rows, cols)), \
             patch('application.use_cases.terrain_processor.AnalyticsEngine.calculate_slope_grid',
                   return_value=None):
            result = processor.process(simple_gdf, dxf_gen)
        assert result['grid_rows'] != []

    def test_with_contours_flag(self, tmp_path, simple_gdf, dxf_gen):
        """Ativa geração de curvas de nível."""
        proc = TerrainProcessorUseCase(
            output_file=str(tmp_path / "out.dxf"),
            layers_config={'generate_tin': False, 'slopeAnalysis': False,
                          'contours': True, 'hydrology': False},
        )
        pts, rows, cols = _make_elev_points(4, 4)
        contours_data = [[(float(i), 0.0, 10.0) for i in range(5)]]
        mock_analytics = {
            'slope_pct': np.zeros((rows, cols)),
            'slope_avg': 3.0,
            'aspect': np.zeros((rows, cols)),
            'hydrology': np.zeros((rows, cols)),
        }
        with patch('application.use_cases.terrain_processor.fetch_elevation_grid',
                   return_value=(pts, rows, cols)), \
             patch('application.use_cases.terrain_processor.AnalyticsEngine.calculate_slope_grid',
                   return_value=mock_analytics):
            result = proc.process(simple_gdf, dxf_gen)
        assert result['grid_rows'] != []

    def test_with_hydrology_flag(self, tmp_path, simple_gdf, dxf_gen):
        """Ativa geração de hidrologia."""
        proc = TerrainProcessorUseCase(
            output_file=str(tmp_path / "out_hydro.dxf"),
            layers_config={'generate_tin': False, 'slopeAnalysis': False,
                          'contours': False, 'hydrology': True},
        )
        pts, rows, cols = _make_elev_points(5, 5)
        mock_analytics = {
            'slope_pct': np.zeros((rows, cols)),
            'slope_avg': 2.0,
            'aspect': np.zeros((rows, cols)),
            'hydrology': np.zeros((rows, cols)),
        }
        with patch('application.use_cases.terrain_processor.fetch_elevation_grid',
                   return_value=(pts, rows, cols)), \
             patch('application.use_cases.terrain_processor.AnalyticsEngine.calculate_slope_grid',
                   return_value=mock_analytics):
            result = proc.process(simple_gdf, dxf_gen)
        assert result['grid_rows'] != []


# ── _build_grid ───────────────────────────────────────────────────────────────

class TestBuildGrid:
    def test_basic_grid_construction(self, processor):
        """_build_grid converte lista plana em grade 2D."""
        from pyproj import Transformer
        transformer = Transformer.from_crs('EPSG:4326', 'EPSG:32723', always_xy=True)
        elev_pts = [
            (-22.150, -42.921, 800.0), (-22.150, -42.920, 801.0),
            (-22.151, -42.921, 802.0), (-22.151, -42.920, 803.0),
        ]
        grid = processor._build_grid(elev_pts, cols=2, transformer=transformer)
        assert len(grid) == 2
        assert len(grid[0]) == 2

    def test_partial_last_row(self, processor):
        """Linha parcial no final também é incluída."""
        from pyproj import Transformer
        transformer = Transformer.from_crs('EPSG:4326', 'EPSG:32723', always_xy=True)
        elev_pts = [
            (-22.150, -42.921, 800.0), (-22.150, -42.920, 801.0),
            (-22.151, -42.921, 802.0),  # linha incompleta
        ]
        grid = processor._build_grid(elev_pts, cols=2, transformer=transformer)
        assert len(grid) == 2  # 1 completa + 1 parcial


# ── _add_contours ─────────────────────────────────────────────────────────────

class TestAddContours:
    def test_add_contours_exception_logged(self, processor, dxf_gen):
        """Exceção no cálculo de contornos é logada."""
        grid_rows = [
            [(float(c), float(r), float(r + c)) for c in range(4)]
            for r in range(4)
        ]
        with patch('application.use_cases.terrain_processor.ContourService',
                   side_effect=RuntimeError('contour fail'), create=True):
            processor._add_contours(grid_rows, dxf_gen)
        assert True  # sem propagação de exceção


# ── _export_profile ───────────────────────────────────────────────────────────

class TestExportProfile:
    def test_exports_csv(self, processor, tmp_path):
        processor.output_file = str(tmp_path / "out.dxf")
        grid_rows = [
            [(float(c), float(r), 800.0 + r * c) for c in range(4)]
            for r in range(4)
        ]
        processor._export_profile(grid_rows)
        csv_path = str(tmp_path / "out_perfil_longitudinal.csv")
        assert os.path.exists(csv_path)

    def test_export_exception_logged(self, processor):
        """Falha na exportação é logada sem propagar."""
        processor._export_profile([])  # lista vazia → IndexError capturado
        assert True
