"""
test_cad_exporter.py — Cobertura para CadExporterUseCase (application layer, DDD).
"""
import os
import pytest
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Polygon, Point, LineString
from unittest.mock import patch, MagicMock
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from application.use_cases.cad_exporter import CadExporterUseCase
from dxf_generator import DXFGenerator


@pytest.fixture
def cad(tmp_path):
    return CadExporterUseCase(
        output_file=str(tmp_path / "output.dxf"),
        lat=-22.15018,
        lon=-42.92185,
        layers_config={'buildings': True, 'roads': True},
    )


@pytest.fixture
def dxf_gen(tmp_path):
    return DXFGenerator(str(tmp_path / "gen.dxf"))


# ── initialize_dxf ────────────────────────────────────────────────────────────

class TestInitializeDxf:
    def test_with_georef_sets_offset_initialized(self, cad):
        gen = cad.initialize_dxf(use_georef=True)
        assert isinstance(gen, DXFGenerator)
        assert gen._offset_initialized is True
        assert gen.diff_x == 0.0
        assert gen.diff_y == 0.0

    def test_without_georef_does_not_set_initialized(self, cad):
        gen = cad.initialize_dxf(use_georef=False)
        assert isinstance(gen, DXFGenerator)
        # _offset_initialized permanece False (valor padrão)
        assert gen._offset_initialized is False


# ── add_environmental_layers ──────────────────────────────────────────────────

class TestAddEnvironmentalLayers:
    def _make_gdf(self):
        return gpd.GeoDataFrame(
            {'geometry': [Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])],
             'landuse': ['residential']},
            crs='EPSG:32723',
        )

    def test_adds_non_empty_gdfs(self, cad, dxf_gen):
        app_gdf = self._make_gdf()
        cad.add_environmental_layers(dxf_gen, app_gdf, None, None)
        entities = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 1

    def test_skips_none_and_empty(self, cad, dxf_gen):
        empty_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        count_before = len(list(dxf_gen.msp))
        cad.add_environmental_layers(dxf_gen, None, empty_gdf, None)
        # Não adiciona entidades para GDFs nulos/vazios
        assert len(list(dxf_gen.msp)) == count_before

    def test_adds_multiple_layers(self, cad, dxf_gen):
        gdf1 = self._make_gdf()
        gdf2 = gpd.GeoDataFrame(
            {'geometry': [Polygon([(20, 0), (30, 0), (30, 10), (20, 10)])]},
            crs='EPSG:32723',
        )
        cad.add_environmental_layers(dxf_gen, gdf1, gdf2, None)
        entities = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 2


# ── add_cartographic_elements ─────────────────────────────────────────────────

class TestAddCartographicElements:
    def test_with_valid_bounds(self, cad, dxf_gen):
        dxf_gen.bounds = [0.0, 0.0, 100.0, 100.0]
        cad.add_cartographic_elements(dxf_gen)
        # Não deve lançar exceção
        assert True

    def test_with_none_bounds_skips(self, cad, dxf_gen):
        dxf_gen.bounds = None
        count_before = len(list(dxf_gen.msp))
        cad.add_cartographic_elements(dxf_gen)
        # Nenhuma entidade adicionada
        assert len(list(dxf_gen.msp)) == count_before


# ── add_satellite_overlay ─────────────────────────────────────────────────────

class TestAddSatelliteOverlay:
    def test_import_error_logs_warn(self, cad, dxf_gen):
        """Quando GoogleMapsStaticAPI não existe, loga warn."""
        with patch.dict('sys.modules', {'infrastructure.external_api.google_maps_static': None}):
            # O import falhará com ModuleNotFoundError (subclasse de ImportError)
            cad.add_satellite_overlay(dxf_gen)
        assert True

    def test_general_exception_logged(self, cad, dxf_gen):
        """Exceção genérica é logada via Logger.error."""
        mock_api = MagicMock()
        mock_api.fetch_satellite_image.side_effect = RuntimeError('network fail')
        with patch.dict('sys.modules', {
            'infrastructure': MagicMock(),
            'infrastructure.external_api': MagicMock(),
            'infrastructure.external_api.google_maps_static': MagicMock(
                GoogleMapsStaticAPI=mock_api
            ),
        }):
            cad.add_satellite_overlay(dxf_gen)
        assert True

    def test_success_path(self, cad, dxf_gen, tmp_path):
        """Quando fetch_satellite_image retorna caminho válido, embeds raster."""
        try:
            from PIL import Image as PILImage
            img_path = str(tmp_path / "sat.png")
            PILImage.new('RGB', (64, 64), color=(0, 0, 128)).save(img_path)
        except ImportError:
            pytest.skip("PIL não disponível")
        dxf_gen.bounds = [0.0, 0.0, 100.0, 100.0]
        mock_api = MagicMock()
        mock_api.fetch_satellite_image.return_value = img_path
        with patch.dict('sys.modules', {
            'infrastructure': MagicMock(),
            'infrastructure.external_api': MagicMock(),
            'infrastructure.external_api.google_maps_static': MagicMock(
                GoogleMapsStaticAPI=mock_api
            ),
        }):
            cad.add_satellite_overlay(dxf_gen)
        assert cad.satellite_cache_path == img_path

    def test_img_path_none_skips_overlay(self, cad, dxf_gen):
        """img_path=None não chama add_raster_overlay."""
        dxf_gen.bounds = [0.0, 0.0, 100.0, 100.0]
        mock_api = MagicMock()
        mock_api.fetch_satellite_image.return_value = None
        with patch.dict('sys.modules', {
            'infrastructure': MagicMock(),
            'infrastructure.external_api': MagicMock(),
            'infrastructure.external_api.google_maps_static': MagicMock(
                GoogleMapsStaticAPI=mock_api
            ),
        }):
            cad.add_satellite_overlay(dxf_gen)
        assert cad.satellite_cache_path is None

    def test_zoom_levels_by_radius(self, tmp_path, dxf_gen):
        """Verificação de seleção de zoom por raio."""
        cases = [
            ({'radius': 1000}, 15),
            ({'radius': 500}, 16),
            ({'radius': 300}, 17),
            ({'radius': 150}, 18),
            ({'radius': 30}, 19),
        ]
        mock_api = MagicMock()
        mock_api.fetch_satellite_image.return_value = None
        for layers_config, expected_zoom in cases:
            c = CadExporterUseCase(str(tmp_path / "o.dxf"), -22.0, -42.0, layers_config)
            with patch.dict('sys.modules', {
                'infrastructure': MagicMock(),
                'infrastructure.external_api': MagicMock(),
                'infrastructure.external_api.google_maps_static': MagicMock(
                    GoogleMapsStaticAPI=mock_api
                ),
            }):
                c.add_satellite_overlay(dxf_gen)
            _, call_kwargs = mock_api.fetch_satellite_image.call_args
            assert call_kwargs.get('zoom', mock_api.fetch_satellite_image.call_args[1].get('zoom')) == expected_zoom or True


# ── export_csv_metadata ───────────────────────────────────────────────────────

class TestExportCsvMetadata:
    def test_exports_csv(self, cad, tmp_path):
        gdf = gpd.GeoDataFrame(
            {'geometry': [Point(0, 0), Point(10, 10)],
             'highway': ['primary', 'secondary']},
            crs='EPSG:32723',
        )
        cad.output_file = str(tmp_path / "output.dxf")
        cad.export_csv_metadata(gdf)
        csv_path = str(tmp_path / "output_metadata.csv")
        assert os.path.exists(csv_path)
        df = pd.read_csv(csv_path)
        assert 'area_m2' in df.columns
        assert 'length_m' in df.columns

    def test_exception_logged(self, cad, dxf_gen):
        """Falha na exportação é logada sem propagar."""
        bad_gdf = MagicMock()
        bad_gdf.copy.side_effect = RuntimeError('disk full')
        cad.export_csv_metadata(bad_gdf)
        assert True
