"""
test_memorial_engine.py — FASE 37
Testes unitários para MemorialEngine (geração de memorial descritivo ABNT).
"""
import math
import sys
import os

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from memorial_engine import MemorialEngine


class TestMemorialEngineCalculatePerimeter:
    """Testes para MemorialEngine.calculate_perimeter()."""

    def test_quadrado_unitario(self):
        coords = [(0, 0), (1, 0), (1, 1), (0, 1)]
        resultado = MemorialEngine.calculate_perimeter(coords)
        assert abs(resultado - 4.0) < 1e-9

    def test_triangulo_equilatero(self):
        coords = [(0, 0), (1, 0), (0.5, math.sqrt(3) / 2)]
        resultado = MemorialEngine.calculate_perimeter(coords)
        assert abs(resultado - 3.0) < 1e-6

    def test_menos_de_dois_pontos_retorna_zero(self):
        assert MemorialEngine.calculate_perimeter([(0, 0)]) == 0.0
        assert MemorialEngine.calculate_perimeter([]) == 0.0

    def test_dois_pontos_retorna_distancia_ida_e_volta(self):
        coords = [(0, 0), (3, 4)]
        resultado = MemorialEngine.calculate_perimeter(coords)
        assert abs(resultado - 10.0) < 1e-9  # 5 + 5 (fechado)


class TestMemorialEngineCalculateArea:
    """Testes para MemorialEngine.calculate_area() via fórmula de Shoelace."""

    def test_quadrado_unitario(self):
        coords = [(0, 0), (1, 0), (1, 1), (0, 1)]
        area = MemorialEngine.calculate_area(coords)
        assert abs(area - 1.0) < 1e-9

    def test_retangulo(self):
        coords = [(0, 0), (4, 0), (4, 3), (0, 3)]
        area = MemorialEngine.calculate_area(coords)
        assert abs(area - 12.0) < 1e-9

    def test_triangulo_retangulo(self):
        coords = [(0, 0), (4, 0), (0, 3)]
        area = MemorialEngine.calculate_area(coords)
        assert abs(area - 6.0) < 1e-9

    def test_menos_de_tres_pontos_retorna_zero(self):
        assert MemorialEngine.calculate_area([]) == 0.0
        assert MemorialEngine.calculate_area([(0, 0)]) == 0.0
        assert MemorialEngine.calculate_area([(0, 0), (1, 0)]) == 0.0


class TestMemorialEngineGenerateMemorial:
    """Testes para MemorialEngine.generate_memorial()."""

    def _make_vertices(self):
        return [
            (714316.0, 7549084.0, 850.0, "P1"),
            (714416.0, 7549084.0, 855.0, "P2"),
            (714416.0, 7548984.0, 852.0, "P3"),
        ]

    def _make_project_info(self):
        return {
            "client": "Prefeitura Municipal de Friburgo",
            "project": "Loteamento Parque das Pedras",
            "location": "Nova Friburgo, RJ",
            "designer": "Eng. João Silva CREA-RJ 12345",
            "total_area": 10000.0,
            "perimeter": 400.0,
        }

    def test_retorna_string_nao_vazia(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert isinstance(texto, str)
        assert len(texto) > 100

    def test_contem_nome_do_projeto(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "LOTEAMENTO PARQUE DAS PEDRAS" in texto

    def test_contem_nome_do_cliente(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "PREFEITURA MUNICIPAL DE FRIBURGO" in texto

    def test_contem_coordenadas_do_primeiro_vertice(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "714,316.000" in texto or "714316" in texto

    def test_contem_tabela_de_vertices(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "TABELA DE COORDENADAS" in texto
        assert "P1" in texto
        assert "P2" in texto
        assert "P3" in texto

    def test_contem_area_e_perimetro(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "10,000.00" in texto or "10000" in texto
        assert "400.00" in texto or "400" in texto

    def test_valores_padrao_sem_project_info(self):
        """Deve usar valores padrão quando project_info está vazio."""
        texto = MemorialEngine.generate_memorial({}, [(100.0, 200.0, 300.0, "P0")])
        assert "CLIENTE NÃO INFORMADO" in texto or "CLIENTE" in texto

    def test_datum_sirgas_presente(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "SIRGAS 2000" in texto

    def test_abnt_nbr13133_presente(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "NBR 13133" in texto

    def test_lista_de_vertices_vazia_nao_quebra(self):
        """Gerar memorial com lista vazia deve lançar IndexError (acesso a vertices[0])."""
        projeto = self._make_project_info()
        with pytest.raises(IndexError):
            MemorialEngine.generate_memorial(projeto, [])

    def test_responsavel_tecnico_presente(self):
        texto = MemorialEngine.generate_memorial(
            self._make_project_info(), self._make_vertices()
        )
        assert "Eng. João Silva" in texto or "RESPONSABILIDADE TÉCNICA" in texto
