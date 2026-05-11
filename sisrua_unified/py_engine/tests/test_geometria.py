import pytest
import math
import pandas as pd
from shapely.geometry import Polygon, Point, LineString, MultiPolygon
import ezdxf
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf.generator import DXFGenerator

@pytest.fixture
def dxf_gen(tmp_path):
    output_file = tmp_path / "test_geo.dxf"
    return DXFGenerator(str(output_file))

class TestGeometriaMixin:

    def test_determine_layer_power(self, dxf_gen):
        # Power HV
        tags = {"power": "line"}
        assert dxf_gen.determine_layer(tags, None) == "INFRA_POWER_HV"
        
        # Power LV
        tags = {"power": "pole"}
        assert dxf_gen.determine_layer(tags, None) == "INFRA_POWER_LV"

    def test_determine_layer_urban_furniture(self, dxf_gen):
        tags = {"amenity": "bench"}
        assert dxf_gen.determine_layer(tags, None) == "MOBILIARIO_URBANO"
        
        tags = {"highway": "street_lamp"}
        assert dxf_gen.determine_layer(tags, None) == "MOBILIARIO_URBANO"

    def test_determine_layer_nature_and_leisure(self, dxf_gen):
        tags = {"natural": "tree"}
        assert dxf_gen.determine_layer(tags, None) == "VEGETACAO"
        
        tags = {"leisure": "park"}
        assert dxf_gen.determine_layer(tags, None) == "VEGETACAO"

    def test_determine_layer_water(self, dxf_gen):
        tags = {"waterway": "river"}
        assert dxf_gen.determine_layer(tags, None) == "HIDROGRAFIA"

    def test_get_thickness(self, dxf_gen):
        # Case: building height
        tags = {"building": "yes", "height": "12.5"}
        assert dxf_gen._get_thickness(tags, "EDIFICACAO") == 12.5
        
        # Case: building levels
        tags = {"building": "yes", "building:levels": "3"}
        assert dxf_gen._get_thickness(tags, "EDIFICACAO") == 9.0
        
        # Case: default height
        tags = {"building": "yes"}
        assert dxf_gen._get_thickness(tags, "EDIFICACAO") == 3.5
        
        # Case: not a building
        assert dxf_gen._get_thickness(tags, "ROADS") == 0.0

    def test_draw_polygon_with_area_text(self, dxf_gen):
        poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        tags = {"building": "yes"}
        dxf_gen._draw_polygon(poly, "EDIFICACAO", 0, 0, tags)
        
        # Check for lwpolyline (the building outline)
        polylines = [e for e in dxf_gen.msp if e.dxftype() == "LWPOLYLINE"]
        assert len(polylines) >= 1
        
        # Check for area text
        texts = [e.dxf.text for e in dxf_gen.msp if e.dxftype() == "TEXT"]
        assert any("100.0 m2" in t for t in texts)

    def test_draw_street_offsets(self, dxf_gen):
        line = LineString([(0, 0), (100, 0)])
        tags = {"highway": "primary"}
        # Ensure VIAS_MEIO_FIO layer exists
        if "VIAS_MEIO_FIO" not in dxf_gen.doc.layers:
            dxf_gen.doc.layers.new("VIAS_MEIO_FIO")
            
        dxf_gen._draw_street_offsets(line, tags, 0, 0)
        
        # Should have 2 polylines (left and right curb)
        curbs = [e for e in dxf_gen.msp if e.dxftype() == "LWPOLYLINE" and e.dxf.layer == "VIAS_MEIO_FIO"]
        assert len(curbs) == 2

    def test_add_terrain_from_grid(self, dxf_gen):
        grid = [
            [(0, 0, 10), (10, 0, 12)],
            [(0, 10, 11), (10, 10, 13)]
        ]
        dxf_gen.add_terrain_from_grid(grid)
        
        # ezdxf add_polymesh actually creates a PolyfaceMesh which is a POLYLINE entity
        meshes = [e for e in dxf_gen.msp if e.dxftype() == "POLYLINE"]
        assert len(meshes) == 1
        # Correct attribute name is is_poly_face_mesh
        assert meshes[0].is_poly_face_mesh or meshes[0].is_polygon_mesh

    def test_geometria_utils_safe_v(self, dxf_gen):
        assert dxf_gen._safe_v(10.5) == 10.5
        assert dxf_gen._safe_v(float('nan'), fallback_val=5.0) == 5.0
        # If fallback is None, it returns 0.0
        assert dxf_gen._safe_v(float('nan'), fallback_val=None) == 0.0

    def test_geometria_utils_validate_points(self, dxf_gen):
        valid_pts = [(0,0), (1,1), (2,2)]
        assert dxf_gen._validate_points(valid_pts) == [(0.0, 0.0), (1.0, 1.0), (2.0, 2.0)]
        
        # NaN is converted to 0.0 by _safe_v when fallback is None
        invalid_pts = [(0,0), (float('nan'), 1)]
        validated = dxf_gen._validate_points(invalid_pts)
        assert len(validated) == 2
        assert validated[1] == (0.0, 1.0)

    def test_distance(self, dxf_gen):
        assert dxf_gen._distance((0,0), (3,4)) == 5.0

    def test_label_placement(self, dxf_gen):
        # Reset used points
        dxf_gen._used_label_points = []
        p1 = dxf_gen._find_clear_label_point((0,0), min_distance=10)
        assert p1 == (0,0)
        
        p2 = dxf_gen._find_clear_label_point((0,0), min_distance=10)
        # Should pick second offset (0, 4) if min_dist is 10? No, (0,4) is dist 4 from (0,0).
        # It will iterate until one is > 10m away or fallback.
        assert p2 != (0,0)
        assert p2 in dxf_gen._used_label_points

    def test_should_draw_street_label(self, dxf_gen):
        dxf_gen._street_label_registry = {}
        # Too short
        assert not dxf_gen._should_draw_street_label("Rua A", (0,0), 10.0)
        # OK
        assert dxf_gen._should_draw_street_label("Rua A", (0,0), 50.0)
        # Too close to existing
        assert not dxf_gen._should_draw_street_label("Rua A", (5,5), 50.0)
        # Duplicate limit (max 2)
        assert dxf_gen._should_draw_street_label("Rua A", (100,100), 50.0)
        assert not dxf_gen._should_draw_street_label("Rua A", (200,200), 50.0)

    def test_sanitize_attribs(self, dxf_gen):
        raw = {"k1": "val", "k2": float('nan'), "k3": "  "}
        sanitized = dxf_gen._sanitize_attribs(raw)
        assert sanitized["k1"] == "val"
        assert sanitized["k2"] == "N/A"
        assert sanitized["k3"] == "N/A"

    def test_merge_contiguous_lines(self, dxf_gen):
        l1 = LineString([(0,0), (10,0)])
        l2 = LineString([(10,0), (20,0)])
        tags = {"highway": "residential", "name": "Rua 1"}
        
        merged = dxf_gen._merge_contiguous_lines([(l1, tags), (l2, tags)])
        assert len(merged) == 1
        assert merged[0][0].length == 20.0

    def test_add_contour_lines(self, dxf_gen):
        contours = [
            [(0, 0, 10), (10, 0, 10), (10, 10, 10)],
            [(0, 5, 11), (5, 5, 11)]
        ]
        dxf_gen.add_contour_lines(contours, use_spline=True)
        
        # First contour should be a SPLINE (length >= 3)
        splines = [e for e in dxf_gen.msp if e.dxftype() == "SPLINE"]
        assert len(splines) == 1
        
        # Second contour should be a POLYLINE (length < 3)
        polylines = [e for e in dxf_gen.msp if e.dxftype() == "POLYLINE"]
        assert len(polylines) == 1

    def test_add_cartographic_elements(self, dxf_gen):
        # Create dummy blocks if they don't exist (StyleManager should have done this, but let's be safe)
        for block_name in ["NORTE", "ESCALA"]:
            if block_name not in dxf_gen.doc.blocks:
                dxf_gen.doc.blocks.new(name=block_name)
        
        dxf_gen.add_cartographic_elements(0, 0, 100, 100, 0, 0)
        
        inserts = [e for e in dxf_gen.msp if e.dxftype() == "INSERT"]
        block_names = [e.dxf.name for e in inserts]
        assert "NORTE" in block_names
        assert "ESCALA" in block_names

    def test_add_coordinate_grid(self, dxf_gen):
        dxf_gen.add_coordinate_grid(0, 0, 100, 100, 0, 0)
        
        # Check for frame
        frame = [e for e in dxf_gen.msp if e.dxftype() == "LWPOLYLINE" and e.dxf.layer == "QUADRO"]
        assert len(frame) == 1
        
        # Check for coordinate labels (should have several)
        labels = [e for e in dxf_gen.msp if e.dxftype() == "TEXT" and e.dxf.layer == "QUADRO"]
        assert len(labels) > 0
        assert any("E: 0" in e.dxf.text for e in labels)
        assert any("N: 50" in e.dxf.text for e in labels)
