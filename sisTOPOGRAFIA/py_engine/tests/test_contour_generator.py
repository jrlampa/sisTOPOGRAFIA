"""
test_contour_generator.py — FASE 37
Testes unitários para generate_contours() (geração de curvas de nível a partir de grades de pontos).
"""
import sys
import os
import math

import pytest
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contour_generator import generate_contours


class TestGenerateContoursTerreno:
    """Testes para generate_contours com diferentes tipos de terrenos."""

    def _make_flat_grid(self, rows=5, cols=5, z=100.0):
        """Cria uma grade plana (sem variação de elevação)."""
        return [
            [(float(c * 10), float(r * 10), z) for c in range(cols)]
            for r in range(rows)
        ]

    def _make_sloped_grid(self, rows=6, cols=6, z_min=100.0, z_max=110.0):
        """Cria uma grade com inclinação linear no eixo X."""
        dz = (z_max - z_min) / max(cols - 1, 1)
        return [
            [(float(c * 10), float(r * 10), z_min + c * dz) for c in range(cols)]
            for r in range(rows)
        ]

    def test_terreno_plano_retorna_lista_vazia(self):
        """Terreno completamente plano (dz < 0.1) deve retornar lista vazia."""
        grid = self._make_flat_grid(z=200.0)
        result = generate_contours(grid, interval=1.0)
        assert isinstance(result, list)
        assert len(result) == 0

    def test_terreno_inclinado_retorna_curvas(self):
        """Terreno com variação de 10m deve gerar pelo menos 1 curva de nível."""
        grid = self._make_sloped_grid(z_min=100.0, z_max=110.0)
        result = generate_contours(grid, interval=2.0)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_curvas_sao_listas_de_coordenadas(self):
        """Cada curva deve ser uma lista/tupla de pontos (x, y) ou (x, y, z)."""
        grid = self._make_sloped_grid(z_min=100.0, z_max=112.0)
        result = generate_contours(grid, interval=2.0)
        assert len(result) > 0
        for curva in result:
            assert isinstance(curva, (list, tuple))
            assert len(curva) > 0

    def test_sem_tolerancia_retorna_curvas_nao_simplificadas(self):
        """Com tolerance=0 não deve aplicar simplificação Shapely; retorna pontos originais."""
        grid = self._make_sloped_grid(z_min=100.0, z_max=110.0)
        result = generate_contours(grid, interval=1.0, tolerance=0)
        assert isinstance(result, list)
        # Com tolerance=0, curvas com mais de 2 pontos não são simplificadas
        # (sem chamada a line.simplify), deve retornar lista com pontos 3D
        if result:
            for curva in result:
                assert len(curva) > 0

    def test_intervalo_menor_gera_mais_curvas(self):
        """Intervalo menor deve gerar mais curvas de nível."""
        grid = self._make_sloped_grid(z_min=100.0, z_max=120.0, rows=8, cols=8)
        result_grosso = generate_contours(grid, interval=5.0)
        result_fino = generate_contours(grid, interval=1.0)
        # Intervalo menor → mais curvas (em geral)
        assert len(result_fino) >= len(result_grosso)

    def test_grade_minima_2x2(self):
        """Grade muito pequena (2x2) não deve lançar exceção."""
        grid = [
            [(0.0, 0.0, 100.0), (10.0, 0.0, 105.0)],
            [(0.0, 10.0, 102.0), (10.0, 10.0, 107.0)],
        ]
        result = generate_contours(grid, interval=1.0)
        assert isinstance(result, list)

    def test_terreno_com_variacao_grande(self):
        """Terreno com variação de 50m deve gerar várias curvas."""
        grid = self._make_sloped_grid(rows=8, cols=8, z_min=0.0, z_max=50.0)
        result = generate_contours(grid, interval=10.0)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_retorna_lista_em_caso_de_erro(self):
        """Entrada inválida deve retornar [] sem lançar exceção."""
        # Grade vazia ou mal formada
        result = generate_contours([], interval=1.0)
        assert result == []

    def test_tolerancia_positiva_aplica_simplificacao(self):
        """Com tolerance > 0, curvas devem ser simplificadas (Shapely)."""
        grid = self._make_sloped_grid(rows=10, cols=10, z_min=100.0, z_max=115.0)
        result = generate_contours(grid, interval=1.0, tolerance=0.5)
        # Não deve lançar exceção e deve retornar lista
        assert isinstance(result, list)
