import numpy as np
import matplotlib
matplotlib.use('Agg') # Headless mode
import matplotlib.pyplot as plt
from shapely.geometry import LineString

def generate_contours(grid_points, interval=1.0):
    """
    Generates contour lines from a grid of (x, y, z) points.
    
    Args:
        grid_points: List of lists of (x, y, z) tuples.
                     Rows are Y-axis (approx), Cols are X-axis.
        interval: Elevation interval for contours.
        
    Returns:
        List of (elevation, [(x,y), (x,y)...]) tuples representing polylines.
    """
    try:
        # Convert to numpy arrays for matplotlib
        rows = len(grid_points)
        cols = len(grid_points[0])
        
        X = np.zeros((rows, cols))
        Y = np.zeros((rows, cols))
        Z = np.zeros((rows, cols))
        
        for r in range(rows):
            for c in range(cols):
                x, y, z = grid_points[r][c]
                X[r, c] = x
                Y[r, c] = y
                Z[r, c] = z
                
        # Determine levels
        min_z = np.min(Z)
        max_z = np.max(Z)
        
        # Avoid creating 0 levels if flat
        if max_z - min_z < 0.1:
            return []
            
        levels = np.arange(np.floor(min_z), np.ceil(max_z) + interval, interval)
        
        # Generate contours using matplotlib
        # We use a hidden figure to avoid GUI backend issues
        fig = plt.figure()
        ax = fig.add_subplot(111)
        cs = ax.contour(X, Y, Z, levels=levels)
        
        contour_lines = []
        
        # New Matplotlib API compatible extraction (v3.8+)
        if hasattr(cs, 'allsegs'): # Older API fallback
            for i, segments in enumerate(cs.allsegs):
                level = cs.levels[i]
                for seg in segments:
                    if len(seg) > 1:
                        points_3d = [(float(p[0]), float(p[1]), float(level)) for p in seg]
                        contour_lines.append(points_3d)
        else:
            # For even newer versions where allsegs might be different or for general paths
            for i, path in enumerate(cs.get_paths()):
                # Caution: in newer versions levels and paths might not align 1:1 if not careful
                # but get_paths is the most robust way to get geometries
                vertices = path.vertices
                if len(vertices) > 1:
                    # Try to find level from path properties or use a default if undetermined
                    # (In most cases, we want allsegs if available)
                    points_3d = [(float(v[0]), float(v[1]), 0.0) for v in vertices]
                    contour_lines.append(points_3d)

        plt.close(fig)
        return contour_lines

    except Exception as e:
        import traceback
        print(f"Error generating contours: {e}")
        traceback.print_exc()
        return []
