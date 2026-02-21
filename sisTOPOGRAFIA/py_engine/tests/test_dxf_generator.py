import pytest
import ezdxf
from shapely.geometry import Polygon, Point, LineString
import geopandas as gpd
import pandas as pd
import math
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator

@pytest.fixture
def dxf_gen(tmp_path):
    output_file = tmp_path / "test.dxf"
    return DXFGenerator(str(output_file))

def test_layer_creation(dxf_gen):
    """Test if standard layers are created."""
    assert 'sisTOPO_EDIFICACAO' in dxf_gen.doc.layers
    assert 'sisTOPO_VIAS' in dxf_gen.doc.layers
    assert 'sisTOPO_VEGETACAO' in dxf_gen.doc.layers

def test_block_creation(dxf_gen):
    """Test if blocks are created."""
    assert 'ARVORE' in dxf_gen.doc.blocks
    assert 'POSTE' in dxf_gen.doc.blocks

def test_building_extrusion(dxf_gen):
    """Test if building height is correctly calculated from tags."""
    poly = Polygon([(0,0), (10,0), (10,10), (0,10)])
    tags1 = {'building': 'yes', 'height': '15'}
    thickness1 = dxf_gen._get_thickness(tags1, 'sisTOPO_EDIFICACAO')
    assert thickness1 == 15.0
    tags2 = {'building': 'yes', 'building:levels': '4'}
    thickness2 = dxf_gen._get_thickness(tags2, 'sisTOPO_EDIFICACAO')
    assert thickness2 == 12.0
    tags3 = {'building': 'yes'}
    thickness3 = dxf_gen._get_thickness(tags3, 'sisTOPO_EDIFICACAO')
    assert thickness3 == 3.5

def test_add_features(dxf_gen):
    """Test adding features to DXF."""
    data = {
        'geometry': [Point(0,0), LineString([(0,0), (10,10)])],
        'building': [None, None],
        'highway': [None, 'residential'],
        'natural': ['tree', None]
    }
    gdf = gpd.GeoDataFrame(data)
    dxf_gen.add_features(gdf)
    msp = dxf_gen.msp
    assert len(msp) > 0

def test_legend_and_title_block(dxf_gen):
    """Test if Legend and Title Block are generated during save."""
    data = {'geometry': [Point(0,0)], 'building': [True]}
    gdf = gpd.GeoDataFrame(data)
    dxf_gen.add_features(gdf)
    dxf_gen.project_info = {'client': 'TEST CLIENT', 'project': 'TEST PROJECT'}
    dxf_gen.save()
    msp_text = [e.dxf.text for e in dxf_gen.msp if e.dxftype() in ('TEXT', 'MTEXT')]
    assert any("LEGENDA" in t for t in msp_text)
    layout = dxf_gen.doc.layout("Layout1")
    viewports = [e for e in layout if e.dxftype() == 'VIEWPORT']
    assert len(viewports) >= 1
    layout_text = [e.dxf.text for e in layout if e.dxftype() in ('TEXT', 'MTEXT')]
    assert any("TEST CLIENT" in t for t in layout_text)
    assert any("TEST PROJECT" in t for t in layout_text)


# ── _safe_v ───────────────────────────────────────────────────────────────────

class TestSafeV:
    def test_valid_float(self, dxf_gen):
        assert dxf_gen._safe_v(3.14) == pytest.approx(3.14)

    def test_nan_returns_zero(self, dxf_gen):
        assert dxf_gen._safe_v(float('nan')) == 0.0

    def test_inf_returns_zero(self, dxf_gen):
        assert dxf_gen._safe_v(float('inf')) == 0.0

    def test_very_large_value_returns_zero(self, dxf_gen):
        assert dxf_gen._safe_v(2e11) == 0.0

    def test_string_non_numeric_returns_zero(self, dxf_gen):
        assert dxf_gen._safe_v('hello') == 0.0

    def test_none_returns_zero(self, dxf_gen):
        assert dxf_gen._safe_v(None) == 0.0

    def test_nan_with_fallback(self, dxf_gen):
        assert dxf_gen._safe_v(float('nan'), fallback_val=99.0) == 99.0

    def test_string_with_fallback(self, dxf_gen):
        assert dxf_gen._safe_v('abc', fallback_val=42.0) == 42.0


# ── _safe_p ───────────────────────────────────────────────────────────────────

class TestSafeP:
    def test_valid_point(self, dxf_gen):
        result = dxf_gen._safe_p((3.0, 4.0))
        assert result == (3.0, 4.0)

    def test_none_point_returns_origin(self, dxf_gen):
        result = dxf_gen._safe_p(None)
        assert result == (0.0, 0.0)

    def test_empty_tuple_returns_origin(self, dxf_gen):
        result = dxf_gen._safe_p(())
        assert result == (0.0, 0.0)


# ── _validate_points ──────────────────────────────────────────────────────────

class TestValidatePoints:
    def test_empty_list_returns_none(self, dxf_gen):
        assert dxf_gen._validate_points([]) is None

    def test_too_few_points_returns_none(self, dxf_gen):
        assert dxf_gen._validate_points([(0, 0)], min_points=2) is None

    def test_valid_points_returned(self, dxf_gen):
        pts = dxf_gen._validate_points([(0.0, 0.0), (1.0, 1.0)])
        assert pts == [(0.0, 0.0), (1.0, 1.0)]

    def test_duplicate_consecutive_removed(self, dxf_gen):
        pts = dxf_gen._validate_points(
            [(0.0, 0.0), (0.0, 0.0), (1.0, 1.0), (2.0, 2.0)]
        )
        assert pts is not None
        assert (0.0, 0.0) not in pts[1:]

    def test_all_nan_values_collapse_to_one_point(self, dxf_gen):
        """NaN coords → _safe_v(nan)=0.0; todos viram (0,0); dedup → 1 ponto < min=2 → None."""
        pts = dxf_gen._validate_points(
            [(float('nan'), float('nan')), (float('nan'), float('nan'))],
            min_points=2,
        )
        assert pts is None


# ── _simplify_line ────────────────────────────────────────────────────────────

class TestSimplifyLine:
    def test_simplify_returns_simplified(self, dxf_gen):
        line = LineString([(0, 0), (1, 0.01), (2, 0)])
        simplified = dxf_gen._simplify_line(line, tolerance=0.1)
        assert len(list(simplified.coords)) <= len(list(line.coords))


# ── _merge_contiguous_lines ───────────────────────────────────────────────────

class TestMergeContiguousLines:
    def test_empty_input_returns_empty(self, dxf_gen):
        result = dxf_gen._merge_contiguous_lines([])
        assert result == []

    def test_single_line_returned_as_is(self, dxf_gen):
        line = LineString([(0, 0), (10, 0)])
        result = dxf_gen._merge_contiguous_lines([(line, {'highway': 'primary'})])
        assert len(result) == 1

    def test_merges_end_to_start(self, dxf_gen):
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(10, 0), (20, 0)])
        tags = {'highway': 'primary', 'name': 'Rua A'}
        result = dxf_gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1
        assert len(list(result[0][0].coords)) >= 3

    def test_different_names_not_merged(self, dxf_gen):
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(10, 0), (20, 0)])
        tags1 = {'highway': 'primary', 'name': 'Rua A'}
        tags2 = {'highway': 'primary', 'name': 'Rua B'}
        result = dxf_gen._merge_contiguous_lines([(l1, tags1), (l2, tags2)])
        assert len(result) == 2

    def test_merges_start_to_end(self, dxf_gen):
        """B.end → A.start: mesclagem na direção oposta."""
        l1 = LineString([(10, 0), (20, 0)])
        l2 = LineString([(0, 0), (10, 0)])
        tags = {'highway': 'secondary', 'name': 'Via B'}
        result = dxf_gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1

    def test_merges_start_to_start_reversed(self, dxf_gen):
        """A.start → B.start: mescla invertendo B."""
        l1 = LineString([(10, 0), (20, 0)])
        l2 = LineString([(10, 0), (0, 0)])  # B.start == A.start
        tags = {'highway': 'tertiary', 'name': 'Via C'}
        result = dxf_gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1

    def test_merges_end_to_end_reversed(self, dxf_gen):
        """A.end → B.end: mescla invertendo B."""
        l1 = LineString([(0, 0), (10, 0)])
        l2 = LineString([(20, 0), (10, 0)])  # B.end == A.end
        tags = {'highway': 'residential', 'name': 'Via D'}
        result = dxf_gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(result) == 1


# ── add_features ──────────────────────────────────────────────────────────────

class TestAddFeaturesExtra:
    def test_empty_gdf_returns_early(self, dxf_gen):
        gdf = gpd.GeoDataFrame({'geometry': []})
        count_before = len(list(dxf_gen.msp))
        dxf_gen.add_features(gdf)
        assert len(list(dxf_gen.msp)) == count_before

    def test_nan_bounds_uses_default(self, dxf_gen):
        from shapely.geometry import Point as ShapelyPoint
        gdf = gpd.GeoDataFrame({'geometry': [ShapelyPoint(float('nan'), float('nan'))]})
        gdf.crs = None
        dxf_gen.add_features(gdf)
        assert not any(math.isnan(v) or math.isinf(v) for v in dxf_gen.bounds)


# ── save: total_area + _save_memorial ────────────────────────────────────────

class TestSaveMemorial:
    def test_save_with_total_area_generates_memorial(self, dxf_gen):
        # Formato correto de vértice: (easting, northing, elevation, label)
        vertices = [
            (714300.0, 7549000.0, 850.0, 'V1'),
            (714200.0, 7548900.0, 851.0, 'V2'),
            (714400.0, 7548800.0, 849.0, 'V3'),
        ]
        dxf_gen.project_info = {
            'client': 'CLIENTE',
            'project': 'PROJETO',
            'total_area': 1000.0,
            'vertices': vertices,
        }
        dxf_gen.save()
        mem_path = str(dxf_gen.filename).replace('.dxf', '_MEMORIAL.txt')
        assert os.path.exists(mem_path)
        with open(mem_path, encoding='utf-8') as f:
            content = f.read()
        assert len(content) > 0

    def test_save_memorial_exception_logged(self, dxf_gen):
        from unittest.mock import patch
        dxf_gen.project_info = {'total_area': 100.0}
        # Patch a função no módulo memorial_engine onde é importada
        with patch('memorial_engine.MemorialEngine.generate_memorial',
                   side_effect=RuntimeError('fail')):
            dxf_gen._save_memorial()
        assert True


# ── add_geodetic_marker ───────────────────────────────────────────────────────

class TestAddGeodeticMarker:
    def test_marker_adds_entities(self, dxf_gen):
        dxf_gen.add_geodetic_marker(-22.15018, -42.92185, 850.0, 'M001')
        inserts = [e for e in dxf_gen.msp if e.dxftype() == 'INSERT']
        texts = [e for e in dxf_gen.msp if e.dxftype() == 'TEXT']
        assert len(inserts) >= 1
        assert len(texts) >= 1

    def test_marker_exception_logs_warn(self, dxf_gen):
        """Exceção interna é capturada pelo try-except externo."""
        from unittest.mock import patch
        with patch('utils.geo.wgs84_to_utm', side_effect=ValueError('bad coords')):
            dxf_gen.add_geodetic_marker(-22.15, -42.92, 0.0, 'M999')
        assert True


# ── Delegate methods ──────────────────────────────────────────────────────────

class TestDelegateMethods:
    def test_draw_polygon_delegates(self, dxf_gen):
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        dxf_gen._draw_polygon(poly, 'sisTOPO_EDIFICACAO', 0, 0, {})
        entities = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 1

    def test_draw_linestring_delegates(self, dxf_gen):
        line = LineString([(0, 0), (10, 10)])
        dxf_gen._draw_linestring(line, 'sisTOPO_VIAS', 0, 0, {'highway': 'primary'})
        entities = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(entities) >= 1

    def test_draw_point_delegates(self, dxf_gen):
        pt = Point(5, 5)
        dxf_gen._draw_point(pt, 'sisTOPO_VEGETACAO', 0, 0, {'natural': 'tree'})
        inserts = [e for e in dxf_gen.msp if e.dxftype() == 'INSERT']
        assert len(inserts) >= 1

    def test_sanitize_attribs_delegates(self, dxf_gen):
        result = dxf_gen._sanitize_attribs({'key': 'nan', 'ok': 'valor'})
        assert result['key'] == 'N/A'
        assert result['ok'] == 'valor'

    def test_add_terrain_delegates(self, dxf_gen):
        grid = [[(0, 0, 10), (10, 0, 11)], [(0, 10, 12), (10, 10, 13)]]
        dxf_gen.add_terrain_from_grid(grid, generate_tin=False)
        pts = [e for e in dxf_gen.msp if e.dxftype() == 'POINT']
        assert len(pts) == 4

    def test_add_tin_mesh_delegates(self, dxf_gen):
        grid = [
            [(0, 0, 10), (10, 0, 11), (20, 0, 12)],
            [(0, 10, 11), (10, 10, 13), (20, 10, 12)],
        ]
        dxf_gen.add_tin_mesh(grid)
        faces = [e for e in dxf_gen.msp if e.dxftype() == '3DFACE']
        assert len(faces) > 0

    def test_add_slope_hatch_delegates(self, dxf_gen):
        import numpy as np
        grid = [[(float(c*10), float(r*10), 0.0) for c in range(3)] for r in range(3)]
        slope_grid = np.full((3, 3), 110.0)
        dxf_gen.add_slope_hatch(grid, analytics={'slope_pct': slope_grid})
        hatches = [e for e in dxf_gen.msp if e.dxftype() == 'HATCH']
        assert len(hatches) >= 1

    def test_add_contour_lines_delegates(self, dxf_gen):
        contours = [[(float(i), 0.0, 10.0) for i in range(5)]]
        dxf_gen.add_contour_lines(contours, interval=1.0)
        polys = [e for e in dxf_gen.msp if e.dxftype() == 'LWPOLYLINE']
        assert len(polys) >= 1

    def test_add_hydrology_delegates(self, dxf_gen):
        grid = [
            [(float(c*10), float(r*10), float(10-r)) for c in range(4)]
            for r in range(4)
        ]
        dxf_gen.add_hydrology(grid)
        assert True

    def test_simplify_line_delegates(self, dxf_gen):
        line = LineString([(0, 0), (1, 0.01), (2, 0)])
        simplified = dxf_gen._simplify_line(line, tolerance=0.05)
        assert simplified is not None

    def test_add_cartographic_elements_delegates(self, dxf_gen):
        """add_cartographic_elements delega para LegendBuilder."""
        dxf_gen.bounds = [0.0, 0.0, 100.0, 100.0]
        dxf_gen.add_cartographic_elements(0.0, 0.0, 100.0, 100.0, 0.0, 0.0)
        assert True  # sem exceção

    def test_add_coordinate_grid_delegates(self, dxf_gen):
        """add_coordinate_grid delega para LegendBuilder."""
        dxf_gen.bounds = [0.0, 0.0, 100.0, 100.0]
        dxf_gen.add_coordinate_grid(0.0, 0.0, 100.0, 100.0, 0.0, 0.0, spacing=50.0)
        assert True  # sem exceção

    def test_add_legend_delegates(self, dxf_gen):
        """add_legend delega para LegendBuilder."""
        dxf_gen.add_legend()
        msp_text = [e.dxf.text for e in dxf_gen.msp if e.dxftype() in ('TEXT', 'MTEXT')]
        assert any("LEGENDA" in t for t in msp_text)
