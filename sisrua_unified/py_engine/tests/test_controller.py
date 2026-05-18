import pytest
from unittest.mock import MagicMock, patch
import geopandas as gpd
from shapely.geometry import Point, LineString
import pandas as pd
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from controller import OSMController

@pytest.fixture
def mock_gdf():
    data = {
        'geometry': [Point(0, 0), LineString([(0, 0), (1, 1)])],
        'building': [True, None],
        'highway': [None, 'residential']
    }
    gdf = gpd.GeoDataFrame(data, crs="EPSG:4326")
    return gdf

@pytest.fixture
def default_config():
    return {
        "buildings": True,
        "roads": True,
        "nature": False,
        "terrain": False,
        "georef": True
    }

class TestOSMController:
    
    def test_init(self, default_config):
        controller = OSMController(
            lat=-23.5505,
            lon=-46.6333,
            radius=500,
            output_file="test.dxf",
            layers_config=default_config,
            crs="EPSG:31983"
        )
        assert controller.lat == -23.5505
        assert controller.selection_mode == "circle"
        assert controller.project_metadata["client"] == "CLIENTE PADRÃO"

    @patch("controller.fetch_osm_data")
    @patch("controller.DXFGenerator")
    def test_run_empty_data(self, mock_dxf_gen_class, mock_fetch, default_config):
        # Setup mock for empty result
        mock_fetch.return_value = gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
        mock_dxf_gen = MagicMock()
        mock_dxf_gen_class.return_value = mock_dxf_gen
        
        controller = OSMController(
            lat=-23.5505, lon=-46.6333, radius=500,
            output_file="test_empty.dxf",
            layers_config=default_config,
            crs="EPSG:31983"
        )
        
        controller.run()
        
        # Verify that it handled the empty case by creating an INFO text
        mock_dxf_gen.msp.add_text.assert_called()
        mock_dxf_gen.doc.saveas.assert_called_with("test_empty.dxf")

    @patch("controller.fetch_osm_data")
    @patch("controller.run_spatial_audit")
    @patch("controller.DXFGenerator")
    def test_run_with_data(self, mock_dxf_gen_class, mock_audit, mock_fetch, mock_gdf, default_config):
        mock_fetch.return_value = mock_gdf
        mock_audit.return_value = ({"violations": 2, "coverageScore": 85}, mock_gdf)
        
        mock_dxf_gen = MagicMock()
        mock_dxf_gen.bounds = (0, 0, 100, 100)
        mock_dxf_gen_class.return_value = mock_dxf_gen
        
        controller = OSMController(
            lat=-23.5505, lon=-46.6333, radius=500,
            output_file="test_full.dxf",
            layers_config=default_config,
            crs="EPSG:31983"
        )
        
        controller.run()
        
        # Verify orchestration
        mock_fetch.assert_called_once()
        mock_audit.assert_called_once()
        mock_dxf_gen.add_features.assert_called_once()
        mock_dxf_gen.save.assert_called_once()

    def test_build_tags(self, default_config):
        controller = OSMController(0, 0, 0, "", default_config, "EPSG:4326")
        tags = controller._build_tags()
        assert "building" in tags
        assert "highway" in tags
        assert "natural" not in tags

    def test_project_bt_topology(self, default_config):
        controller = OSMController(0, 0, 0, "", default_config, "EPSG:31983")
        controller.bt_context = {
            "topology": {
                "poles": [{"id": "P1", "lat": -23.5, "lng": -46.6, "title": "Pole 1"}],
                "transformers": [{"id": "T1", "lat": -23.501, "lng": -46.601, "poleId": "P1"}],
                "edges": [{"id": "E1", "fromPoleId": "P1", "toPoleId": "P1"}]
            }
        }
        
        projected = controller._project_bt_topology("EPSG:31983")
        assert "poles" in projected
        assert len(projected["poles"]) == 1
        assert "x" in projected["poles"][0]
        assert "y" in projected["poles"][0]
        assert len(projected["transformers"]) == 1
        assert len(projected["edges"]) == 1

    @patch("controller.fetch_elevation_grid")
    @patch("controller.generate_contours")
    def test_process_terrain(self, mock_gen_contours, mock_fetch_elev, default_config, mock_gdf):
        mock_fetch_elev.return_value = ([(0,0,10), (0,1,11), (1,0,12), (1,1,13)], 2, 2)
        mock_gen_contours.return_value = [[(0,0,10), (1,1,10)]]
        
        mock_dxf_gen = MagicMock()
        controller = OSMController(0, 0, 0, "", default_config, "EPSG:31983")
        controller.layers_config["contours"] = True
        
        # Test terrain processing
        controller._process_terrain(mock_gdf, mock_dxf_gen)
        
        mock_fetch_elev.assert_called_once()
        mock_dxf_gen.add_terrain_from_grid.assert_called_once()
        mock_dxf_gen.add_contour_lines.assert_called_once()
        assert controller.elevation_metadata["source"] in ["TOPODATA (INPE)", "Open-Elevation"]

    def test_auto_selected_crs(self, default_config, mock_gdf):
        controller = OSMController(
            lat=-23.5505, lon=-46.6333, radius=500,
            output_file="test.dxf",
            layers_config=default_config,
            crs="auto"
        )
        # Should call run_spatial_audit which triggers auto-CRS if crs="auto"
        # We need to mock run_spatial_audit to see what happens inside
        with patch("controller.run_spatial_audit") as mock_audit:
            mock_audit.return_value = ({"violations": 0}, mock_gdf)
            controller.run()
            # Check if Logger.info was called with Auto-selected CRS
            # (We could also check internal target_epsg if it was saved, but it's local in controller)
            mock_audit.assert_called_once()

    @patch("controller.fetch_osm_data")
    @patch("controller.DXFGenerator")
    def test_run_with_kml_export(self, mock_dxf_gen_class, mock_fetch, default_config, mock_gdf):
        mock_fetch.return_value = mock_gdf
        controller = OSMController(0, 0, 0, "test.kml", default_config, "EPSG:4326", export_format="kml")
        
        mock_dxf_gen = MagicMock()
        mock_dxf_gen.bounds = (0, 0, 100, 100)
        mock_dxf_gen_class.return_value = mock_dxf_gen
        
        # We assume to_file is called if execution reaches success status message
        controller.run()
        assert controller.audit_summary is not None

    def test_project_mt_topology(self, default_config):
        controller = OSMController(0, 0, 0, "", default_config, "EPSG:31983")
        controller.mt_context = {
            "topology": {
                "poles": [
                    {"id": "MP1", "lat": -23.5, "lng": -46.6},
                    {"id": "MP2", "lat": -23.51, "lng": -46.61}
                ],
                "edges": [
                    {"id": "ME1", "fromPoleId": "MP1", "toPoleId": "MP2"},
                    {"id": "ME2", "fromPoleId": "MP2", "toPoleId": "MP1"} # Loop test
                ]
            }
        }
        
        projected = controller._project_mt_topology("EPSG:31983")
        assert len(projected["poles"]) == 2
        assert len(projected["edges"]) == 2
        assert "x" in projected["poles"][0]
        assert "y" in projected["poles"][1]
