import numpy as np
from typing import List, Tuple, Dict, Any

class AnalyticsService:
    """Pure domain service for topographical and engineering geoprocessing."""

    @staticmethod
    def calculate_slope_grid(z_grid: np.ndarray, dx: float, dy: float) -> Dict[str, Any]:
        """Calculates Slope (%) and Aspect (degrees) from a elevation grid."""
        # Calculate Gradients using Central Differences
        dz_dx = np.gradient(z_grid, dx, axis=1)
        dz_dy = np.gradient(z_grid, dy, axis=0)
        
        # Slope (Rise / Run) -> Percentage
        slope = np.sqrt(dz_dx**2 + dz_dy**2)
        slope_pct = slope * 100
        
        # Aspect (Direction of slope)
        aspect = np.degrees(np.arctan2(dz_dy, -dz_dx))
        aspect = (450 - aspect) % 360  # Compass bearing (0=N, 90=E)
        
        return {
            'slope_pct': slope_pct,
            'aspect': aspect,
            'z_min': float(z_grid.min()),
            'z_max': float(z_grid.max()),
            'z_avg': float(z_grid.mean()),
            'slope_avg': float(slope_pct.mean()),
            'slope_max': float(slope_pct.max()),
            'hydrology': AnalyticsService.calculate_hydrology(z_grid),
            'solar': AnalyticsService.calculate_solar(slope, aspect),
            'earthwork': AnalyticsService.calculate_earthwork(z_grid, dx, dy)
        }

    @staticmethod
    def calculate_hydrology(z_grid: np.ndarray) -> np.ndarray:
        """Calculates Flow Accumulation using D8 algorithm."""
        rows, cols = z_grid.shape
        padded = np.pad(z_grid, 1, mode='edge')
        accumulation = np.ones((rows, cols))
        flat_indices = np.argsort(-z_grid.flatten())
        
        for idx in flat_indices:
            r, c = divmod(idx, cols)
            window = padded[r:r+3, c:c+3]
            min_idx = np.argmin(window)
            wr, wc = divmod(min_idx, 3)
            if (wr != 1 or wc != 1):
                tr, tc = r + (wr - 1), c + (wc - 1)
                if 0 <= tr < rows and 0 <= tc < cols:
                    accumulation[tr, tc] += accumulation[r, c]
        return accumulation

    @staticmethod
    def calculate_solar(slope_grid: np.ndarray, aspect_grid: np.ndarray) -> np.ndarray:
        """Calculates Solar Potential based on terrain orientation."""
        cos_aspect = np.cos(np.radians(aspect_grid))
        solar_potential = (cos_aspect + 1) / 2 * (1 + slope_grid)
        max_val = solar_potential.max()
        return solar_potential / max_val if max_val > 0 else solar_potential

    @staticmethod
    def calculate_earthwork(z_grid: np.ndarray, dx: float, dy: float, target_z: float = None) -> Dict[str, float]:
        """Calculates Cut & Fill volumes relative to a target elevation."""
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
