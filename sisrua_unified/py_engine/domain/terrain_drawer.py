"""
terrain_drawer.py - Responsável pelo desenho do terreno e curvas de nível no DXF.

Responsabilidades:
- Malha 3D de terreno (polymesh 2.5D)
- Curvas de nível como splines ou polylines 3D
"""
try:
    from ..utils.logger import Logger
    from .drawing_context import DrawingContext
except (ImportError, ValueError):
    from utils.logger import Logger
    from domain.drawing_context import DrawingContext


class TerrainDrawer:
    """Desenhista especializado em terreno e topografia."""

    def __init__(self, ctx: DrawingContext):
        self.ctx = ctx

    def add_terrain_from_grid(self, grid_rows: list) -> None:
        """
        Cria malha polimesh 2.5D a partir de grid de pontos (x, y, z).

        grid_rows: lista de linhas, onde cada linha é lista de tuplas (x, y, z).
        """
        if not grid_rows or not grid_rows[0]:
            return

        rows = len(grid_rows)
        cols = len(grid_rows[0])
        if rows < 2 or cols < 2:
            return

        mesh = self.ctx.msp.add_polymesh(size=(rows, cols), dxfattribs={"layer": "TERRENO"})

        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                try:
                    x = self.ctx.safe_v(float(p[0]) - self.ctx.diff_x)
                    y = self.ctx.safe_v(float(p[1]) - self.ctx.diff_y)
                    z = self.ctx.safe_v(float(p[2]))
                    mesh.set_mesh_vertex((r, c), (x, y, z))
                except (ValueError, TypeError, IndexError) as e:
                    Logger.error(f"Erro no vértice ({r}, {c}): {e}")
                    mesh.set_mesh_vertex((r, c), (0.0, 0.0, 0.0))

    def add_contour_lines(self, contour_lines: list, use_spline: bool = True) -> None:
        """
        Desenha curvas de nível como SPLINE (suavizadas) ou polyline 3D.

        contour_lines: lista de listas de pontos [(x, y, z), ...].
        """
        for line_points in contour_lines:
            if len(line_points) < 2:
                continue

            valid_line = self.ctx.validate_points(line_points, min_points=2, is_3d=True)
            if not valid_line:
                continue

            if use_spline and len(valid_line) >= 3:
                try:
                    self.ctx.msp.add_spline(
                        fit_points=valid_line,
                        dxfattribs={"layer": "TOPOGRAFIA_CURVAS", "color": 8},
                    )
                    continue
                except Exception as e:
                    Logger.info(f"Fallback spline → polyline3d: {e}")

            self.ctx.msp.add_polyline3d(
                valid_line, dxfattribs={"layer": "TOPOGRAFIA_CURVAS", "color": 8}
            )
