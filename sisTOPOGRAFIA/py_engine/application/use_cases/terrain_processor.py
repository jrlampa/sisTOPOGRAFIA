"""
Use Case: TerrainProcessorUseCase
Responsabilidade única: processar grade de elevação, calcular analytics
de geomorfometria (slope/aspect/hydrology) e exportar contornos/perfil.
DDD — Application Layer.
"""
import numpy as np
import geopandas as gpd
from typing import Optional, Dict, List, Tuple
from pyproj import Transformer

try:
    from elevation_client import fetch_elevation_grid
    from contour_generator import generate_contours
    from analytics_engine import AnalyticsEngine
    from utils.logger import Logger
except ImportError:
    from elevation_client import fetch_elevation_grid
    from contour_generator import generate_contours
    from analytics_engine import AnalyticsEngine
    from utils.logger import Logger


class TerrainProcessorUseCase:
    """
    Responsável por: buscar grade de elevação, calcular analytics de terreno
    (slope/aspect/hydrology/earthwork) e gerar contornos + perfil longitudinal.
    """

    def __init__(self, output_file: str, layers_config: Dict):
        self.output_file = output_file
        self.layers_config = layers_config

    # ── Public API ───────────────────────────────────────────────────────────

    def process(self, gdf: gpd.GeoDataFrame, dxf_gen) -> Dict:
        """
        Processa o terreno a partir de um GeoDataFrame.

        Returns:
            dict com chaves: grid_rows, analytics_res
        """
        result = {'grid_rows': [], 'analytics_res': None}

        try:
            gdf_4326 = gdf.to_crs(epsg=4326)
            b = gdf_4326.total_bounds
            north, south, east, west = b[3], b[1], b[2], b[0]
            margin = 0.0005

            elev_points, rows, cols = fetch_elevation_grid(
                north + margin, south - margin, east + margin, west - margin,
                resolution=100
            )

            if not elev_points:
                Logger.info("Nenhum dado de elevação disponível para este trecho.", "warning")
                return result

            Logger.info(f"Grade de elevação {rows}x{cols} reconstruída...", progress=60)

            transformer = Transformer.from_crs("EPSG:4326", gdf.crs, always_xy=True)
            grid_rows = self._build_grid(elev_points, cols, transformer)
            result['grid_rows'] = grid_rows

            # Analytics de geomorfometria
            analytics = AnalyticsEngine.calculate_slope_grid(grid_rows)
            result['analytics_res'] = analytics
            if analytics:
                Logger.info(f"Geomorfometria: Declividade média {analytics['slope_avg']:.1f}%")

            # DXF: grade de terreno + Malha TIN (Enterprise)
            dxf_gen.add_terrain_from_grid(grid_rows, generate_tin=self.layers_config.get('generate_tin', True))

            # Hachuras de risco de talude (Enterprise)
            if self.layers_config.get('slopeAnalysis', True):
                dxf_gen.add_slope_hatch(grid_rows, analytics)

            # Curvas de nível
            if self.layers_config.get('contours', False):
                self._add_contours(grid_rows, dxf_gen)

            # Hidrologia 2.5D
            if self.layers_config.get('hydrology', False):
                dxf_gen.add_hydrology(grid_rows)

            # Perfil longitudinal CSV
            self._export_profile(grid_rows)

        except Exception as e:
            Logger.error(f"Falha no processamento de terreno: {str(e)}")

        return result

    # ── Private Helpers ───────────────────────────────────────────────────────

    def _build_grid(self, elev_points: List, cols: int, transformer) -> List:
        """Converte lista plana de pontos de elevação em grade 2D."""
        grid_rows: List[List[Tuple]] = []
        current_row: List[Tuple] = []
        for lat, lon, z in elev_points:
            x, y = transformer.transform(lon, lat)
            current_row.append((x, y, z))
            if len(current_row) >= cols:
                grid_rows.append(current_row)
                current_row = []
        if current_row:
            grid_rows.append(current_row)
        return grid_rows

    def _add_contours(self, grid_rows: List, dxf_gen) -> None:
        try:
            interval = 0.5 if self.layers_config.get('high_res_contours') else 1.0
            contours = generate_contours(grid_rows, interval=interval)
            if contours:
                dxf_gen.add_contour_lines(contours)
                Logger.info(f"{len(contours)} curvas de nível integradas.")
        except Exception as ce:
            Logger.error(f"Erro no cálculo de contornos: {ce}")

    def _export_profile(self, grid_rows: List) -> None:
        try:
            mid_idx = len(grid_rows) // 2
            mid_row = [p[2] for p in grid_rows[mid_idx]]
            csv_path = self.output_file.replace('.dxf', '_perfil_longitudinal.csv')
            np.savetxt(csv_path, mid_row, delimiter=',', header='elevation_m', comments='')
        except Exception as e:
            Logger.warn(f"Exportação de perfil CSV falhou: {e}")
