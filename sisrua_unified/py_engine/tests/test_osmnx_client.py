import pytest
from unittest.mock import MagicMock, patch
import geopandas as gpd
from shapely.geometry import Point, Polygon
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from osmnx_client import fetch_osm_data, _clip_to_boundary

@pytest.fixture
def sample_gdf():
    data = {'geometry': [Point(-43.1729, -22.9068), Point(-43.1730, -22.9069)]}
    gdf = gpd.GeoDataFrame(data, crs="EPSG:4326")
    return gdf

class TestOSMnxClient:

    @patch("osmnx_client.ox.features.features_from_point")
    def test_fetch_osm_data_point(self, mock_from_point, sample_gdf):
        mock_from_point.return_value = sample_gdf
        
        # We need to project the sample_gdf because fetch_osm_data will try to project it
        # Since we are mocking ox, we should also mock ox.projection.project_gdf
        with patch("osmnx_client.ox.projection.project_gdf") as mock_proj:
            mock_proj.return_value = sample_gdf.to_crs("EPSG:3857") # Projection to Web Mercator for simplicity
            
            gdf = fetch_osm_data(-22.9068, -43.1729, 100, {"building": True})
            
            assert not gdf.empty
            mock_from_point.assert_called_once()

    @patch("osmnx_client.ox.features.features_from_polygon")
    def test_fetch_osm_data_polygon(self, mock_from_polygon, sample_gdf):
        mock_from_polygon.return_value = sample_gdf
        # Point is at -43.17, -22.90. Polygon should wrap it.
        poly_points = [[-22.90, -43.17], [-22.91, -43.17], [-22.91, -43.18], [-22.90, -43.18], [-22.90, -43.17]]
        
        with patch("osmnx_client.ox.projection.project_gdf") as mock_proj:
            mock_proj.return_value = sample_gdf.to_crs("EPSG:3857")
            
            gdf = fetch_osm_data(0, 0, 0, {"building": True}, polygon=poly_points)
            
            assert not gdf.empty
            mock_from_polygon.assert_called_once()

    def test_clip_to_boundary_circle(self, sample_gdf):
        gdf_proj = sample_gdf.to_crs("EPSG:3857")
        clipped = _clip_to_boundary(gdf_proj, -22.9068, -43.1729, 10000, None)
        assert len(clipped) == 2

    def test_clip_to_boundary_empty(self, sample_gdf):
        gdf_proj = sample_gdf.to_crs("EPSG:3857")
        clipped = _clip_to_boundary(gdf_proj, 0, 0, 1, None)
        assert len(clipped) == 0

    @patch("osmnx_client.ox.features.features_from_point")
    @patch("osmnx_client.Logger")
    def test_fetch_osm_data_empty(self, mock_logger, mock_from_point):
        mock_from_point.return_value = gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
        gdf = fetch_osm_data(-22.0, -43.0, 100, {"building": True})
        assert gdf.empty
