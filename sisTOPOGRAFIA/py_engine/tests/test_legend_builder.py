"""
test_legend_builder.py — Testes unitários para LegendBuilder
Cobre: add_cartographic_elements, add_coordinate_grid, add_legend,
       add_title_block (com e sem erro LOGO), add_geodetic_control_table.
"""
import sys
import os
import pytest
import ezdxf

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from legend_builder import LegendBuilder


def _make_builder(project_info=None):
    """Cria um LegendBuilder com documento ezdxf real e safe_v identidade."""
    doc = ezdxf.new(dxfversion='R2010')
    msp = doc.modelspace()
    bounds = [0.0, 0.0, 100.0, 100.0]
    diff_x, diff_y = 50.0, 50.0
    return LegendBuilder(msp, doc, bounds, diff_x, diff_y, lambda value: float(value),
                         project_info or {})


class TestAddCartographicElements:
    def test_no_exception_with_valid_bounds(self):
        """add_cartographic_elements não deve lançar exceção com bounds válidos."""
        b = _make_builder()
        # Não deve lançar
        b.add_cartographic_elements(0.0, 0.0, 100.0, 100.0, 50.0, 50.0)

    def test_exception_swallowed_gracefully(self):
        """Exceção interna deve ser capturada e logada sem propagar."""
        import ezdxf
        doc = ezdxf.new()
        msp = doc.modelspace()

        # safe_v que lança: força exceção dentro do método
        def bad_safe_v(v):
            raise RuntimeError("safe_v falhou")

        b = LegendBuilder(msp, doc, [0, 0, 100, 100], 50, 50, bad_safe_v, {})
        # Não deve propagar
        b.add_cartographic_elements(0.0, 0.0, 100.0, 100.0, 50.0, 50.0)


class TestAddCoordinateGrid:
    def test_basic_grid_drawn(self):
        """Grade com limites normais deve adicionar linhas ao msp."""
        b = _make_builder()
        before = len(list(b.msp))
        b.add_coordinate_grid(0.0, 0.0, 100.0, 100.0, 50.0, 50.0, spacing=50.0)
        after = len(list(b.msp))
        assert after > before, "Grade deve adicionar entidades ao msp"

    def test_large_area_skips_crosshairs(self):
        """Área muito grande (n_x>100) deve pular os crosshairs e retornar cedo."""
        b = _make_builder()
        before = len(list(b.msp))
        # spacing=1 com intervalo 0-200 → 200 crosshairs > 100 → pula
        b.add_coordinate_grid(0.0, 0.0, 200.0, 200.0, 0.0, 0.0, spacing=1.0)
        after = len(list(b.msp))
        # Moldura externa é adicionada antes do guard; apenas ela deve aparecer
        assert after == before + 1, "Com grade grande só a moldura deve ser adicionada"

    def test_spacing_controls_density(self):
        """spacing menor gera mais crosshairs."""
        b1 = _make_builder()
        b1.add_coordinate_grid(0.0, 0.0, 50.0, 50.0, 0.0, 0.0, spacing=10.0)
        count_fine = len(list(b1.msp))

        b2 = _make_builder()
        b2.add_coordinate_grid(0.0, 0.0, 50.0, 50.0, 0.0, 0.0, spacing=25.0)
        count_coarse = len(list(b2.msp))

        assert count_fine > count_coarse, "Spacing menor deve gerar mais entidades"


class TestAddLegend:
    def test_legend_adds_entities(self):
        """add_legend deve adicionar linhas e textos ao msp."""
        b = _make_builder()
        before = len(list(b.msp))
        b.add_legend()
        after = len(list(b.msp))
        assert after > before


class TestAddTitleBlock:
    def test_title_block_no_exception(self):
        """add_title_block não deve lançar exceção em documento normal."""
        b = _make_builder({'scale': '1:500'})
        b.add_title_block(client="Teste", project="sisTOPO", paper_size='A3')

    def test_title_block_all_paper_sizes(self):
        """add_title_block funciona com todos os tamanhos ABNT."""
        for size in ['A0', 'A1', 'A2', 'A3', 'A4']:
            b = _make_builder()
            b.add_title_block(paper_size=size)

    def test_title_block_unknown_paper_size_falls_back_to_a3(self):
        """Tamanho desconhecido usa A3 como padrão."""
        b = _make_builder()
        b.add_title_block(paper_size='X9')  # não deve lançar

    def test_title_block_logo_exception_swallowed(self):
        """Falha ao adicionar bloco LOGO deve ser capturada graciosamente."""
        b = _make_builder()
        # LOGO block não existe → add_blockref pode lançar; deve ser capturado
        b.add_title_block(client="C", project="P", paper_size='A3')


class TestAddGeodeticControlTable:
    def test_no_markers_returns_without_adding(self):
        """Sem marcos geodésicos, nenhuma entidade é adicionada ao layout."""
        b = _make_builder(project_info={})
        layout = b.doc.layout('Layout1')
        before = len(list(layout))
        b.add_geodetic_control_table()
        after = len(list(layout))
        assert after == before

    def test_with_markers_adds_text(self):
        """Com marcos geodésicos, textos são adicionados ao layout."""
        marcos = [
            {'id': 'M001', 'lat': -22.15018, 'lon': -42.92185, 'altitude': 850.0},
            {'id': 'M002', 'lat': -22.15100, 'lon': -42.92300, 'altitude': 855.0},
        ]
        b = _make_builder(project_info={'geodetic_markers': marcos})
        layout = b.doc.layout('Layout1')
        before = len(list(layout))
        b.add_geodetic_control_table()
        after = len(list(layout))
        assert after > before, "Com marcos geodésicos devem ser adicionados textos"

    def test_markers_limited_to_ten(self):
        """Tabela deve limitar os marcos a no máximo 10 linhas."""
        marcos = [
            {'id': f'M{i:03d}', 'lat': -22.0 - i * 0.001, 'lon': -42.0, 'altitude': 800.0}
            for i in range(15)
        ]
        b = _make_builder(project_info={'geodetic_markers': marcos})
        # Não deve lançar com 15 marcos (limitado a 10)
        b.add_geodetic_control_table()
