import numpy as np
import matplotlib.pyplot as plt
from typing import List, Any, Dict
from shapely.geometry import LineString

class ContourService:
    """Pure domain service for generating topographic contours."""
    
    @staticmethod
    def generate_contours(z_grid: np.ndarray, dx: float, dy: float, interval: float = 1.0, tolerance: float = 0.1) -> List[Dict[str, Any]]:
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
        fig = plt.figure()
        ax = fig.add_subplot(111)
        cs = ax.contour(X, Y, z_grid, levels=levels)
        
        results = []
        
        # New Matplotlib API compatible extraction (v3.8+)
        if hasattr(cs, 'allsegs'): # Older API fallback
            all_segs = getattr(cs, 'allsegs')
            for i, segments in enumerate(all_segs):
                level = cs.levels[i]
                for seg in segments:
                    if len(seg) > 2:
                        # Usando Any para evitar erros de lint com numpy/list
                        seg_points: Any = seg
                        results.append({
                            'elevation': float(level),
                            'points': seg_points.tolist() if hasattr(seg_points, 'tolist') else [list(p) for p in seg_points],
                            'is_major': (level % (5 * interval) == 0)
                        })
        else:
            # v3.8+ extraction
            for i, path in enumerate(cs.get_paths()):
                vertices = path.vertices
                if len(vertices) > 2:
                    # Note: In newer versions, we might need to map paths to levels
                    # For simplicity in this context, we take the level from cs.levels if matching
                    level = cs.levels[i] if i < len(cs.levels) else 0.0
                    results.append({
                        'elevation': float(level),
                        'points': vertices.tolist(),
                        'is_major': (level % (5 * interval) == 0)
                    })

        for item in results:
            if tolerance > 0:
                line = LineString(item['points'])
                simplified = line.simplify(tolerance, preserve_topology=True)
                item['points'] = list(simplified.coords)
        
        plt.close(fig)
        return results
