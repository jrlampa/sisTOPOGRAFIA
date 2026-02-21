"""
test_aneel_prodist_rules.py — Testes unitários para AneelProdistRules
Valida geração de faixas de servidão conforme PRODIST Módulo 3 §6.4.
"""
import sys
import os
import math
import pytest
import geopandas as gpd
from shapely.geometry import LineString, Point, Polygon

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from domain.services.aneel_prodist_rules import AneelProdistRules
from constants import (
    PRODIST_BUFFER_HV_M, PRODIST_BUFFER_MT_M, PRODIST_BUFFER_BT_M,
    LAYER_PRODIST_FAIXA_HV, LAYER_PRODIST_FAIXA_MT, LAYER_PRODIST_FAIXA_BT,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_gdf(rows, crs='EPSG:32723'):
    """Helper: cria GeoDataFrame projetado com as linhas fornecidas."""
    return gpd.GeoDataFrame(rows, crs=crs)


def _hv_line_gdf():
    return _make_gdf([
        {'geometry': LineString([(0, 0), (100, 0)]), 'power': 'line'},
        {'geometry': Point(50, 50), 'power': 'tower'},
    ])


def _mt_line_gdf():
    return _make_gdf([
        {'geometry': LineString([(0, 0), (100, 0)]), 'power': 'pole'},
    ])


def _bt_line_gdf():
    return _make_gdf([
        {'geometry': LineString([(0, 0), (50, 0)]), 'power': 'minor_line'},
        {'geometry': LineString([(0, 0), (30, 0)]), 'power': 'cable'},
    ])


def _no_power_gdf():
    return _make_gdf([
        {'geometry': LineString([(0, 0), (100, 0)]), 'highway': 'primary'},
    ])


# ── has_power_infrastructure ──────────────────────────────────────────────────

class TestHasPowerInfrastructure:

    def test_returns_true_when_power_column_present(self):
        gdf = _hv_line_gdf()
        assert AneelProdistRules.has_power_infrastructure(gdf) is True

    def test_returns_false_when_no_power_column(self):
        gdf = _no_power_gdf()
        assert AneelProdistRules.has_power_infrastructure(gdf) is False

    def test_returns_false_for_empty_gdf(self):
        gdf = gpd.GeoDataFrame(columns=['geometry', 'power'])
        assert AneelProdistRules.has_power_infrastructure(gdf) is False

    def test_returns_false_for_none(self):
        assert AneelProdistRules.has_power_infrastructure(None) is False

    def test_returns_false_when_all_power_null(self):
        gdf = _make_gdf([
            {'geometry': LineString([(0, 0), (10, 0)]), 'power': None},
        ])
        assert AneelProdistRules.has_power_infrastructure(gdf) is False


# ── generate_faixas_servid ────────────────────────────────────────────────────

class TestGenerateFaixasServid:

    def test_returns_empty_when_no_power_column(self):
        gdf = _no_power_gdf()
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.empty

    def test_returns_empty_for_none_input(self):
        result = AneelProdistRules.generate_faixas_servid(None)
        assert result.empty

    def test_returns_empty_for_empty_gdf(self):
        gdf = gpd.GeoDataFrame(columns=['geometry', 'power'])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.empty

    def test_hv_power_line_gets_hv_buffer(self):
        gdf = _make_gdf([{'geometry': LineString([(0, 0), (100, 0)]), 'power': 'line'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert len(result) == 1
        assert result.iloc[0]['prodist_type'] == 'HV'

    def test_hv_tower_gets_hv_buffer(self):
        gdf = _make_gdf([{'geometry': Point(50, 50), 'power': 'tower'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.iloc[0]['prodist_type'] == 'HV'

    def test_hv_substation_gets_hv_buffer(self):
        gdf = _make_gdf([{'geometry': Polygon([(0, 0), (10, 0), (10, 10), (0, 10)]), 'power': 'substation'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.iloc[0]['prodist_type'] == 'HV'

    def test_bt_minor_line_gets_bt_buffer(self):
        gdf = _make_gdf([{'geometry': LineString([(0, 0), (50, 0)]), 'power': 'minor_line'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.iloc[0]['prodist_type'] == 'BT'

    def test_bt_cable_gets_bt_buffer(self):
        gdf = _make_gdf([{'geometry': LineString([(0, 0), (30, 0)]), 'power': 'cable'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.iloc[0]['prodist_type'] == 'BT'

    def test_unclassified_power_defaults_to_mt(self):
        gdf = _make_gdf([{'geometry': LineString([(0, 0), (100, 0)]), 'power': 'pole'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.iloc[0]['prodist_type'] == 'MT'

    def test_hv_buffer_distance_is_correct(self):
        """Buffer HV deve ser PRODIST_BUFFER_HV_M metros por lado."""
        line = LineString([(0, 0), (100, 0)])
        gdf = _make_gdf([{'geometry': line, 'power': 'line'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        buf_geom = result.iloc[0].geometry
        # Ponto perpendicular ao centro da linha: Y deve alcançar PRODIST_BUFFER_HV_M
        assert buf_geom.bounds[1] == pytest.approx(-PRODIST_BUFFER_HV_M, abs=0.1)
        assert buf_geom.bounds[3] == pytest.approx(PRODIST_BUFFER_HV_M, abs=0.1)

    def test_mt_buffer_distance_is_correct(self):
        line = LineString([(0, 0), (100, 0)])
        gdf = _make_gdf([{'geometry': line, 'power': 'pole'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        buf_geom = result.iloc[0].geometry
        assert buf_geom.bounds[1] == pytest.approx(-PRODIST_BUFFER_MT_M, abs=0.1)
        assert buf_geom.bounds[3] == pytest.approx(PRODIST_BUFFER_MT_M, abs=0.1)

    def test_bt_buffer_distance_is_correct(self):
        line = LineString([(0, 0), (50, 0)])
        gdf = _make_gdf([{'geometry': line, 'power': 'minor_line'}])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        buf_geom = result.iloc[0].geometry
        assert buf_geom.bounds[1] == pytest.approx(-PRODIST_BUFFER_BT_M, abs=0.1)
        assert buf_geom.bounds[3] == pytest.approx(PRODIST_BUFFER_BT_M, abs=0.1)

    def test_mixed_power_types_returns_multiple_rows(self):
        gdf = _make_gdf([
            {'geometry': LineString([(0, 0), (100, 0)]), 'power': 'line'},
            {'geometry': LineString([(0, 0), (50, 0)]), 'power': 'pole'},
            {'geometry': LineString([(0, 0), (30, 0)]), 'power': 'minor_line'},
        ])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert len(result) == 3
        types = set(result['prodist_type'].tolist())
        assert types == {'HV', 'MT', 'BT'}

    def test_geographic_crs_reprojects_for_buffering(self):
        """GDF em WGS84 deve ser reprojetado para EPSG:3857 (Web Mercator, buffer em metros) e devolvido em EPSG:4326."""
        gdf = _make_gdf(
            [{'geometry': LineString([(-42.92, -22.15), (-42.91, -22.15)]), 'power': 'line'}],
            crs='EPSG:4326'
        )
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert not result.empty
        assert result.crs.to_epsg() == 4326

    def test_skips_empty_geometry(self):
        from shapely.geometry import MultiLineString
        gdf = _make_gdf([
            {'geometry': MultiLineString(), 'power': 'line'},  # empty geometry
            {'geometry': LineString([(0, 0), (10, 0)]), 'power': 'pole'},
        ])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        # Only the valid pole should produce a result
        assert len(result) == 1
        assert result.iloc[0]['prodist_type'] == 'MT'

    def test_returns_empty_when_all_power_null(self):
        gdf = _make_gdf([
            {'geometry': LineString([(0, 0), (10, 0)]), 'power': None},
        ])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        assert result.empty


# ── Constantes PRODIST ────────────────────────────────────────────────────────

class TestProdistConstants:

    def test_hv_buffer_is_15m(self):
        assert PRODIST_BUFFER_HV_M == 15.0

    def test_mt_buffer_is_8m(self):
        assert PRODIST_BUFFER_MT_M == 8.0

    def test_bt_buffer_is_2m(self):
        assert PRODIST_BUFFER_BT_M == 2.0

    def test_layer_names_have_sistopo_prefix(self):
        assert LAYER_PRODIST_FAIXA_HV.startswith('sisTOPO_')
        assert LAYER_PRODIST_FAIXA_MT.startswith('sisTOPO_')
        assert LAYER_PRODIST_FAIXA_BT.startswith('sisTOPO_')


class TestAneelProdistRulesReturnEmpty:
    """Cobre linha 97 — return _empty quando todos os resultados são geometrias vazias com power válido."""

    def test_returns_empty_when_all_geometries_empty_but_power_valid(self):
        """Todos os itens têm power não-nulo mas geometria vazia → results=[] → linha 97."""
        from shapely.geometry import MultiLineString
        # Todos têm power='line' (não nulo → passam filtro), mas geometria vazia
        gdf = _make_gdf([
            {'geometry': MultiLineString(), 'power': 'line'},
            {'geometry': MultiLineString(), 'power': 'tower'},
            {'geometry': MultiLineString(), 'power': 'cable'},
        ])
        result = AneelProdistRules.generate_faixas_servid(gdf)
        # power não-nulo → power_gdf não vazio, mas geometrias vazias → results=[] → return _empty (linha 97)
        assert result.empty
