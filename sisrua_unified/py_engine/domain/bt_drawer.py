"""
bt_drawer.py - Responsável pelo desenho da topologia BT (Baixa Tensão) no DXF.

Responsabilidades:
- Desenho de postes, arestas (condutores) e transformadores BT
- Callout de transformador
- Quadro resumo BT
- Formatação de labels de condutores e ramais
"""
import math

import numpy as np

try:
    from ..utils.logger import Logger
    from .drawing_context import DrawingContext
except (ImportError, ValueError):
    from utils.logger import Logger
    from domain.drawing_context import DrawingContext


class BTDrawer:
    """Desenhista especializado na topologia de Baixa Tensão."""

    def __init__(self, ctx: DrawingContext, bt_context: dict):
        self.ctx = ctx
        self.bt_context = bt_context

    # -------------------------------------------------------------------------
    # Ponto de entrada público
    # -------------------------------------------------------------------------

    def add_bt_topology(self) -> None:
        """Desenha postes, condutores e transformadores da topologia BT."""
        if not isinstance(self.bt_context, dict) or not self.bt_context:
            return

        topology = self.bt_context.get("topologyProjected")
        if not isinstance(topology, dict):
            return

        for edge in topology.get("edges", []):
            if isinstance(edge, dict):
                self._draw_bt_edge(edge)

        for pole in topology.get("poles", []):
            if isinstance(pole, dict):
                self._draw_bt_pole(pole)

        for transformer in topology.get("transformers", []):
            if isinstance(transformer, dict):
                self._draw_bt_transformer(transformer)

    # -------------------------------------------------------------------------
    # Postes BT
    # -------------------------------------------------------------------------

    def _draw_bt_pole(self, pole: dict) -> None:
        x = self.ctx.safe_v(pole.get("x", 0.0) - self.ctx.diff_x)
        y = self.ctx.safe_v(pole.get("y", 0.0) - self.ctx.diff_y)
        self.ctx.msp.add_blockref("BT_POSTE", (x, y))

        pole_label = str(pole.get("title", pole.get("id", "POSTE")) or pole.get("id", "POSTE"))
        pole_label_point = self.ctx.find_clear_label_point((x + 1.6, y + 1.3), min_distance=8.0)
        self.ctx.add_text(pole_label, pole_label_point, layer="BT_LABELS", height=2.1, color=2)

        ramal_lines = self._format_ramal_summary(pole.get("ramais", []))
        for index, line in enumerate(ramal_lines):
            ramal_point = self.ctx.find_clear_label_point(
                (x + 1.6, y - 1.5 - (index * 2.3)),
                preferred_offsets=[(0.0, 0.0), (0.0, -2.0), (2.0, 0.0), (-2.0, 0.0)],
                min_distance=5.5,
            )
            self.ctx.add_text(line, ramal_point, layer="BT_RAMAIS", height=1.8, color=2)

    # -------------------------------------------------------------------------
    # Arestas / Condutores BT
    # -------------------------------------------------------------------------

    def _draw_bt_edge(self, edge: dict) -> None:
        start = self.ctx.safe_p(
            (edge.get("fromX", 0.0) - self.ctx.diff_x, edge.get("fromY", 0.0) - self.ctx.diff_y)
        )
        end = self.ctx.safe_p(
            (edge.get("toX", 0.0) - self.ctx.diff_x, edge.get("toY", 0.0) - self.ctx.diff_y)
        )
        points = self.ctx.validate_points([start, end], min_points=2)
        if not points:
            return

        self.ctx.msp.add_lwpolyline(
            points, close=False, dxfattribs={"layer": "BT_CONDUTORES", "color": 6}
        )

        label = self._format_conductor_label(edge.get("conductors", []))
        edge_change_flag = str(edge.get("edgeChangeFlag", "") or "").lower()
        replacement_from_label = self._format_conductor_label(edge.get("replacementFromConductors", []))

        if label or replacement_from_label:
            mid_x = (points[0][0] + points[1][0]) / 2
            mid_y = (points[0][1] + points[1][1]) / 2
            dx = points[1][0] - points[0][0]
            dy = points[1][1] - points[0][1]
            length = math.sqrt((dx**2) + (dy**2)) or 1.0
            normal_x = -dy / length
            normal_y = dx / length
            label_point = self.ctx.find_clear_label_point(
                (mid_x + (normal_x * 2.0), mid_y + (normal_y * 2.0)),
                preferred_offsets=[(0.0, 0.0), (0.0, 4.0), (0.0, -4.0), (4.0, 0.0), (-4.0, 0.0)],
                min_distance=9.0,
            )
            rotation = np.degrees(np.arctan2(dy, dx))
            if rotation > 90 or rotation < -90:
                rotation += 180

            if edge_change_flag == "replace":
                incoming_point = (label_point[0], label_point[1] + 4.5)
                outgoing_point = (label_point[0], label_point[1] - 0.8)
                if label:
                    self._draw_boxed_text(label, incoming_point, layer="BT_CONDUTORES", color=6, height=2.0)
                if replacement_from_label:
                    self._draw_crossed_text(replacement_from_label, outgoing_point, layer="BT_CONDUTORES",
                                            color=6, height=2.0)
            elif label:
                self.ctx.add_text(label, label_point, layer="BT_CONDUTORES", height=2.0, color=6, rotation=rotation)

    # -------------------------------------------------------------------------
    # Transformadores BT
    # -------------------------------------------------------------------------

    def _draw_bt_transformer(self, transformer: dict) -> None:
        x = self.ctx.safe_v(transformer.get("x", 0.0) - self.ctx.diff_x)
        y = self.ctx.safe_v(transformer.get("y", 0.0) - self.ctx.diff_y)
        self.ctx.msp.add_blockref("BT_TRAFO_INV", (x, y))

        title = str(
            transformer.get("title", transformer.get("id", "TRAFO")) or transformer.get("id", "TRAFO")
        )
        project_power = float(transformer.get("projectPowerKva", 0.0) or 0.0)
        demand_kw = float(transformer.get("demandKw", 0.0) or 0.0)
        kva_value = project_power if project_power > 0 else demand_kw
        kva_label = f"{kva_value:.0f}KVA" if kva_value > 0 else "0KVA"
        self._draw_bt_transformer_callout((x, y + 1.2), title.upper(), kva_label.upper())

    def _draw_bt_transformer_callout(self, origin, title: str, kva_label: str) -> None:
        origin_x, origin_y = origin
        elbow = (origin_x + 4.0, origin_y + 7.0)
        header_origin = (elbow[0] + 2.0, elbow[1] + 2.5)
        kva_origin = (header_origin[0] + 8.0, header_origin[1] - 5.5)

        self.ctx.msp.add_line(origin, elbow, dxfattribs={"layer": "BT_CALLOUT", "color": 1})
        self.ctx.msp.add_line(elbow, header_origin, dxfattribs={"layer": "BT_CALLOUT", "color": 1})

        header_width = max(20.0, len(title) * 2.2)
        kva_width = max(14.0, len(kva_label) * 2.2)

        self.ctx.msp.add_lwpolyline(
            [header_origin, (header_origin[0] + header_width, header_origin[1]),
             (header_origin[0] + header_width, header_origin[1] + 4.0),
             (header_origin[0], header_origin[1] + 4.0)],
            close=True, dxfattribs={"layer": "BT_CALLOUT", "color": 1},
        )
        self.ctx.msp.add_lwpolyline(
            [kva_origin, (kva_origin[0] + kva_width, kva_origin[1]),
             (kva_origin[0] + kva_width, kva_origin[1] + 4.0),
             (kva_origin[0], kva_origin[1] + 4.0)],
            close=True, dxfattribs={"layer": "BT_CALLOUT", "color": 1},
        )
        self.ctx.add_text(title, (header_origin[0] + 1.2, header_origin[1] + 1.0),
                          layer="BT_LABELS", height=2.8, color=2)
        self.ctx.add_text(kva_label, (kva_origin[0] + 1.2, kva_origin[1] + 1.0),
                          layer="BT_LABELS", height=2.6, color=2)

    # -------------------------------------------------------------------------
    # Quadro BT
    # -------------------------------------------------------------------------

    def add_bt_summary(self) -> None:
        """Adiciona painelKinformation BT ao modelspace."""
        if not isinstance(self.bt_context, dict) or not self.bt_context:
            return

        min_x, min_y, max_x, max_y = self.ctx.bounds
        start_x = self.ctx.safe_v(max_x - self.ctx.diff_x + 20)
        start_y = self.ctx.safe_v(max_y - self.ctx.diff_y - 90)

        project_type = str(self.bt_context.get("projectType", "ramais")).upper()
        scenario = str(self.bt_context.get("btNetworkScenario", "asis")).upper()
        clandestino_area = self.bt_context.get("clandestinoAreaM2", 0)
        critical_pole = (
            self.bt_context.get("criticalPole")
            if isinstance(self.bt_context.get("criticalPole"), dict) else {}
        )

        critical_pole_id = str(critical_pole.get("poleId", "N/A"))
        accumulated_clients = critical_pole.get("accumulatedClients", 0)
        accumulated_demand = critical_pole.get("accumulatedDemandKva", 0.0)

        total_poles = int(self.bt_context.get("totalPoles", 0) or 0)
        total_edges = int(self.bt_context.get("totalEdges", 0) or 0)
        total_transformers = int(self.bt_context.get("totalTransformers", 0) or 0)
        verified_poles = int(self.bt_context.get("verifiedPoles", 0) or 0)
        verified_edges = int(self.bt_context.get("verifiedEdges", 0) or 0)
        verified_transformers = int(self.bt_context.get("verifiedTransformers", 0) or 0)

        raw_ranking = self.bt_context.get("accumulatedByPole", [])
        demand_entries = [e for e in raw_ranking if isinstance(e, dict)] if isinstance(raw_ranking, list) else []

        lines = [
            "QUADRO BT",
            f"CENARIO: {scenario}",
            f"TIPO: {project_type}",
            f"PONTO CRITICO: {critical_pole_id}",
            f"CLT ACUM.: {accumulated_clients}",
            f"DEM. ACUM.: {float(accumulated_demand):.2f} kVA",
            f"POSTES: {verified_poles}/{total_poles}",
            f"ARESTAS: {verified_edges}/{total_edges}",
            f"TRAFOS: {verified_transformers}/{total_transformers}",
        ]
        if project_type == "CLANDESTINO":
            lines.insert(3, f"AREA CLANDESTINA: {clandestino_area} m2")

        demand_extra_height = (6 + 6 + 5 + len(demand_entries) * 5) if demand_entries else 0
        panel_width = 100
        panel_height = 8 + (len(lines) * 6) + demand_extra_height
        top_y = start_y
        bottom_y = start_y - panel_height

        self.ctx.msp.add_lwpolyline(
            [(start_x, top_y), (start_x + panel_width, top_y),
             (start_x + panel_width, bottom_y), (start_x, bottom_y)],
            close=True, dxfattribs={"layer": "QUADRO", "color": 7},
        )
        self.ctx.msp.add_line(
            (start_x, top_y - 8), (start_x + panel_width, top_y - 8),
            dxfattribs={"layer": "QUADRO", "color": 7},
        )

        for index, line in enumerate(lines):
            text_height = 3 if index == 0 else 2.2
            text_y = top_y - 5 - (index * 6)
            self.ctx.msp.add_text(
                line,
                dxfattribs={"height": text_height, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 3, text_y))

        if demand_entries:
            self._draw_demand_table(start_x, panel_width, top_y, lines, demand_entries)

    def _draw_demand_table(self, start_x, panel_width, top_y, lines, demand_entries) -> None:
        body_bottom_y = top_y - 5 - ((len(lines) - 1) * 6)
        separator_y = body_bottom_y - 6
        self.ctx.msp.add_line(
            (start_x, separator_y), (start_x + panel_width, separator_y),
            dxfattribs={"layer": "QUADRO", "color": 7},
        )

        section_header_y = separator_y - 4
        self.ctx.msp.add_text(
            "LISTA COMPLETA POSTE | CLT | kVA",
            dxfattribs={"height": 2.5, "layer": "QUADRO", "style": "PRO_STYLE"},
        ).set_placement((start_x + 3, section_header_y))

        col_header_y = section_header_y - 6
        for label, offset in [("POSTE", 3), ("CLT", 48), ("DEM(kVA)", 68)]:
            self.ctx.msp.add_text(
                label, dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + offset, col_header_y))

        for rank_idx, entry in enumerate(demand_entries):
            entry_y = col_header_y - 5 - (rank_idx * 5)
            pole_label = f'#{rank_idx + 1} {str(entry.get("poleId", "?"))}'
            self.ctx.msp.add_text(
                pole_label,
                dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 3, entry_y))
            self.ctx.msp.add_text(
                str(int(entry.get("accumulatedClients", 0))),
                dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 48, entry_y))
            self.ctx.msp.add_text(
                f'{float(entry.get("accumulatedDemandKva", 0.0)):.2f}',
                dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 68, entry_y))

    # -------------------------------------------------------------------------
    # Helpers de formatação de labels
    # -------------------------------------------------------------------------

    @staticmethod
    def _format_conductor_label(conductors) -> str:
        if not isinstance(conductors, list) or not conductors:
            return ""
        labels = []
        for entry in conductors:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("conductorName", "") or "").strip()
            quantity = int(entry.get("quantity", 0) or 0)
            if not name:
                continue
            labels.append(f"{quantity}-{name}" if quantity > 1 else name)
        return " + ".join(labels)

    @staticmethod
    def _format_ramal_summary(ramais) -> list:
        if not isinstance(ramais, list) or not ramais:
            return []
        grouped: dict = {}
        total = 0
        for entry in ramais:
            if not isinstance(entry, dict):
                continue
            quantity = int(entry.get("quantity", 0) or 0)
            ramal_type = str(entry.get("ramalType", "") or "").strip() or "SEM TIPO"
            if quantity <= 0:
                continue
            total += quantity
            grouped[ramal_type] = grouped.get(ramal_type, 0) + quantity

        if total == 0:
            return []
        lines = [f"TOTAL: {total}"]
        for ramal_type, quantity in sorted(grouped.items()):
            lines.append(f"{quantity}-{ramal_type}")
        return lines

    # -------------------------------------------------------------------------
    # Primitivos de texto especial
    # -------------------------------------------------------------------------

    def _draw_boxed_text(self, text, point, layer, color=6, height=2.0, padding_x=1.2, padding_y=0.8) -> None:
        self.ctx.add_text(text, point, layer=layer, height=height, color=color)
        text_width = max(8.0, len(str(text)) * (height * 0.75))
        rect_left = point[0] - padding_x
        rect_bottom = point[1] - padding_y
        rect_right = rect_left + text_width + (padding_x * 2)
        rect_top = rect_bottom + height + (padding_y * 2)
        self.ctx.msp.add_lwpolyline(
            [(rect_left, rect_bottom), (rect_right, rect_bottom),
             (rect_right, rect_top), (rect_left, rect_top)],
            close=True, dxfattribs={"layer": layer, "color": color},
        )

    def _draw_crossed_text(self, text, point, layer, color=6, height=2.0) -> None:
        self.ctx.add_text(text, point, layer=layer, height=height, color=color)
        text_width = max(8.0, len(str(text)) * (height * 0.75))
        left = point[0] - 0.6
        right = left + text_width + 1.2
        base = point[1] + (height * 0.2)
        top = base + (height * 1.4)
        self.ctx.msp.add_line((left, base), (right, top), dxfattribs={"layer": layer, "color": color})
        self.ctx.msp.add_line((left, top), (right, base), dxfattribs={"layer": layer, "color": color})
