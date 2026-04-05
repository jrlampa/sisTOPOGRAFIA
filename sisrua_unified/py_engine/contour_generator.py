import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def generate_contours(grid_points, interval=1.0):
    """
    Generates contour lines from a grid of (x, y, z) points.

    Args:
        grid_points: List of lists of (x, y, z) tuples.
                     Rows are Y-axis, Cols are X-axis.
        interval: Elevation interval for contours.

    Returns:
        List of [(x, y, z), ...] polylines.
    """
    try:
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

        min_z = float(np.min(Z))
        max_z = float(np.max(Z))

        if max_z - min_z < 0.1:
            return []

        levels = np.arange(np.floor(min_z), np.ceil(max_z) + interval, interval)

        fig = plt.figure()
        ax = fig.add_subplot(111)
        cs = ax.contour(X, Y, Z, levels=levels)

        contour_lines = []

        # matplotlib >= 3.8 removed cs.collections; use cs.allsegs instead
        if hasattr(cs, 'allsegs'):
            for level_val, segs in zip(cs.levels, cs.allsegs):
                for seg in segs:
                    if len(seg) >= 2:
                        pts = [(float(p[0]), float(p[1]), float(level_val)) for p in seg]
                        contour_lines.append(pts)
        else:
            # Fallback for matplotlib < 3.8
            for i, collection in enumerate(cs.collections):  # type: ignore[attr-defined]
                level_val = cs.levels[i]
                for path in collection.get_paths():
                    vertices = path.vertices
                    codes = path.codes
                    if codes is None:
                        if len(vertices) >= 2:
                            pts = [(float(v[0]), float(v[1]), float(level_val)) for v in vertices]
                            contour_lines.append(pts)
                    else:
                        current_line = []
                        for j, code in enumerate(codes):
                            if code == path.MOVETO:
                                if len(current_line) >= 2:
                                    contour_lines.append(current_line)
                                current_line = [(float(vertices[j][0]), float(vertices[j][1]), float(level_val))]
                            elif code in (path.LINETO, path.CLOSEPOLY):
                                current_line.append((float(vertices[j][0]), float(vertices[j][1]), float(level_val)))
                        if len(current_line) >= 2:
                            contour_lines.append(current_line)

        plt.close(fig)
        return contour_lines

    except Exception as e:
        print(f"Error generating contours: {e}")
        return []
