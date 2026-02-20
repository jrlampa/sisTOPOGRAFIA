import numpy as np
import matplotlib.pyplot as plt
from typing import List, Any

class ContourService:
    """Pure domain service for generating topographic contours."""
    
    @staticmethod
    def generate_contours(z_grid: np.ndarray, dx: float, dy: float, interval: float = 1.0) -> List[Dict[str, Any]]:
        """
        Generates contour lines (isolines) from elevation grid.
        Returns a list of dicts with 'elevation' and 'points'.
        """
        rows, cols = z_grid.shape
        x = np.arange(0, cols) * dx
        y = np.arange(0, rows) * dy
        X, Y = np.meshgrid(x, y)
        
        # Calculate levels based on intervals
        z_min, z_max = z_grid.min(), z_grid.max()
        levels = np.arange(np.floor(z_min), np.ceil(z_max) + interval, interval)
        
        if len(levels) < 2:
            return []

        # Use matplotlib's contour engine (pure math part)
        cs = plt.contour(X, Y, z_grid, levels=levels)
        plt.close() # Don't actually plot
        
        results = []
        for i, collection in enumerate(cs.collections):
            level = cs.levels[i]
            for path in collection.get_paths():
                vertices = path.vertices
                if len(vertices) > 2:
                    results.append({
                        'elevation': float(level),
                        'points': vertices.tolist(),
                        'is_major': (level % (5 * interval) == 0)
                    })
        return results
