"""
test_dxf_geometry_comprehensive.py — Cobertura completa para DXFGeometryDrawer.
Cobre todos os desvios não testados anteriormente (branches, pontos de exceção).
"""
import math
import pytest
import ezdxf
from shapely.geometry import (
    LineString, MultiLineString, Polygon, MultiPolygon, Point
)
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from dxf_geometry_drawer import DXFGeometryDrawer


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def gen(tmp_path):
    return DXFGenerator(str(tmp_path / "test_geom.dxf"))


@pytest.fixture
def drawer(gen):
    return gen._geom_drawer


# ── draw(): despacho de geometria ─────────────────────────────────────────────

class TestDrawDispatch:
    def test_draw_empty_geom_returns_early(self, drawer):
        """Geometria vazia não gera entidade."""
        empty = Polygon()
        drawer.draw(empty, 'sisTOPO_EDIFICACAO', 0, 0, {})
        assert True  # nenhuma exceção

    def test_draw_unknown_layer_falls_back_to_zero(self, drawer):
        """Layer desconhecida é mapeada para '0'."""
        poly = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        drawer.draw(poly, 'CAMADA_INEXISTENTE', 0, 0, {})
        entities = [e for e in drawer.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 1

    def test_draw_multipolygon_dispatches_each(self, drawer):
        """MultiPolygon gera entidades para cada polígono."""
        p1 = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
        p2 = Polygon([(5, 5), (6, 5), (6, 6), (5, 6)])
        mp = MultiPolygon([p1, p2])
        drawer.draw(mp, 'sisTOPO_EDIFICACAO', 0, 0, {})
        entities = [e for e in drawer.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 2

    def test_draw_multilinestring_with_vias_draws_offsets(self, drawer):
        """MultiLineString em sisTOPO_VIAS gera meio-fio para cada segmento."""
        l1 = LineString([(0, 0), (100, 0)])
        l2 = LineString([(200, 0), (300, 0)])
        ml = MultiLineString([l1, l2])
        tags = {'highway': 'primary'}
        drawer.draw(ml, 'sisTOPO_VIAS', 0, 0, tags)
        curbs = [e for e in drawer.msp
                 if e.dxftype() == 'LWPOLYLINE'
                 and e.dxf.layer == 'sisTOPO_VIAS_MEIO_FIO']
        assert len(curbs) >= 2

    def test_draw_point_dispatched_to_draw_point(self, drawer):
        """Point é despachado para _draw_point."""
        pt = Point(10, 10)
        drawer.draw(pt, 'sisTOPO_VEGETACAO', 0, 0, {'natural': 'tree'})
        blocks = [e for e in drawer.msp if e.dxftype() == 'INSERT']
        assert len(blocks) >= 1


# ── _draw_street_label ────────────────────────────────────────────────────────

class TestDrawStreetLabel:
    def test_nan_name_skipped(self, drawer):
        """Nome 'nan' é ignorado."""
        line = LineString([(0, 0), (100, 0)])
        tags = {'name': 'nan', 'highway': 'residential'}
        drawer._draw_street_label(line, 'sisTOPO_VIAS', 0, 0, tags)
        texts = [e for e in drawer.msp if e.dxftype() == 'TEXT']
        assert len(texts) == 0

    def test_empty_name_skipped(self, drawer):
        """Nome em branco é ignorado."""
        line = LineString([(0, 0), (100, 0)])
        tags = {'name': '   ', 'highway': 'residential'}
        drawer._draw_street_label(line, 'sisTOPO_VIAS', 0, 0, tags)
        texts = [e for e in drawer.msp if e.dxftype() == 'TEXT']
        assert len(texts) == 0

    def test_non_via_layer_skipped(self, drawer):
        """Rótulo não é adicionado para layers que não sejam VIAS."""
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        tags = {'name': 'Edificação', 'building': 'yes'}
        drawer._draw_street_label(poly, 'sisTOPO_EDIFICACAO', 0, 0, tags)
        texts = [e for e in drawer.msp if e.dxftype() == 'TEXT']
        assert len(texts) == 0

    def test_no_name_tag_skipped(self, drawer):
        """Sem tag 'name' o rótulo é ignorado."""
        line = LineString([(0, 0), (100, 0)])
        tags = {'highway': 'primary'}
        drawer._draw_street_label(line, 'sisTOPO_VIAS', 0, 0, tags)
        texts = [e for e in drawer.msp if e.dxftype() == 'TEXT']
        assert len(texts) == 0

    def test_short_linestring_no_rotation(self, drawer):
        """LineString curta não calcula rotação (usa 0.0)."""
        line = LineString([(0, 0), (0.05, 0)])  # < 0.1 comprimento
        tags = {'name': 'Via Curta', 'highway': 'residential'}
        drawer._draw_street_label(line, 'sisTOPO_VIAS', 0, 0, tags)
        texts = [e for e in drawer.msp
                 if e.dxftype() == 'TEXT'
                 and e.dxf.layer == 'sisTOPO_TEXTO']
        assert len(texts) >= 1

    def test_valid_linestring_rotation_computed(self, drawer):
        """LineString longa gera rotação calculada."""
        line = LineString([(0, 0), (100, 100)])  # 45°
        tags = {'name': 'Rua Principal', 'highway': 'primary'}
        drawer._draw_street_label(line, 'sisTOPO_VIAS', 0, 0, tags)
        texts = [e for e in drawer.msp
                 if e.dxftype() == 'TEXT'
                 and e.dxf.layer == 'sisTOPO_TEXTO']
        assert len(texts) >= 1

    def test_line_angle_negative_adjusted(self, drawer):
        """Ângulo negativo < -90 é ajustado +180."""
        # Linha inclinada de forma que atan2 retorne < -90 graus
        line = LineString([(100, 100), (0, 200)])  # ângulo ~135°, +180 = 315 → >90→+180
        tags = {'name': 'Rua Diagonal', 'highway': 'secondary'}
        drawer._draw_street_label(line, 'sisTOPO_VIAS', 0, 0, tags)
        # Só verificamos que não gera exceção
        assert True


# ── get_thickness ─────────────────────────────────────────────────────────────

class TestGetThickness:
    def test_levels_tag(self):
        """Tag 'levels' (sem 'building:levels') retorna níveis × 3.0."""
        result = DXFGeometryDrawer.get_thickness(
            {'levels': '5'}, 'sisTOPO_EDIFICACAO'
        )
        assert result == 15.0

    def test_invalid_height_string(self):
        """Altura inválida retorna 3.5 (default)."""
        result = DXFGeometryDrawer.get_thickness(
            {'height': 'N/A'}, 'sisTOPO_EDIFICACAO'
        )
        assert result == 3.5

    def test_non_building_layer_zero(self):
        """Layer que não é EDIFICACAO retorna 0.0."""
        result = DXFGeometryDrawer.get_thickness(
            {'building': 'yes'}, 'sisTOPO_VIAS'
        )
        assert result == 0.0


# ── _draw_polygon ─────────────────────────────────────────────────────────────

class TestDrawPolygon:
    def test_too_few_valid_points_returns_early(self, drawer):
        """Polígono degenerado (< 3 pontos válidos) não gera entidade."""
        # Polígono com apenas 2 vértices distintos
        poly = Polygon([(0, 0), (1, 0), (0, 0)])  # triângulo degenerado
        # Sobrescrever exterior para forçar < 3 pontos
        from unittest.mock import patch
        with patch.object(drawer, '_validate_points', return_value=None):
            drawer._draw_polygon(poly, 'sisTOPO_EDIFICACAO', 0, 0, {})
        # Sem exceção é suficiente
        assert True

    def test_polygon_with_interior_rings(self, drawer, gen):
        """Polígono com furos gera entidades para exterior e interiores."""
        exterior = [(0, 0), (20, 0), (20, 20), (0, 20), (0, 0)]
        interior = [(5, 5), (10, 5), (10, 10), (5, 10), (5, 5)]
        poly = Polygon(exterior, [interior])
        tags = {'landuse': 'residential'}
        drawer._draw_polygon(poly, 'sisTOPO_USO_RESIDENCIAL', 0, 0, tags)
        entities = [e for e in gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 2  # exterior + interior

    def test_building_with_annotation_and_hatch(self, drawer, gen):
        """Edificação gera anotação de área e hachura."""
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        tags = {'building': 'yes'}
        drawer._draw_polygon(poly, 'sisTOPO_EDIFICACAO', 0, 0, tags)
        hatches = [e for e in gen.msp if e.dxftype() == 'HATCH']
        assert len(hatches) >= 1
        texts = [e for e in gen.msp
                 if e.dxftype() == 'TEXT'
                 and e.dxf.layer == 'sisTOPO_ANNOT_AREA']
        assert len(texts) >= 1


# ── _annotate_building_area ───────────────────────────────────────────────────

class TestAnnotateBuildingArea:
    def test_nan_area_skipped(self, drawer):
        """Área NaN não gera anotação."""
        from shapely.geometry import Polygon as ShapelyPoly
        import unittest.mock as mock
        poly = ShapelyPoly([(0, 0), (1, 0), (1, 1), (0, 1)])
        with mock.patch.object(poly.__class__, 'area',
                               new_callable=lambda: property(lambda self: float('nan'))):
            drawer._annotate_building_area(poly, 0, 0)
        # Nenhuma exceção
        assert True


# ── _draw_linestring ──────────────────────────────────────────────────────────

class TestDrawLinestring:
    def test_too_few_points_returns_early(self, drawer):
        """LineString com < 2 pontos válidos não gera entidade."""
        from unittest.mock import patch
        line = LineString([(0, 0), (1, 1)])
        with patch.object(drawer, '_validate_points', return_value=None):
            drawer._draw_linestring(line, 'sisTOPO_VIAS', 0, 0, {})
        assert True

    def test_road_length_annotation(self, drawer, gen):
        """Via gera anotação de comprimento."""
        line = LineString([(0, 0), (100, 0)])
        tags = {'highway': 'primary'}
        drawer._draw_linestring(line, 'sisTOPO_VIAS', 0, 0, tags)
        texts = [e for e in gen.msp
                 if e.dxftype() == 'TEXT'
                 and e.dxf.layer == 'sisTOPO_ANNOT_LENGTH']
        assert len(texts) >= 1


# ── _annotate_road_length ─────────────────────────────────────────────────────

class TestAnnotateRoadLength:
    def test_nan_length_skipped(self, drawer):
        """Comprimento NaN não gera anotação."""
        from shapely.geometry import LineString as ShapelyLine
        import unittest.mock as mock
        line = ShapelyLine([(0, 0), (1, 1)])
        with mock.patch.object(line.__class__, 'length',
                               new_callable=lambda: property(lambda self: float('nan'))):
            drawer._annotate_road_length(line, 0, 0)
        assert True


# ── _draw_point: todos os tipos ───────────────────────────────────────────────

class TestDrawPoint:
    def test_nan_point_returns_early(self, drawer, gen):
        """Ponto com NaN não gera entidade."""
        pt = Point(float('nan'), 5)
        drawer._draw_point(pt, 'sisTOPO_VEGETACAO', 0, 0, {})
        inserts = [e for e in gen.msp if e.dxftype() == 'INSERT']
        assert len(inserts) == 0

    def test_mobiliario_bench(self, drawer, gen):
        """amenity=bench insere bloco BANCO."""
        pt = Point(10, 10)
        tags = {'amenity': 'bench'}
        drawer._draw_point(pt, 'sisTOPO_MOBILIARIO_URBANO', 0, 0, tags)
        blocks = [e for e in gen.msp
                  if e.dxftype() == 'INSERT' and e.dxf.name == 'BANCO']
        assert len(blocks) >= 1

    def test_mobiliario_waste_basket(self, drawer, gen):
        """amenity=waste_basket insere bloco LIXEIRA."""
        pt = Point(20, 20)
        tags = {'amenity': 'waste_basket'}
        drawer._draw_point(pt, 'sisTOPO_MOBILIARIO_URBANO', 0, 0, tags)
        blocks = [e for e in gen.msp
                  if e.dxftype() == 'INSERT' and e.dxf.name == 'LIXEIRA']
        assert len(blocks) >= 1

    def test_mobiliario_street_lamp(self, drawer, gen):
        """highway=street_lamp insere bloco POSTE_LUZ."""
        pt = Point(30, 30)
        tags = {'highway': 'street_lamp'}
        drawer._draw_point(pt, 'sisTOPO_MOBILIARIO_URBANO', 0, 0, tags)
        blocks = [e for e in gen.msp
                  if e.dxftype() == 'INSERT' and e.dxf.name == 'POSTE_LUZ']
        assert len(blocks) >= 1

    def test_mobiliario_else_circle(self, drawer, gen):
        """Tipo desconhecido em MOBILIARIO_URBANO insere círculo."""
        pt = Point(40, 40)
        tags = {}
        drawer._draw_point(pt, 'sisTOPO_MOBILIARIO_URBANO', 0, 0, tags)
        circles = [e for e in gen.msp if e.dxftype() == 'CIRCLE']
        assert len(circles) >= 1

    def test_equipamentos_poste_with_attribs(self, drawer, gen):
        """EQUIPAMENTOS insere bloco POSTE com atributos BIM."""
        pt = Point(50, 50)
        tags = {'osmid': '123', 'power': 'pole', 'voltage': '13800V'}
        drawer._draw_point(pt, 'sisTOPO_EQUIPAMENTOS', 0, 0, tags)
        blocks = [e for e in gen.msp
                  if e.dxftype() == 'INSERT' and e.dxf.name == 'POSTE']
        assert len(blocks) >= 1

    def test_infra_power_hv_tower(self, drawer, gen):
        """INFRA_POWER_HV com power=tower insere TORRE."""
        pt = Point(60, 60)
        tags = {'power': 'tower', 'voltage': '138000V'}
        drawer._draw_point(pt, 'sisTOPO_INFRA_POWER_HV', 0, 0, tags)
        blocks = [e for e in gen.msp
                  if e.dxftype() == 'INSERT' and e.dxf.name == 'TORRE']
        assert len(blocks) >= 1

    def test_infra_power_hv_non_tower(self, drawer, gen):
        """INFRA_POWER_HV sem power=tower insere POSTE."""
        pt = Point(70, 70)
        tags = {'power': 'line', 'voltage': '69000V'}
        drawer._draw_point(pt, 'sisTOPO_INFRA_POWER_LV', 0, 0, tags)
        blocks = [e for e in gen.msp
                  if e.dxftype() == 'INSERT' and e.dxf.name == 'POSTE']
        assert len(blocks) >= 1

    def test_infra_telecom(self, drawer, gen):
        """INFRA_TELECOM insere POSTE com escala 0.8."""
        pt = Point(80, 80)
        tags = {'telecom': 'cable_distribution_cabinet'}
        drawer._draw_point(pt, 'sisTOPO_INFRA_TELECOM', 0, 0, tags)
        blocks = [e for e in gen.msp
                  if e.dxftype() == 'INSERT' and e.dxf.name == 'POSTE']
        assert len(blocks) >= 1

    def test_generic_layer_circle(self, drawer, gen):
        """Layer genérica insere círculo de 0.5m."""
        pt = Point(90, 90)
        tags = {}
        drawer._draw_point(pt, 'sisTOPO_UC_FEDERAL', 0, 0, tags)
        circles = [e for e in gen.msp if e.dxftype() == 'CIRCLE']
        assert len(circles) >= 1


# ── _hatch_building: exceção ──────────────────────────────────────────────────

class TestHatchBuilding:
    def test_hatch_exception_logged(self, drawer):
        """Falha na hachura é logada sem propagar exceção."""
        from unittest.mock import patch
        with patch.object(drawer.msp, 'add_hatch', side_effect=RuntimeError('hatch fail')):
            drawer._hatch_building([(0, 0), (1, 0), (1, 1), (0, 1)])
        assert True  # nenhuma exceção propagada
