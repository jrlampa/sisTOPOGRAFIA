"""
test_modular_drawers.py — Testes unitários para DXFGeometryDrawer e DXFTerrainDrawer.
Verifica SRP: cada módulo de desenho é testado isoladamente.
"""
import pytest
import math
import ezdxf
from shapely.geometry import LineString, Polygon, Point
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator
from dxf_geometry_drawer import DXFGeometryDrawer, DXFGeometryDrawer as GeoDrawer
from dxf_terrain_drawer import DXFTerrainDrawer


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def gen(tmp_path):
    return DXFGenerator(str(tmp_path / "test_modular.dxf"))


@pytest.fixture
def geo_drawer(gen):
    return gen._geom_drawer


@pytest.fixture
def terrain_drawer(gen):
    return gen._terrain_drawer


# ── DXFGeometryDrawer ─────────────────────────────────────────────────────────

class TestDXFGeometryDrawer:
    def test_get_thickness_from_height_tag(self):
        assert GeoDrawer.get_thickness({'height': '10'}, 'sisTOPO_EDIFICACAO') == 10.0

    def test_get_thickness_from_levels_tag(self):
        assert GeoDrawer.get_thickness({'building:levels': '3'}, 'sisTOPO_EDIFICACAO') == 9.0

    def test_get_thickness_default(self):
        assert GeoDrawer.get_thickness({'building': 'yes'}, 'sisTOPO_EDIFICACAO') == 3.5

    def test_get_thickness_non_building_returns_zero(self):
        assert GeoDrawer.get_thickness({'highway': 'residential'}, 'sisTOPO_VIAS') == 0.0

    def test_sanitize_attribs_cleans_nan(self):
        cleaned = GeoDrawer._sanitize_attribs({'key': 'nan', 'other': 'value'})
        assert cleaned['key'] == 'N/A'
        assert cleaned['other'] == 'value'

    def test_draw_linestring_adds_entity(self, geo_drawer, gen):
        line = LineString([(0, 0), (10, 10)])
        tags = {'highway': 'residential'}
        geo_drawer._draw_linestring(line, 'sisTOPO_VIAS', 0, 0, tags)
        entities = [e for e in gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 1

    def test_draw_polygon_adds_entity(self, geo_drawer, gen):
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        tags = {'building': 'yes'}
        geo_drawer._draw_polygon(poly, 'sisTOPO_EDIFICACAO', 0, 0, tags)
        entities = [e for e in gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 1

    def test_draw_street_offsets_creates_curbs(self, geo_drawer, gen):
        line = LineString([(0, 0), (100, 0)])
        tags = {'highway': 'primary'}
        geo_drawer._draw_street_offsets(line, tags, 0, 0)
        curbs = [e for e in gen.msp if e.dxftype() == 'LWPOLYLINE' and e.dxf.layer == 'sisTOPO_VIAS_MEIO_FIO']
        assert len(curbs) == 2

    def test_draw_street_offsets_footway_skipped(self, geo_drawer, gen):
        line = LineString([(0, 0), (100, 0)])
        tags = {'highway': 'footway'}
        geo_drawer._draw_street_offsets(line, tags, 0, 0)
        curbs = [e for e in gen.msp if e.dxftype() == 'LWPOLYLINE' and e.dxf.layer == 'sisTOPO_VIAS_MEIO_FIO']
        assert len(curbs) == 0

    def test_draw_point_vegetation_uses_block(self, geo_drawer, gen):
        pt = Point(5, 5)
        tags = {'natural': 'tree'}
        geo_drawer._draw_point(pt, 'sisTOPO_VEGETACAO', 0, 0, tags)
        blocks = [e for e in gen.msp if e.dxftype() == 'INSERT' and e.dxf.name == 'ARVORE']
        assert len(blocks) >= 1


# ── DXFTerrainDrawer ──────────────────────────────────────────────────────────

class TestDXFTerrainDrawer:
    @pytest.fixture
    def simple_grid(self):
        """Grade 3x3 simples com elevação."""
        return [
            [(0, 0, 10), (10, 0, 11), (20, 0, 12)],
            [(0, 10, 11), (10, 10, 13), (20, 10, 12)],
            [(0, 20, 12), (10, 20, 14), (20, 20, 13)],
        ]

    def test_add_terrain_from_grid_adds_points(self, terrain_drawer, gen, simple_grid):
        terrain_drawer.add_terrain_from_grid(simple_grid, generate_tin=False)
        points = [e for e in gen.msp if e.dxftype() == 'POINT']
        assert len(points) == 9  # 3x3 grid

    def test_add_tin_mesh_generates_3dfaces(self, terrain_drawer, gen, simple_grid):
        terrain_drawer.add_tin_mesh(simple_grid)
        faces = [e for e in gen.msp if e.dxftype() == '3DFACE']
        assert len(faces) > 0

    def test_add_contour_lines_adds_polylines(self, terrain_drawer, gen):
        contours = [
            [(0, 0, 10), (10, 0, 10), (20, 0, 10)],
            [(0, 0, 15), (10, 0, 15), (20, 0, 15)],
        ]
        terrain_drawer.add_contour_lines(contours, interval=1.0)
        polylines = [e for e in gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(polylines) >= 2

    def test_terrain_layer_created(self, terrain_drawer, gen, simple_grid):
        terrain_drawer.add_terrain_from_grid(simple_grid, generate_tin=False)
        assert 'sisTOPO_TERRENO_PONTOS' in gen.doc.layers

    def test_tin_layer_created(self, terrain_drawer, gen, simple_grid):
        terrain_drawer.add_tin_mesh(simple_grid)
        assert 'sisTOPO_TERRENO_TIN' in gen.doc.layers
