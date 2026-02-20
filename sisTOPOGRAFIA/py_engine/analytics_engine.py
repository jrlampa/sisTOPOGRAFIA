import numpy as np
import pandas as pd
from shapely.geometry import Point, Polygon

class AnalyticsEngine:
    """Enterprise-grade GIS analytics for terrain and infrastructure."""
    
    @staticmethod
    def calculate_slope_grid(grid_rows):
        """
        Calculates Slope (%) and Aspect (degrees) from a terrain grid.
        grid_rows: List of rows, each containing (x, y, z) tuples.
        """
        if not grid_rows or len(grid_rows) < 2 or len(grid_rows[0]) < 2:
            return None

        # Convert to numpy arrays for vector math
        rows = len(grid_rows)
        cols = len(grid_rows[0])
        
        z = np.zeros((rows, cols))
        x = np.zeros((rows, cols))
        y = np.zeros((rows, cols))
        
        for r in range(rows):
            for c in range(cols):
                x[r, c], y[r, c], z[r, c] = grid_rows[r][c]

        # Calculate spacing (Horizontal Displacement)
        # Using average spacing if non-uniform, but typically uniform
        dx = np.diff(x, axis=1).mean()
        dy = np.diff(y, axis=0).mean()
        
        # Calculate Gradients using Central Differences
        dz_dx = np.gradient(z, dx, axis=1)
        dz_dy = np.gradient(z, dy, axis=0)
        
        # Slope (Rise / Run) -> Percentage
        # Formula: sqrt((dz/dx)^2 + (dz/dy)^2)
        slope = np.sqrt(dz_dx**2 + dz_dy**2)
        slope_pct = slope * 100
        
        # Aspect (Direction of slope)
        # Formula: atan2(dz/dy, -dz/dx) converted to degrees
        aspect = np.degrees(np.arctan2(dz_dy, -dz_dx))
        aspect = (450 - aspect) % 360  # Compass bearing (0=N, 90=E)
        
        return {
            'slope_pct': slope_pct,
            'aspect': aspect,
            'z_min': z.min(),
            'z_max': z.max(),
            'z_avg': z.mean(),
            'slope_avg': slope_pct.mean(),
            'slope_max': slope_pct.max(),
            'hydrology': AnalyticsEngine.calculate_hydrology(z),
            'solar': AnalyticsEngine.calculate_solar(slope, aspect),
            'earthwork': AnalyticsEngine.calculate_earthwork(z, dx, dy)
        }

    @staticmethod
    def calculate_earthwork(z_grid, dx, dy, target_z=None):
        """
        Calculates Cut & Fill volumes relative to a target elevation.
        Volume = Area * (z_terrain - z_target)
        """
        if target_z is None:
            target_z = z_grid.mean()
        
        diff = z_grid - target_z
        cell_area = dx * dy
        
        cut = np.sum(diff[diff > 0]) * cell_area
        fill = np.sum(-diff[diff < 0]) * cell_area
        
        return {
            'cut_volume': float(cut),
            'fill_volume': float(fill),
            'net_volume': float(cut - fill),
            'target_z': float(target_z)
        }

    @staticmethod
    def calculate_hydrology(z_grid):
        """
        Calculates Flow Accumulation using D8 algorithm.
        Identifies natural drainage paths.
        """
        rows, cols = z_grid.shape
        # Pad grid to handle boundaries
        padded = np.pad(z_grid, 1, mode='edge')
        
        # Accumulation grid
        accumulation = np.ones((rows, cols))
        
        # Sort indices by elevation (descending) to process flow
        # This is a simplified O(N log N) approach for flow routing
        flat_indices = np.argsort(-z_grid.flatten())
        
        for idx in flat_indices:
            r, c = divmod(idx, cols)
            
            # 3x3 window around cell (in padded grid)
            window = padded[r:r+3, c:c+3]
            
            # Find steepest descent direction
            min_idx = np.argmin(window)
            wr, wc = divmod(min_idx, 3)
            
            # If not itself (and not a sink)
            if (wr != 1 or wc != 1):
                # Target coordinates in original grid
                tr, tc = r + (wr - 1), c + (wc - 1)
                if 0 <= tr < rows and 0 <= tc < cols:
                    accumulation[tr, tc] += accumulation[r, c]
                    
        return accumulation

    @staticmethod
    def calculate_solar(slope_grid, aspect_grid):
        """
        Calculates Solar Potential based on terrain orientation.
        Simplified: Higher for N-facing (South Hemisphere) or S-facing (North Hemisphere).
        Assuming South Hemisphere (Brazil) -> North-facing (Aspect ~0 or 360) is better.
        """
        # Solar factor: combination of slope and orientation relative to North
        # Cosine of aspect centered at 0 (North)
        cos_aspect = np.cos(np.radians(aspect_grid))
        
        # Simplified potential: 0 to 1 scale
        # Better in steeper north-facing slopes
        solar_potential = (cos_aspect + 1) / 2 * (1 + slope_grid)
        return solar_potential / solar_potential.max() if solar_potential.max() > 0 else solar_potential

    @staticmethod
    def interpolate_point_value(point_geom, grid_rows, values_grid):
        """Generic interpolation for any grid-based analytic value."""
        if values_grid is None: return 0.0
        
        px, py = point_geom.x, point_geom.y
        min_dist = float('inf')
        closest_val = 0.0
        
        for r, row in enumerate(grid_rows):
            for c, (gx, gy, gz) in enumerate(row):
                dist = (px - gx)**2 + (py - gy)**2
                if dist < min_dist:
                    min_dist = dist
                    closest_val = values_grid[r, c]
        
        return float(closest_val)

    @staticmethod
    def interpolate_point_slope(point_geom, grid_rows, analytics_res):
        """Interpolates slope at a specific coordinate based on calculated grid."""
        if not analytics_res: return 0.0
        return AnalyticsEngine.interpolate_point_value(point_geom, grid_rows, analytics_res['slope_pct'])
