"""
legend_builder.py — DXF Legend, Title Block & Coordinate Grid
Responsabilidade única: adicionar elementos cartográficos ao documento DXF
(legenda técnica, carimbo A3, grade UTM e flecha de norte).
DDD — Infrastructure/Adapter Layer.
"""
import math
import datetime
import numpy as np

try:
    from utils.logger import Logger
except ImportError:
    from utils.logger import Logger

# Itens fixos da legenda técnica sisTOPOGRAFIA (ABNT)
_LEGEND_ITEMS = [
    ("EDIFICAÇÕES",         "TOPO_EDIFICACAO",          5),
    ("VIAS / RUAS",         "TOPO_VIAS",                1),
    ("MEIO-FIO",            "TOPO_VIAS_MEIO_FIO",       9),
    ("VEGETAÇÃO",           "TOPO_VEGETACAO",           3),
    ("ILUMINAÇÃO PÚBLICA",  "TOPO_MOBILIARIO_URBANO",   2),
    ("REDE ELÉTRICA (AT)",  "TOPO_INFRA_POWER_HV",      1),
    ("REDE ELÉTRICA (BT)",  "TOPO_INFRA_POWER_LV",     30),
    ("TELECOMUNICAÇÕES",    "TOPO_INFRA_TELECOM",      90),
    ("CURVAS DE NÍVEL",     "TOPO_TOPOGRAFIA_CURVAS",   8),
]


class LegendBuilder:
    """
    Constrói elementos cartográficos no espaço de modelo/papel do DXF.
    Recebe `msp` (model space), `doc` e estado do DXFGenerator como contexto.
    """

    def __init__(self, msp, doc, bounds: list, diff_x: float, diff_y: float,
                 safe_v_fn, project_info: dict):
        self.msp = msp
        self.doc = doc
        self.bounds = bounds
        self.diff_x = diff_x
        self.diff_y = diff_y
        self._safe_v = safe_v_fn
        self.project_info = project_info

    # ── Public API ────────────────────────────────────────────────────────────

    def add_cartographic_elements(self, min_x: float, min_y: float,
                                   max_x: float, max_y: float,
                                   diff_x: float, diff_y: float) -> None:
        """Adiciona flecha de norte e barra de escala ao espaço de modelo."""
        try:
            margin = 10.0
            na_x = self._safe_v(max_x - diff_x - margin)
            na_y = self._safe_v(max_y - diff_y - margin)
            self.msp.add_blockref('NORTE', (na_x, na_y))

            sb_x = self._safe_v(max_x - diff_x - 30.0)
            sb_y = self._safe_v(min_y - diff_y + margin)
            self.msp.add_blockref('ESCALA', (sb_x, sb_y))
        except Exception as e:
            Logger.info(f"Elementos cartográficos falharam: {e}")

    def add_coordinate_grid(self, min_x: float, min_y: float,
                             max_x: float, max_y: float,
                             diff_x: float, diff_y: float,
                             spacing: float = 50.0) -> None:
        """Desenha grade UTM com cruzes e rótulos de coordenadas."""
        min_x, max_x = self._safe_v(min_x), self._safe_v(max_x)
        min_y, max_y = self._safe_v(min_y), self._safe_v(max_y)
        diff_x, diff_y = self._safe_v(diff_x), self._safe_v(diff_y)

        # Moldura externa
        frame_pts = [
            (min_x - diff_x - 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, max_y - diff_y + 5),
            (min_x - diff_x - 5, max_y - diff_y + 5),
        ]
        self.msp.add_lwpolyline(frame_pts, close=True,
                                dxfattribs={'layer': 'TOPO_QUADRO', 'color': 7})

        grid_min_x = math.floor(min_x / spacing) * spacing
        grid_max_x = math.ceil(max_x / spacing) * spacing
        grid_min_y = math.floor(min_y / spacing) * spacing
        grid_max_y = math.ceil(max_y / spacing) * spacing

        n_x = (grid_max_x - grid_min_x) / spacing
        n_y = (grid_max_y - grid_min_y) / spacing
        if n_x > 100 or n_y > 100:
            Logger.info("Área da grade muito grande, crosshairs ignorados.")
            return

        cross_size = spacing * 0.05
        for x in np.arange(grid_min_x, grid_max_x + spacing, spacing):
            for y in np.arange(grid_min_y, grid_max_y + spacing, spacing):
                if not (min_x - 10 <= x <= max_x + 10 and min_y - 10 <= y <= max_y + 10):
                    continue
                lx = self._safe_v(x - diff_x)
                ly = self._safe_v(y - diff_y)
                self.msp.add_line((lx - cross_size, ly), (lx + cross_size, ly),
                                  dxfattribs={'layer': 'QUADRO_MALHA', 'color': 8})
                self.msp.add_line((lx, ly - cross_size), (lx, ly + cross_size),
                                  dxfattribs={'layer': 'QUADRO_MALHA', 'color': 8})
                self.msp.add_text(
                    f"{x:.0f}, {y:.0f}",
                    dxfattribs={'layer': 'QUADRO_TEXTO', 'height': spacing * 0.04,
                                'color': 8, 'style': 'STANDARD'}
                ).set_placement((lx + cross_size, ly + cross_size))

    def add_legend(self) -> None:
        """Adiciona legenda técnica profissional ao espaço de modelo."""
        min_x, min_y, max_x, max_y = self.bounds
        start_x = self._safe_v(max_x - self.diff_x + 20)
        start_y = self._safe_v(max_y - self.diff_y)

        self.msp.add_text(
            "LEGENDA TÉCNICA",
            dxfattribs={'height': 4, 'style': 'PRO_STYLE', 'layer': 'TOPO_QUADRO'}
        ).set_placement((start_x, start_y))

        y_offset = -10
        for label, layer, color in _LEGEND_ITEMS:
            self.msp.add_line(
                (start_x, start_y + y_offset),
                (start_x + 10, start_y + y_offset),
                dxfattribs={'layer': layer, 'color': color}
            )
            self.msp.add_text(
                label,
                dxfattribs={'height': 2.5, 'layer': 'TOPO_QUADRO'}
            ).set_placement((start_x + 12, start_y + y_offset - 1))
            y_offset -= 8

    def add_title_block(self, client: str = "N/A",
                         project: str = "sisTOPOGRAFIA - Engenharia",
                         designer: str = "sisTOPOGRAFIA AI") -> None:
        """Cria carimbo profissional A3 no espaço de papel."""
        layout = self.doc.layout('Layout1')
        width, height = 420, 297

        # Moldura A3
        layout.add_lwpolyline(
            [(0, 0), (width, 0), (width, height), (0, height)], close=True,
            dxfattribs={'layer': 'TOPO_QUADRO', 'lineweight': 50}
        )

        # Viewport centrado no desenho
        cx = (self.bounds[0] + self.bounds[2]) / 2
        cy = (self.bounds[1] + self.bounds[3]) / 2
        view_x = cx - self.diff_x
        view_y = cy - self.diff_y
        v_height = max(abs(self.bounds[2] - self.bounds[0]),
                       abs(self.bounds[3] - self.bounds[1])) * 1.2
        if v_height < 50:
            v_height = 200

        vp = layout.add_viewport(
            center=(width / 2, height / 2 + 20),
            size=(width - 40, height - 80),
            view_center_point=(view_x, view_y),
            view_height=200
        )
        vp.dxf.status = 1

        # Carimbo bottom-right
        cb_x, cb_y = width - 185, 0
        cb_w, cb_h = 185, 50

        layout.add_lwpolyline(
            [(cb_x, cb_y), (cb_x + cb_w, cb_y),
             (cb_x + cb_w, cb_y + cb_h), (cb_x, cb_y + cb_h)],
            close=True, dxfattribs={'layer': 'TOPO_QUADRO'}
        )
        layout.add_line((cb_x, cb_y + 25), (cb_x + cb_w, cb_y + 25),
                        dxfattribs={'layer': 'TOPO_QUADRO'})
        layout.add_line((cb_x + 100, cb_y), (cb_x + 100, cb_y + 25),
                        dxfattribs={'layer': 'TOPO_QUADRO'})

        date_str = datetime.date.today().strftime("%d/%m/%Y")

        def _add_text(text, pos, h, style='PRO_STYLE'):
            t = layout.add_text(text, dxfattribs={'height': h, 'style': style})
            t.dxf.halign = 0
            t.dxf.valign = 0
            t.dxf.insert = pos
            t.dxf.align_point = pos
            return t

        _add_text(f"PROJETO: {str(project).upper()[:50]}", (cb_x + 5, cb_y + 35), 4)
        _add_text(f"CLIENTE: {str(client)[:50]}",          (cb_x + 5, cb_y + 15), 3)
        _add_text(f"DATA: {date_str}",                     (cb_x + 105, cb_y + 15), 2.5)
        _add_text("ENGINE: sisTOPOGRAFIA v1.5",            (cb_x + 105, cb_y + 5), 2)
        _add_text(f"RESPONSÁVEL: {str(designer)[:50]}",    (cb_x + 5, cb_y + 5), 2.5)

        try:
            layout.add_blockref('LOGO', (cb_x + cb_w - 20, cb_y + cb_h - 10))
        except Exception as e:
            Logger.error(f"Erro ao adicionar bloco LOGO: {e}")
