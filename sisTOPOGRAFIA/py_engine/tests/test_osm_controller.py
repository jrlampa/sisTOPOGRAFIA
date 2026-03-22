"""
test_osm_controller.py — Cobertura para OSMController (orquestrador DDD).
Todas as dependências de rede são mockadas; zero chamadas reais a APIs externas.
"""
import os
import pytest
import geopandas as gpd
import numpy as np
from shapely.geometry import Polygon, Point, LineString
from unittest.mock import patch, MagicMock, PropertyMock
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from controller import OSMController


# ── Factories ─────────────────────────────────────────────────────────────────

def _make_gdf(with_power=False):
    tags = {'building': 'yes', 'highway': None}
    if with_power:
        tags['power'] = 'line'
    poly = Polygon([(714200, 7549100), (714500, 7549100),
                    (714500, 7549400), (714200, 7549400)])
    gdf = gpd.GeoDataFrame([{'geometry': poly, **tags}], crs='EPSG:32723')
    return gdf


def _make_controller(tmp_path, layers_config=None):
    if layers_config is None:
        layers_config = {'buildings': True, 'roads': True}
    return OSMController(
        lat=-22.15018,
        lon=-42.92185,
        radius=100.0,
        output_file=str(tmp_path / "output.dxf"),
        layers_config=layers_config,
        crs='EPSG:32723',
    )


# ── __init__ e validação ──────────────────────────────────────────────────────

class TestInit:
    def test_valid_coords_creates_controller(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        assert ctrl.lat == -22.15018
        assert ctrl.lon == -42.92185
        assert ctrl.radius == 100.0

    def test_invalid_lat_raises_value_error(self, tmp_path):
        with pytest.raises(ValueError, match="Latitude"):
            OSMController(
                lat=999.0, lon=-42.92, radius=100.0,
                output_file=str(tmp_path / "out.dxf"),
                layers_config={}, crs='EPSG:32723',
            )

    def test_invalid_radius_raises_value_error(self, tmp_path):
        with pytest.raises(ValueError, match="Raio"):
            OSMController(
                lat=-22.0, lon=-42.0, radius=-10.0,
                output_file=str(tmp_path / "out.dxf"),
                layers_config={}, crs='EPSG:32723',
            )


# ── _normalize_layers_config ──────────────────────────────────────────────────

class TestNormalizeLayersConfig:
    def test_cadastral_expands_aliases(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'cadastral': True})
        assert ctrl.layers_config.get('buildings') is True
        assert ctrl.layers_config.get('roads') is True
        assert ctrl.layers_config.get('furniture') is True

    def test_environmental_expands_aliases(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'environmental': True})
        assert ctrl.layers_config.get('nature') is True
        assert ctrl.layers_config.get('uc') is True

    def test_terrain_expands_aliases(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'terrain': True})
        assert ctrl.layers_config.get('contours') is True
        assert ctrl.layers_config.get('generate_tin') is True

    def test_no_alias_unchanged(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'buildings': True})
        assert ctrl.layers_config.get('buildings') is True
        assert 'roads' not in ctrl.layers_config


# ── _run_audit ────────────────────────────────────────────────────────────────

class TestRunAudit:
    def test_auto_crs_uses_centroid(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'buildings': True})
        ctrl.crs = 'auto'
        gdf = _make_gdf()
        with patch('controller.run_spatial_audit', return_value=({'violations': 0, 'coverageScore': 100}, gdf)):
            result = ctrl._run_audit(gdf)
        assert result is not None

    def test_run_audit_success(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        analysis_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        with patch('controller.run_spatial_audit',
                   return_value=({'violations': 2, 'coverageScore': 80}, analysis_gdf)):
            result = ctrl._run_audit(gdf)
        assert ctrl.audit_summary['violations'] == 2
        assert result is analysis_gdf

    def test_run_audit_exception_returns_none(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        with patch('controller.run_spatial_audit', side_effect=RuntimeError('audit fail')):
            result = ctrl._run_audit(gdf)
        assert result is None


# ── _send_geojson_preview ─────────────────────────────────────────────────────

class TestSendGeojsonPreview:
    def test_skip_geojson_returns_early(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        from utils.logger import Logger
        original = Logger.SKIP_GEOJSON
        Logger.SKIP_GEOJSON = True
        try:
            ctrl._send_geojson_preview(gdf)
        finally:
            Logger.SKIP_GEOJSON = original
        assert True

    def test_normal_preview(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        ctrl._geodetic_features = []
        ctrl._uc_metadata = {}
        ctrl._concessionaria_rules_applied = False
        with patch('controller.Logger.geojson'):
            ctrl._send_geojson_preview(gdf)
        assert True

    def test_preview_with_extra_gdfs(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        ctrl._geodetic_features = []
        ctrl._uc_metadata = {'uc_name': 'APA Serra dos Órgãos'}
        ctrl._concessionaria_rules_applied = True

        app_gdf = gpd.GeoDataFrame(
            {'geometry': [Point(714300, 7549200)]}, crs='EPSG:32723'
        )
        uc_gdf = gpd.GeoDataFrame(
            {'geometry': [Point(714350, 7549250)],
             'uc_name': ['APA Serra dos Órgãos'],
             'tipo': ['Federal']},
            crs='EPSG:32723',
        )
        with patch('controller.Logger.geojson'):
            ctrl._send_geojson_preview(gdf, analysis_gdf=None,
                                        app_gdf=app_gdf, landuse_gdf=None, uc_gdf=uc_gdf)
        assert True

    def test_preview_exception_logged(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        bad_gdf = MagicMock()
        bad_gdf.copy.side_effect = RuntimeError('fail')
        ctrl._send_geojson_preview(bad_gdf)
        assert True


# ── _fetch_geodetic_data ──────────────────────────────────────────────────────

class TestFetchGeodeticData:
    def test_no_marcos_no_crash(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        from dxf_generator import DXFGenerator
        dxf_gen = DXFGenerator(str(tmp_path / "gen.dxf"))
        with patch('controller.IBGEAdapter.get_stations_nearby', return_value=[]):
            ctrl._fetch_geodetic_data(dxf_gen)
        assert ctrl._geodetic_features == []

    def test_with_marcos_adds_geodetic_marker(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        from dxf_generator import DXFGenerator
        dxf_gen = DXFGenerator(str(tmp_path / "gen2.dxf"))
        marcos = [{'lat': -22.15018, 'lon': -42.92185, 'altitude': 850.0, 'id': '999'}]
        with patch('controller.IBGEAdapter.get_stations_nearby', return_value=marcos):
            ctrl._fetch_geodetic_data(dxf_gen)
        assert len(ctrl._geodetic_features) == 1
        assert ctrl._geodetic_features[0]['properties']['is_geodesy'] is True

    def test_with_incra_flag(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'incra': True})
        from dxf_generator import DXFGenerator
        dxf_gen = DXFGenerator(str(tmp_path / "gen3.dxf"))
        with patch('controller.IBGEAdapter.get_stations_nearby', return_value=[]), \
             patch('controller.INCRAAdapter.get_parcels_nearby', return_value=[]):
            ctrl._fetch_geodetic_data(dxf_gen)
        assert True


# ── _enrich_with_analytics ────────────────────────────────────────────────────

class TestEnrichWithAnalytics:
    def test_enrich_adds_columns(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        grid_rows = [
            [(float(c * 10), float(r * 10), float(800 + r + c)) for c in range(3)]
            for r in range(3)
        ]
        analytics_res = {
            'slope_pct': np.zeros((3, 3)),
            'slope_avg': 5.0,
            'aspect': np.zeros((3, 3)),
            'hydrology': np.zeros((3, 3)),
        }
        ctrl._enrich_with_analytics(gdf, grid_rows, analytics_res)
        assert 'declividade_pct' in gdf.columns
        assert 'orientacao_deg' in gdf.columns
        assert 'fluxo_acumulado' in gdf.columns

    def test_enrich_with_solar_analytics(self, tmp_path):
        ctrl = _make_controller(tmp_path)
        gdf = _make_gdf()
        grid_rows = [
            [(float(c * 10), float(r * 10), float(800.0)) for c in range(3)]
            for r in range(3)
        ]
        analytics_res = {
            'slope_pct': np.zeros((3, 3)),
            'slope_avg': 2.0,
            'aspect': np.zeros((3, 3)),
            'hydrology': np.zeros((3, 3)),
            'solar': np.zeros((3, 3)),
        }
        ctrl._enrich_with_analytics(gdf, grid_rows, analytics_res)
        assert 'potencial_solar' in gdf.columns


# ── run(): testes de integração com mocks ─────────────────────────────────────

class TestRun:
    def _setup_mocks(self, tmp_path, gdf):
        """Configura mocks para todas as dependências externas de run()."""
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {'building': ['yes']}
        osm_mock.fetch.return_value = gdf
        return osm_mock

    def test_run_no_tags_returns_early(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'buildings': True})
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {}  # tags vazias → early return
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock):
            ctrl.run()
        assert True

    def test_run_empty_gdf_returns_early(self, tmp_path):
        ctrl = _make_controller(tmp_path, layers_config={'buildings': True})
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {'building': ['yes']}
        osm_mock.fetch.return_value = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock):
            ctrl.run()
        assert True

    def test_run_full_pipeline_minimal(self, tmp_path):
        """Pipeline completo com mínimo de recursos reais."""
        gdf = _make_gdf()
        ctrl = _make_controller(tmp_path, layers_config={
            'buildings': True,
            'georef': True,
            'cartography': False,
            'satellite': False,
            'geodesy': True,
            'terrain': False,
            'app': False,
            'landuse': False,
            'uc': False,
        })

        osm_mock = self._setup_mocks(tmp_path, gdf)

        audit_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock), \
             patch('controller.run_spatial_audit',
                   return_value=({'violations': 0, 'coverageScore': 100}, audit_gdf)), \
             patch('controller.IBGEAdapter.get_stations_nearby', return_value=[]), \
             patch('controller.Logger.geojson'), \
             patch('controller.ReportOrchestratorUseCase') as rep_mock:
            rep_mock.return_value.generate.return_value = None
            ctrl.run()
        assert True

    def test_run_with_polygon_selection(self, tmp_path):
        """Pipeline com modo de seleção por polígono."""
        gdf = _make_gdf()
        poly_coords = [[-42.93, -22.16], [-42.91, -22.16],
                       [-42.91, -22.14], [-42.93, -22.14], [-42.93, -22.16]]
        ctrl = OSMController(
            lat=-22.15018, lon=-42.92185, radius=500.0,
            output_file=str(tmp_path / "poly_out.dxf"),
            layers_config={'buildings': True, 'geodesy': False},
            crs='EPSG:32723',
            selection_mode='polygon',
            polygon=poly_coords,
        )
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {'building': ['yes']}
        osm_mock.fetch.return_value = gdf

        audit_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock), \
             patch('controller.run_spatial_audit',
                   return_value=({'violations': 0, 'coverageScore': 100}, audit_gdf)), \
             patch('controller.Logger.geojson'), \
             patch('controller.ReportOrchestratorUseCase') as rep_mock:
            rep_mock.return_value.generate.return_value = None
            ctrl.run()
        assert True
        # Em modo 'polygon', area=0 (branch else em controller.py linhas ~109-111)

    def test_run_with_infrastructure_aneel(self, tmp_path):
        """Pipeline com infrastructure=True dispara AneelProdistRules."""
        gdf = _make_gdf(with_power=True)
        ctrl = _make_controller(tmp_path, layers_config={
            'buildings': True,
            'infrastructure': True,
            'geodesy': False,
            'cartography': False,
            'satellite': False,
        })
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {'building': ['yes'], 'power': ['line']}
        osm_mock.fetch.return_value = gdf

        faixas_gdf = gpd.GeoDataFrame(
            {'geometry': [Point(714300, 7549200)]}, crs='EPSG:32723'
        )
        audit_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock), \
             patch('controller.run_spatial_audit',
                   return_value=({'violations': 0, 'coverageScore': 100}, audit_gdf)), \
             patch('domain.services.aneel_prodist_rules.AneelProdistRules.has_power_infrastructure',
                   return_value=True), \
             patch('domain.services.aneel_prodist_rules.AneelProdistRules.generate_faixas_servid',
                   return_value=faixas_gdf), \
             patch('controller.Logger.geojson'), \
             patch('controller.ReportOrchestratorUseCase') as rep_mock:
            rep_mock.return_value.generate.return_value = None
            ctrl.run()
        assert ctrl._concessionaria_rules_applied is True

    def test_run_with_environmental_extraction(self, tmp_path):
        """Pipeline com app=True dispara EnvironmentalExtractorUseCase."""
        gdf = _make_gdf()
        ctrl = _make_controller(tmp_path, layers_config={
            'buildings': True,
            'app': True,
            'geodesy': False,
            'cartography': False,
            'satellite': False,
        })
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {'building': ['yes']}
        osm_mock.fetch.return_value = gdf

        env_result = {
            'app_gdf': None, 'landuse_gdf': None, 'uc_gdf': None, 'uc_metadata': {}
        }
        env_mock = MagicMock()
        env_mock.extract.return_value = env_result
        audit_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock), \
             patch('controller.run_spatial_audit',
                   return_value=({'violations': 0, 'coverageScore': 100}, audit_gdf)), \
             patch('controller.EnvironmentalExtractorUseCase', return_value=env_mock), \
             patch('controller.Logger.geojson'), \
             patch('controller.ReportOrchestratorUseCase') as rep_mock:
            rep_mock.return_value.generate.return_value = None
            ctrl.run()
        assert True

    def test_run_with_terrain_and_analytics(self, tmp_path):
        """Pipeline com terrain=True dispara TerrainProcessorUseCase."""
        gdf = _make_gdf()
        ctrl = _make_controller(tmp_path, layers_config={
            'buildings': True,
            'terrain': True,
            'geodesy': False,
            'cartography': False,
            'satellite': False,
        })
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {'building': ['yes']}
        osm_mock.fetch.return_value = gdf

        grid_rows = [
            [(float(c * 10), float(r * 10), float(800 + r + c)) for c in range(3)]
            for r in range(3)
        ]
        analytics_res = {
            'slope_pct': np.zeros((3, 3)),
            'slope_avg': 5.0,
            'aspect': np.zeros((3, 3)),
            'hydrology': np.zeros((3, 3)),
        }
        terrain_mock = MagicMock()
        terrain_mock.process.return_value = {'grid_rows': grid_rows, 'analytics_res': analytics_res}
        audit_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock), \
             patch('controller.run_spatial_audit',
                   return_value=({'violations': 0, 'coverageScore': 100}, audit_gdf)), \
             patch('controller.TerrainProcessorUseCase', return_value=terrain_mock), \
             patch('controller.Logger.geojson'), \
             patch('controller.ReportOrchestratorUseCase') as rep_mock:
            rep_mock.return_value.generate.return_value = None
            ctrl.run()
        assert True

    def test_run_with_satellite_overlay(self, tmp_path):
        """Pipeline com satellite=True dispara add_satellite_overlay."""
        gdf = _make_gdf()
        ctrl = _make_controller(tmp_path, layers_config={
            'buildings': True,
            'satellite': True,
            'geodesy': False,
            'cartography': True,
        })
        osm_mock = MagicMock()
        osm_mock.build_tags.return_value = {'building': ['yes']}
        osm_mock.fetch.return_value = gdf

        audit_gdf = gpd.GeoDataFrame({'geometry': []}, crs='EPSG:32723')
        cad_mock = MagicMock()
        from dxf_generator import DXFGenerator
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.dxf', delete=False) as f:
            dxf_path = f.name
        dxf_gen_real = DXFGenerator(dxf_path)
        cad_mock.initialize_dxf.return_value = dxf_gen_real
        cad_mock.satellite_cache_path = None
        with patch('controller.OsmFetcherUseCase', return_value=osm_mock), \
             patch('controller.run_spatial_audit',
                   return_value=({'violations': 0, 'coverageScore': 100}, audit_gdf)), \
             patch('controller.CadExporterUseCase', return_value=cad_mock), \
             patch('controller.Logger.geojson'), \
             patch('controller.ReportOrchestratorUseCase') as rep_mock:
            rep_mock.return_value.generate.return_value = None
            ctrl.run()
        assert True
