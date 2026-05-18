import pytest
from unittest.mock import MagicMock, patch
import sys
import json
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import main

class TestMain:

    @patch("main.argparse.ArgumentParser.parse_args")
    @patch("main.OSMController")
    @patch("main.validate_inputs")
    def test_main_success(self, mock_validate, mock_controller_class, mock_parse_args):
        # Setup mock args
        mock_args = MagicMock()
        mock_args.lat = -23.0
        mock_args.lon = -43.0
        mock_args.radius = 500.0
        mock_args.output = "test.dxf"
        mock_args.layers = "{}"
        mock_args.crs = "auto"
        mock_args.projection = "local"
        mock_args.format = "dxf"
        mock_args.selection_mode = "circle"
        mock_args.polygon = "[]"
        mock_args.contour_style = "spline"
        mock_args.client_name = "CLIENT"
        mock_args.project_id = "PROJ"
        mock_args.bt_context = "{}"
        mock_args.mt_context = "{}"
        mock_args.no_preview = False
        mock_args.memory_limit_mb = 0
        mock_parse_args.return_value = mock_args

        # Mock validation result
        mock_validated = MagicMock()
        mock_validated.lat = -23.0
        mock_validated.lon = -43.0
        mock_validated.radius = 500.0
        mock_validated.output = "test.dxf"
        mock_validated.layers = {"buildings": True}
        mock_validated.selection_mode = "circle"
        mock_validated.polygon = []
        mock_validated.contour_style = "spline"
        mock_validated.bt_context = {}
        mock_validated.mt_context = {}
        mock_validated.memory_limit_mb = 0
        mock_validate.return_value = mock_validated

        mock_controller = MagicMock()
        mock_controller_class.return_value = mock_controller

        # Execute main
        main()

        # Verify calls
        mock_controller_class.assert_called_once()
        mock_controller.run.assert_called_once()

    @patch("main.argparse.ArgumentParser.parse_args")
    @patch("main.sys.exit")
    def test_main_invalid_json(self, mock_exit, mock_parse_args):
        mock_args = MagicMock()
        mock_args.layers = "{invalid_json}"
        mock_args.memory_limit_mb = 0
        mock_args.no_preview = False
        mock_parse_args.return_value = mock_args

        main()
        mock_exit.assert_called_with(1)

    @patch("main.argparse.ArgumentParser.parse_args")
    @patch("main.validate_inputs")
    @patch("main.sys.exit")
    def test_main_validation_error(self, mock_exit, mock_validate, mock_parse_args):
        mock_args = MagicMock()
        mock_args.layers = "{}"
        mock_args.polygon = "[]"
        mock_args.bt_context = "{}"
        mock_args.mt_context = "{}"
        mock_args.memory_limit_mb = 0
        mock_args.no_preview = False
        mock_parse_args.return_value = mock_args
        
        # Pydantic validation failure (if available) or manual failure
        mock_validate.side_effect = Exception("Validation Failed")
        
        main()
        mock_exit.assert_called_with(1)
