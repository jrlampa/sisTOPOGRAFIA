"""
test_cut_fill_optimizer.py — Testes unitários para CutFillOptimizer.
Usa mocks para a API de elevação, permitindo execução headless e offline.
"""
import pytest
import sys
import os
from unittest.mock import patch
from shapely.geometry import Polygon

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── Coordenadas de Teste Padronizadas (memory.md) ────────────────────────────
# Decimal: -22.15018, -42.92185 (raio ~100m)

POLYGON_100M = [
    [-22.150, -42.922],
    [-22.150, -42.921],
    [-22.151, -42.921],
    [-22.151, -42.922],
]

TARGET_Z_FLAT = 600.0    # Altitude alvo plana (sem corte/aterro)
TARGET_Z_HIGH = 700.0    # Altitude alta (requer aterro)
TARGET_Z_LOW  = 500.0    # Altitude baixa (requer corte)


def _make_flat_elevation(target_z: float, n: int = 9):
    """Retorna grade de elevação plana em target_z."""
    lats = [-22.150 + i * 0.0001 for i in range(3)] * 3
    lons = [-42.922 + j * 0.0001 for j in range(3) for _ in range(3)]
    return (
        [(lat, lon, target_z) for lat, lon in zip(lats, lons)],
        3,
        3
    )


MOCK_PATH = 'domain.services.cut_fill_optimizer.fetch_elevation_grid'


class TestCutFillOptimizerBasic:
    """Testes de lógica básica do CutFillOptimizer com elevação mockada."""

    def test_invalid_polygon_raises(self):
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer([[0, 0], [1, 1]], target_z=600.0)
        with pytest.raises(ValueError, match="at least 3 points"):
            opt.calculate()

    def test_flat_terrain_at_target_produces_no_volume(self):
        """Terreno plano igual ao target_z: cut=0 e fill=0."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_FLAT)
        with patch(MOCK_PATH,
                   return_value=_make_flat_elevation(TARGET_Z_FLAT)):
            result = opt.calculate()
        assert result['cut'] == pytest.approx(0.0, abs=1e-3)
        assert result['fill'] == pytest.approx(0.0, abs=1e-3)

    def test_high_target_produces_fill(self):
        """Target acima do terreno: deve gerar volume de aterro (fill)."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_HIGH)
        with patch(MOCK_PATH,
                   return_value=_make_flat_elevation(TARGET_Z_FLAT)):
            result = opt.calculate()
        assert result['fill'] > 0, "Aterro esperado quando target > terreno"
        assert result['cut'] == pytest.approx(0.0, abs=1e-3)

    def test_low_target_produces_cut(self):
        """Target abaixo do terreno: deve gerar volume de corte (cut)."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_LOW)
        with patch(MOCK_PATH,
                   return_value=_make_flat_elevation(TARGET_Z_FLAT)):
            result = opt.calculate()
        assert result['cut'] > 0, "Corte esperado quando target < terreno"
        assert result['fill'] == pytest.approx(0.0, abs=1e-3)

    def test_result_has_required_keys(self):
        """Resultado deve conter: cut, fill, area, pointsSampled, targetZ."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_FLAT)
        with patch(MOCK_PATH,
                   return_value=_make_flat_elevation(TARGET_Z_FLAT)):
            result = opt.calculate()
        for key in ('cut', 'fill', 'area', 'pointsSampled', 'targetZ'):
            assert key in result, f"Chave '{key}' ausente no resultado"

    def test_area_is_positive(self):
        """Área do polígono deve ser positiva."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_FLAT)
        with patch(MOCK_PATH,
                   return_value=_make_flat_elevation(TARGET_Z_FLAT)):
            result = opt.calculate()
        assert result['area'] > 0, "Área deve ser positiva"

    def test_target_z_preserved_in_result(self):
        """targetZ no resultado deve ser igual ao valor fornecido."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_HIGH)
        with patch(MOCK_PATH,
                   return_value=_make_flat_elevation(TARGET_Z_FLAT)):
            result = opt.calculate()
        assert result['targetZ'] == TARGET_Z_HIGH

    def test_no_elevation_data_raises(self):
        """Sem dados de elevação, deve lançar Exception."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_FLAT)
        with patch(MOCK_PATH,
                   return_value=([], 0, 0)):
            with pytest.raises(Exception, match="No elevation data"):
                opt.calculate()


class TestCutFillOptimizerEdgeCases:
    """Cobre branches não testados: linha 66 (poly_area≤0), linha 72 (grid 1×1), linhas 90-99 (loop)."""

    def test_degenerate_polygon_zero_area_raises(self):
        """Polígono com todos pontos no mesmo lugar → área zero → ValueError (linha 66)."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        # Triângulo degenerado: todos os pontos no mesmo lugar
        degenerate = [
            [-22.150, -42.922],
            [-22.150, -42.922],
            [-22.150, -42.922],
            [-22.150, -42.922],
        ]
        opt = CutFillOptimizer(degenerate, target_z=600.0)
        with patch(MOCK_PATH, return_value=_make_flat_elevation(600.0)):
            with pytest.raises((ValueError, Exception)):
                opt.calculate()

    def test_1x1_grid_uses_cell_area_fallback(self):
        """Grid 1×1 (rows=1, cols=1) → célula calculada por poly_area (linha 72)."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_FLAT)
        # Retorna 1 ponto NO centro do polígono (dentro) com elevação igual ao target → fill=cut=0
        center_elev = [(-22.1505, -42.9215, TARGET_Z_FLAT)]
        with patch(MOCK_PATH, return_value=(center_elev, 1, 1)):
            result = opt.calculate()
        # cell_area = poly_area/1 (linha 72); ponto no centro → dentro → dz=0 → sem volume
        assert result['cut'] == pytest.approx(0.0, abs=1e-3)
        assert result['fill'] == pytest.approx(0.0, abs=1e-3)

    def test_fill_required_when_point_inside_and_target_above_terrain(self):
        """Ponto dentro do polígono com target > elevação → fill acumulado (linhas 94-96)."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        # target=700 > elev=600 → dz=+100 → fill += volume
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_HIGH)
        center_elev = [(-22.1505, -42.9215, TARGET_Z_FLAT)]
        with patch(MOCK_PATH, return_value=(center_elev, 1, 1)):
            result = opt.calculate()
        # ponto dentro, dz=100 → total_fill > 0
        assert result['fill'] > 0.0
        assert result['cut'] == pytest.approx(0.0, abs=1e-3)

    def test_cut_required_when_point_inside_and_target_below_terrain(self):
        """Ponto dentro do polígono com target < elevação → cut acumulado (linhas 97-99)."""
        from domain.services.cut_fill_optimizer import CutFillOptimizer
        # target=500 < elev=600 → dz=-100 → cut += volume
        opt = CutFillOptimizer(POLYGON_100M, target_z=TARGET_Z_LOW)
        center_elev = [(-22.1505, -42.9215, TARGET_Z_FLAT)]
        with patch(MOCK_PATH, return_value=(center_elev, 1, 1)):
            result = opt.calculate()
        # ponto dentro, dz=-100 → total_cut > 0
        assert result['cut'] > 0.0
        assert result['fill'] == pytest.approx(0.0, abs=1e-3)
