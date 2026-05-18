import pytest
import numpy as np
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contour_generator import generate_contours

class TestContourGenerator:

    def test_generate_contours_flat(self):
        # Flat area should return empty list
        grid = [
            [(0,0,10), (10,0,10)],
            [(0,10,10), (10,10,10)]
        ]
        assert generate_contours(grid) == []

    def test_generate_contours_success(self):
        # A simple slope
        grid = [
            [(0,0,10), (10,0,10)],
            [(0,10,12), (10,10,12)]
        ]
        # Should generate at least one contour (e.g. at 11m)
        contours = generate_contours(grid, interval=1.0)
        assert len(contours) > 0
        assert all(len(c) >= 2 for c in contours)
        # Check Z value of first point in first contour
        assert contours[0][0][2] in [10.0, 11.0, 12.0]

    def test_generate_contours_error_handling(self):
        # Malformed grid
        assert generate_contours(None) == []
        assert generate_contours([]) == []
        assert generate_contours([[ (0,0) ]]) == [] # Missing Z
