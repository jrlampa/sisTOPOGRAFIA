"""
test_report_orchestrator.py — FASE 40
Testes unitários para ReportOrchestratorUseCase.
Cobre: __init__, generate (sucesso e exceção), _build_report_data, _safe_centroid_stat.
"""
import sys
import os
import pytest
import numpy as np
import geopandas as gpd
import pandas as pd
from shapely.geometry import Polygon, LineString
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from application.use_cases.report_orchestrator import ReportOrchestratorUseCase


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_orchestrator(output_file='/tmp/test_output.dxf'):
    return ReportOrchestratorUseCase(
        output_file=output_file,
        project_metadata={'project': 'Teste', 'client': 'Cliente A'},
        lat=-22.15018,
        lon=-42.92185
    )


def _make_gdf():
    """GeoDataFrame simples com edificações e vias."""
    return gpd.GeoDataFrame(
        {
            'geometry': [
                Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]),
                LineString([(0, 0), (100, 0)]),
            ],
            'building': ['yes', None],
            'highway': [None, 'residential'],
            'natural': [None, None],
        },
        crs='EPSG:32724'
    )


# ── __init__ ───────────────────────────────────────────────────────────────────

class TestReportOrchestratorInit:

    def test_init_stores_attributes(self):
        """__init__ deve armazenar todos os atributos corretamente."""
        orch = _make_orchestrator(output_file='/tmp/my.dxf')
        assert orch.output_file == '/tmp/my.dxf'
        assert orch.lat == -22.15018
        assert orch.lon == -42.92185
        assert orch.project_metadata['project'] == 'Teste'


# ── generate ──────────────────────────────────────────────────────────────────

class TestReportOrchestratorGenerate:

    def test_generate_success_calls_generate_report(self, tmp_path):
        """generate() deve chamar generate_report com o path do PDF."""
        orch = ReportOrchestratorUseCase(
            output_file=str(tmp_path / 'out.dxf'),
            project_metadata={},
            lat=-22.15018,
            lon=-42.92185
        )
        gdf = _make_gdf()

        with patch('application.use_cases.report_orchestrator.generate_report') as mock_gen:
            orch.generate(gdf)
            mock_gen.assert_called_once()
            # O primeiro arg deve ser o dict de dados; o segundo o caminho do PDF
            call_args = mock_gen.call_args
            pdf_path = call_args[0][1]
            assert pdf_path.endswith('_laudo.pdf')

    def test_generate_exception_is_swallowed(self, tmp_path):
        """generate() não deve propagar exceção de generate_report."""
        orch = ReportOrchestratorUseCase(
            output_file=str(tmp_path / 'out.dxf'),
            project_metadata={},
            lat=-22.15018,
            lon=-42.92185
        )
        gdf = _make_gdf()

        with patch('application.use_cases.report_orchestrator.generate_report',
                   side_effect=RuntimeError("PDF generation failed")):
            # Não deve lançar
            orch.generate(gdf)

    def test_generate_with_analytics_res(self, tmp_path):
        """generate() com analytics_res deve passar estatísticas corretas."""
        orch = ReportOrchestratorUseCase(
            output_file=str(tmp_path / 'out.dxf'),
            project_metadata={},
            lat=-22.15018,
            lon=-42.92185
        )
        gdf = _make_gdf()
        analytics_res = {
            'slope_avg': 12.5,
            'solar': np.array([0.8, 0.9]),
            'hydrology': np.array([0.5, 1.2]),
            'earthwork': {'cut_volume': 100.0, 'fill_volume': 80.0},
        }

        with patch('application.use_cases.report_orchestrator.generate_report') as mock_gen:
            orch.generate(gdf, analytics_res=analytics_res)
            report_data = mock_gen.call_args[0][0]
            assert report_data['stats']['avg_slope'] == 12.5
            assert report_data['stats']['cut_volume'] == 100.0
            assert report_data['stats']['fill_volume'] == 80.0


# ── _build_report_data ────────────────────────────────────────────────────────

class TestBuildReportData:

    def test_no_analytics_uses_defaults(self):
        """Sem analytics_res, valores padrão devem ser usados."""
        orch = _make_orchestrator()
        gdf = _make_gdf()
        data = orch._build_report_data(gdf, analytics_res=None, satellite_img=None)
        assert data['stats']['avg_slope'] == 8.4
        assert data['stats']['cut_volume'] == 0.0
        assert data['satellite_img'] is None

    def test_with_satellite_img(self):
        """satellite_img deve ser passado para o relatório."""
        orch = _make_orchestrator()
        gdf = _make_gdf()
        data = orch._build_report_data(gdf, analytics_res=None, satellite_img='/tmp/sat.jpg')
        assert data['satellite_img'] == '/tmp/sat.jpg'

    def test_location_label_format(self):
        """location_label deve ser '{lat}, {lon}'."""
        orch = _make_orchestrator()
        gdf = _make_gdf()
        data = orch._build_report_data(gdf, analytics_res=None, satellite_img=None)
        assert data['location_label'] == '-22.15018, -42.92185'


# ── _safe_centroid_stat ───────────────────────────────────────────────────────

class TestSafeCentroidStat:

    def test_returns_zero_when_attr_not_found(self):
        """Atributo inexistente nos centroides → hasattr=False → retorna 0.0."""
        gdf = _make_gdf()
        result = ReportOrchestratorUseCase._safe_centroid_stat(gdf, 'nonexistent_attr_xyz', 'min')
        assert result == 0.0

    def test_returns_zero_on_exception(self):
        """Exceção durante a operação deve retornar 0.0."""
        gdf = _make_gdf()
        # Patch float() para lançar exceção na conversão
        with patch('builtins.float', side_effect=ValueError("bad float")):
            result = ReportOrchestratorUseCase._safe_centroid_stat(gdf, 'x', 'min')
        assert result == 0.0

    def test_returns_float_when_attr_exists(self):
        """Se o centróide tem o atributo solicitado, deve retornar float."""
        gdf = _make_gdf()
        # 'x' existe em Point.centroid
        result = ReportOrchestratorUseCase._safe_centroid_stat(gdf, 'x', 'min')
        assert isinstance(result, float)
