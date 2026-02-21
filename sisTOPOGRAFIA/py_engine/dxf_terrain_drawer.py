"""
dxf_terrain_drawer.py — Responsabilidade única: desenhar dados de terreno no DXF.
Extrai toda a lógica de renderização de terreno, TIN, curvas e hidrologia (SRP).
"""
import os
import math
import numpy as np
from scipy.spatial import Delaunay

try:  # pragma: no cover
    from .utils.logger import Logger
except (ImportError, ValueError):  # pragma: no cover
    from utils.logger import Logger


class DXFTerrainDrawer:
    """
    Responsabilidade única: renderizar dados de terreno e análise no ModelSpace.
    Recebe dependências via construtor (injeção de dependência).
    """

    def __init__(self, msp, doc, safe_v_fn, validate_points_fn, diff_x_getter, diff_y_getter):
        self.msp = msp
        self.doc = doc
        self._safe_v = safe_v_fn
        self._validate_points = validate_points_fn
        self._get_diff_x = diff_x_getter
        self._get_diff_y = diff_y_getter

    @property
    def diff_x(self) -> float:
        return self._get_diff_x()

    @property
    def diff_y(self) -> float:
        return self._get_diff_y()

    def add_terrain_from_grid(self, grid_rows, generate_tin: bool = True) -> None:
        """Adiciona pontos de terreno e malha TIN ao DXF."""
        if not grid_rows or not grid_rows[0]:
            return
        if len(grid_rows) < 2 or len(grid_rows[0]) < 2:
            return

        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                try:
                    x = self._safe_v(float(p[0]) - self.diff_x)
                    y = self._safe_v(float(p[1]) - self.diff_y)
                    z = self._safe_v(float(p[2]))
                    self.msp.add_point(
                        (x, y, z),
                        dxfattribs={'layer': 'sisTOPO_TERRENO_PONTOS', 'color': 1},
                    )
                except (ValueError, TypeError, IndexError) as e:
                    Logger.error(f"Error setting terrain point ({r},{c}): {e}")

        if generate_tin:
            self.add_tin_mesh(grid_rows)

    def add_tin_mesh(self, grid_rows) -> None:
        """Gera Malha TIN (Delaunay) para superfície 2.5D."""
        try:
            points_3d = [
                (
                    self._safe_v(p[0] - self.diff_x),
                    self._safe_v(p[1] - self.diff_y),
                    self._safe_v(p[2]),
                )
                for row in grid_rows
                for p in row
            ]
            pts_2d = np.array([(p[0], p[1]) for p in points_3d])
            tri = Delaunay(pts_2d)

            layer = 'sisTOPO_TERRENO_TIN'
            if layer not in self.doc.layers:
                self.doc.layers.add(name=layer, color=8)

            for simplex in tri.simplices:
                p1, p2, p3 = (points_3d[i] for i in simplex)
                self.msp.add_3dface([p1, p2, p3, p3], dxfattribs={'layer': layer})

            Logger.info(f"Malha TIN gerada com {len(tri.simplices)} triângulos.")
        except Exception as e:
            Logger.error(f"Falha ao gerar malha TIN: {e}")

    def add_slope_hatch(self, grid_rows, analytics) -> None:
        """Adiciona hachuras de risco de declividade ao DXF."""
        if not analytics or 'slope_pct' not in analytics:
            return
        slope_grid = analytics['slope_pct']
        rows, cols = len(grid_rows), len(grid_rows[0])
        try:
            for r in range(rows - 1):
                for c in range(cols - 1):
                    s = slope_grid[r, c]
                    if s < 30.0:
                        continue
                    if s > 100.0:
                        layer, color = 'sisTOPO_RISCO_ALTO', 1
                    else:
                        layer, color = 'sisTOPO_RISCO_MEDIO', 30
                    if layer not in self.doc.layers:
                        self.doc.layers.add(name=layer, color=color)
                    pts = [
                        (self._safe_v(grid_rows[r][c][0] - self.diff_x), self._safe_v(grid_rows[r][c][1] - self.diff_y)),
                        (self._safe_v(grid_rows[r][c+1][0] - self.diff_x), self._safe_v(grid_rows[r][c+1][1] - self.diff_y)),
                        (self._safe_v(grid_rows[r+1][c+1][0] - self.diff_x), self._safe_v(grid_rows[r+1][c+1][1] - self.diff_y)),
                        (self._safe_v(grid_rows[r+1][c][0] - self.diff_x), self._safe_v(grid_rows[r+1][c][1] - self.diff_y)),
                    ]
                    hatch = self.msp.add_hatch(color=color, dxfattribs={'layer': layer})
                    hatch.set_solid_fill()
                    hatch.paths.add_polyline_path(pts, is_closed=True)
            Logger.info("Hachuras de risco de talude integradas ao DXF.")
        except Exception as e:
            Logger.error(f"Erro ao gerar hachuras de risco: {e}")

    def add_contour_lines(self, contour_lines, interval: float = 1.0) -> None:
        """Desenha curvas de nível (2.5D: lwpolyline com elevation)."""
        for line_points in contour_lines:
            if len(line_points) < 2:
                continue
            z_val = self._safe_v(line_points[0][2]) if len(line_points[0]) > 2 else 0.0
            pts_2d = [(self._safe_v(p[0]), self._safe_v(p[1])) for p in line_points]
            is_major = abs(z_val % (5 * interval)) < 0.01
            layer = 'sisTOPO_CURVAS_NIVEL_MESTRA' if is_major else 'sisTOPO_TOPOGRAFIA_CURVAS'
            color = 7 if is_major else 8
            valid_line = self._validate_points(pts_2d, min_points=2)
            if not valid_line:
                continue
            self.msp.add_lwpolyline(
                valid_line, dxfattribs={'layer': layer, 'color': color, 'elevation': z_val}
            )
            if is_major and len(valid_line) > 10:
                self._label_major_contour(valid_line, z_val)

    def _label_major_contour(self, valid_line, z_val: float) -> None:
        """Adiciona rótulo de cota nas curvas mestras."""
        mid_idx = len(valid_line) // 2
        p1, p2 = valid_line[mid_idx], valid_line[mid_idx + 1]
        angle = math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))
        if angle > 90:
            angle -= 180
        if angle < -90:
            angle += 180
        self.msp.add_text(
            f"{z_val:.0f}",
            dxfattribs={
                'layer': 'sisTOPO_TOPOGRAFIA_CURVAS_TEXTO',
                'height': 1.8,
                'rotation': angle,
                'color': 7,
                'style': 'STANDARD',
            },
        ).set_placement(p1)

    def add_hydrology(self, grid_rows) -> None:
        """Traça linhas de drenagem (talvegues) por curvatura da superfície."""
        if not grid_rows or len(grid_rows) < 3:
            return
        try:
            rows, cols = len(grid_rows), len(grid_rows[0])
            Z = np.array([[grid_rows[r][c][2] for c in range(cols)] for r in range(rows)], dtype=float)
            gy, gx = np.gradient(Z)
            _, gyy = np.gradient(gy)
            gxx, _ = np.gradient(gx)
            laplacian = gxx + gyy
            mask = laplacian > 0.05
            layer_name = 'sisTOPO_HIDROGRAFIA'
            segments = 0
            for r in range(1, rows - 1):
                for c in range(1, cols - 1):
                    if not mask[r, c]:
                        continue
                    p1 = grid_rows[r][c]
                    vx, vy = -gx[r, c], -gy[r, c]
                    mag = math.sqrt(vx ** 2 + vy ** 2)
                    if mag == 0:
                        continue
                    tr = r + int(round(vy / mag))
                    tc = c + int(round(vx / mag))
                    if not (0 <= tr < rows and 0 <= tc < cols):
                        continue
                    p2 = grid_rows[tr][tc]
                    self.msp.add_line(
                        (self._safe_v(p1[0] - self.diff_x), self._safe_v(p1[1] - self.diff_y)),
                        (self._safe_v(p2[0] - self.diff_x), self._safe_v(p2[1] - self.diff_y)),
                        dxfattribs={'layer': layer_name, 'color': 4},
                    )
                    segments += 1
            Logger.info(f"Segmentos hidrológicos desenhados: {segments}.")
        except Exception as e:
            Logger.error(f"Hidrologia DXF falhou: {e}")

    def add_raster_overlay(self, img_path: str, bounds: tuple) -> None:
        """Insere imagem raster georreferenciada (ortofoto satélite) no DXF."""
        try:
            from PIL import Image as PILImage
            abs_path = os.path.abspath(img_path)
            min_x, min_y, max_x, max_y = bounds
            x = self._safe_v(min_x - self.diff_x)
            y = self._safe_v(min_y - self.diff_y)
            width = self._safe_v(max_x - min_x)
            height = self._safe_v(max_y - min_y)
            layer_name = 'sisTOPO_MDT_IMAGEM_SATELITE'
            if layer_name not in self.doc.layers:
                self.doc.layers.add(name=layer_name, color=252)
            with PILImage.open(abs_path) as img:
                px_w, px_h = img.size
            image_def = self.doc.add_image_def(filename=abs_path, size_in_pixel=(px_w, px_h))
            self.msp.add_image(
                image_def=image_def,
                insert=(x, y),
                size_in_units=(width, height),
                dxfattribs={
                    'layer': layer_name,
                    'u_pixel': (width / px_w, 0, 0),
                    'v_pixel': (0, height / px_h, 0),
                },
            )
            Logger.info(f"Raster satélite inserido: {os.path.basename(img_path)}")
        except Exception as e:
            Logger.error(f"Falha ao inserir raster: {e}")
