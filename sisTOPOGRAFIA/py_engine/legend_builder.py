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
except ImportError:  # pragma: no cover
    from utils.logger import Logger

# Itens fixos da legenda técnica sisTOPOGRAFIA (ABNT)
_LEGEND_ITEMS = [
    ("EDIFICAÇÕES",         "sisTOPO_EDIFICACAO",          5),
    ("VIAS / RUAS",         "sisTOPO_VIAS",                1),
    ("MEIO-FIO",            "sisTOPO_VIAS_MEIO_FIO",       9),
    ("VEGETAÇÃO",           "sisTOPO_VEGETACAO",           3),
    ("ILUMINAÇÃO PÚBLICA",  "sisTOPO_MOBILIARIO_URBANO",   2),
    ("REDE ELÉTRICA (AT)",  "sisTOPO_INFRA_POWER_HV",      1),
    ("REDE ELÉTRICA (BT)",  "sisTOPO_INFRA_POWER_LV",     30),
    ("TELECOMUNICAÇÕES",    "sisTOPO_INFRA_TELECOM",      90),
    ("CURVAS DE NÍVEL",     "sisTOPO_TOPOGRAFIA_CURVAS",   8),
]

# Dimensões ABNT (Largura, Altura) em mm
_PAPER_SIZES = {
    'A0': (1189, 841),
    'A1': (841, 594),
    'A2': (594, 420),
    'A3': (420, 297),
    'A4': (210, 297),
}


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
                                dxfattribs={'layer': 'sisTOPO_QUADRO', 'color': 7})

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
            dxfattribs={'height': 4, 'style': 'PRO_STYLE', 'layer': 'sisTOPO_QUADRO'}
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
                dxfattribs={'height': 2.5, 'layer': 'sisTOPO_QUADRO'}
            ).set_placement((start_x + 12, start_y + y_offset - 1))
            y_offset -= 8
            
        # Adicionar tabela de geodésia se houver dados
        self.add_geodetic_control_table()

    def add_title_block(self, client: str = "N/A",
                         project: str = "sisTOPOGRAFIA - Engenharia",
                         designer: str = "Jonatas Lampa (RT)",
                         paper_size: str = 'A3') -> None:
        """Cria carimbo profissional e bordas normatizadas (NBR 10068)."""
        layout = self.doc.layout('Layout1')
        width, height = _PAPER_SIZES.get(paper_size.upper(), _PAPER_SIZES['A3'])
        
        # Margens NBR 10068: Esquerda sempre 25mm. Outras: 10mm (A0/A1) ou 7mm (A2/A3/A4)
        m_left = 25
        m_others = 10 if paper_size.upper() in ['A0', 'A1'] else 7
        
        # Moldura interna (Borda de desenho)
        layout.add_lwpolyline(
            [(m_left, m_others), (width - m_others, m_others), 
             (width - m_others, height - m_others), (m_left, height - m_others)], 
            close=True,
            dxfattribs={'layer': 'sisTOPO_QUADRO', 'lineweight': 50}
        )
        
        # Moldura externa (Corte da folha)
        layout.add_lwpolyline(
            [(0, 0), (width, 0), (width, height), (0, height)], close=True,
            dxfattribs={'layer': 'sisTOPO_QUADRO', 'lineweight': 13}
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
            center=( (width + m_left - m_others)/2, (height)/2 + 20),
            size=(width - m_left - m_others - 10, height - m_others*2 - 80),
            view_center_point=(view_x, view_y),
            view_height=v_height
        )
        vp.dxf.status = 1

        # Carimbo bottom-right (dentro da moldura interna)
        cb_w, cb_h = 175, 45 # Padrão para pranchas técnicas
        cb_x = width - m_others - cb_w
        cb_y = m_others

        layout.add_lwpolyline(
            [(cb_x, cb_y), (cb_x + cb_w, cb_y),
             (cb_x + cb_w, cb_y + cb_h), (cb_x, cb_y + cb_h)],
            close=True, dxfattribs={'layer': 'sisTOPO_QUADRO', 'lineweight': 35}
        )
        # Divisões internas do carimbo
        layout.add_line((cb_x, cb_y + 20), (cb_x + cb_w, cb_y + 20),
                        dxfattribs={'layer': 'sisTOPO_QUADRO'})
        layout.add_line((cb_x + 90, cb_y), (cb_x + 90, cb_y + 20),
                        dxfattribs={'layer': 'sisTOPO_QUADRO'})

        date_str = datetime.date.today().strftime("%d/%m/%Y")

        def _add_text(text, pos, h, style='PRO_STYLE'):
            t = layout.add_text(text, dxfattribs={'height': h, 'style': style})
            t.dxf.halign = 0
            t.dxf.valign = 0
            t.dxf.insert = pos
            t.dxf.align_point = pos
            return t

        s_proj = str(project).upper()
        s_client = str(client)
        s_designer = str(designer).upper()
        
        _add_text(f"PROJETO: {s_proj[:50]}", (cb_x + 5, cb_y + 32), 3.5)
        _add_text(f"CLIENTE: {s_client[:50]}",         (cb_x + 5, cb_y + 22), 2.5)
        _add_text(f"RESPONSÁVEL TÉCNICO: {s_designer}", (cb_x + 5, cb_y + 12), 2.5)
        _add_text(f"DATA: {date_str}",                     (cb_x + 95, cb_y + 12), 2.0)
        _add_text(f"ESCALA: {self.project_info.get('scale', '1:1000')}", (cb_x + 95, cb_y + 5), 2.0)
        _add_text("SISTEMA: SIRGAS 2000 / UTM",            (cb_x + 5, cb_y + 5), 2.0)

        try:
            layout.add_blockref('LOGO', (cb_x + cb_w - 20, cb_y + cb_h - 10))
        except Exception as e:  # pragma: no cover  # add_blockref never throws for missing blocks
            Logger.error(f"Erro ao adicionar bloco LOGO: {e}")

    def add_geodetic_control_table(self) -> None:
        """Adiciona tabela formal de marcos geodésicos encontrados no Layout."""
        marcos = self.project_info.get('geodetic_markers', [])
        if not marcos:
            return

        layout = self.doc.layout('Layout1')
        # Posicionar em local padrão (acima do carimbo mas seguro contra Y=0)
        start_x, start_y = 25 + 5, 50 # Próximo à margem esquerda, altura segura
        
        def _text(txt, x, y, h=2.5, bold=False):
            layout.add_text(txt, dxfattribs={
                'height': h, 'style': 'PRO_STYLE',
                'color': 7
            }).set_placement((x, y))

        _text("TABELA DE CONTROLE GEODÉSICO (IBGE/BDG)", start_x, start_y + 10, 3.0)
        _text("ID MARCO | LATITUDE      | LONGITUDE     | ALTITUDE (m)", start_x, start_y + 5, 2.0)
        _text("-" * 60, start_x, start_y + 3, 2.0)

        for i, m in enumerate(marcos[:10]): # Limite de 10 na tabela do layout
            y = start_y - (i * 4)
            row = f"{m['id']:<9} | {m['lat']:<13.7f} | {m['lon']:<13.7f} | {m['altitude']:.3f}"
            _text(row, start_x, y, 2.0)
