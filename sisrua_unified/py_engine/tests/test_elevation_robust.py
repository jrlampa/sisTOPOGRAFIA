import pytest
from unittest.mock import MagicMock, patch
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from elevation_client import (
    is_within_brazil, 
    fetch_elevation_grid, 
    _fetch_elevation_grid_topodata,
    _fetch_elevation_grid_open_elevation
)

class TestElevationClient:

    def test_is_within_brazil(self):
        # Center of SP
        assert is_within_brazil(-23.5, -46.6)
        # London
        assert not is_within_brazil(51.5, -0.1)

    @patch("elevation_client._fetch_elevation_grid_topodata")
    def test_fetch_elevation_grid_brazil(self, mock_topodata):
        mock_topodata.return_value = ([], 0, 0)
        # Coordinates in Brazil
        fetch_elevation_grid(-23, -24, -46, -47)
        mock_topodata.assert_called_once()

    @patch("elevation_client._fetch_elevation_grid_open_elevation")
    def test_fetch_elevation_grid_international(self, mock_open_elev):
        mock_open_elev.return_value = ([], 0, 0)
        # Coordinates in Europe
        fetch_elevation_grid(50, 40, 10, 0)
        mock_open_elev.assert_called_once()

    @patch("elevation_client._get_srtm")
    def test_fetch_elevation_grid_topodata_success(self, mock_get_srtm):
        mock_srtm = MagicMock()
        mock_srtm.get_elevation.return_value = 100.0
        mock_get_srtm.return_value = mock_srtm
        
        elevs, rows, cols = _fetch_elevation_grid_topodata(-23, -24, -46, -47, 1000)
        assert len(elevs) > 0
        assert elevs[0][2] == 100.0

    @patch("elevation_client.requests.post")
    def test_fetch_elevation_grid_open_elevation_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "results": [{"latitude": 0, "longitude": 0, "elevation": 50}]
        }
        mock_post.return_value = mock_resp
        
        # We need to make sure the input triggers exactly 1 point for the mock response size
        # Lat/Lon ranges that result in 1x1 grid or similar
        elevs, rows, cols = _fetch_elevation_grid_open_elevation(0.0001, 0, 0.0001, 0, 10)
        assert len(elevs) >= 1
        # The mock returns 50 for any point in the batch
        assert any(e[2] == 50 for e in elevs)

    @patch("elevation_client.subprocess.run")
    def test_fetch_elevation_topodata_cmd(self, mock_run):
        from elevation_client import fetch_elevation_topodata
        mock_run.return_value = MagicMock(returncode=0, stdout='{"elevation": 123.4}')
        assert fetch_elevation_topodata(-23, -46) == 123.4
