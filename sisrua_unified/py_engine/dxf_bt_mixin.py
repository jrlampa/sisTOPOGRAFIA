import math

import numpy as np


class DXFBtMixin:
    """Mixin providing BT (low-voltage) topology drawing methods for DXFGenerator."""

    def _draw_bt_pole(self, pole):
        x = self._safe_v(pole.get("x", 0.0) - self.diff_x)
        y = self._safe_v(pole.get("y", 0.0) - self.diff_y)
        self.msp.add_blockref("BT_POSTE", (x, y))

        pole_label = str(
            pole.get("title", pole.get("id", "POSTE")) or pole.get("id", "POSTE")
        )
        pole_label_point = self._find_clear_label_point(
            (x + 1.6, y + 1.3), min_distance=8.0
        )
        self._add_text(
            pole_label, pole_label_point, layer="BT_LABELS", height=2.1, color=2
        )

        ramal_lines = self._format_ramal_summary(pole.get("ramais", []))
        for index, line in enumerate(ramal_lines):
            ramal_point = self._find_clear_label_point(
                (x + 1.6, y - 1.5 - (index * 2.3)),
                preferred_offsets=[(0.0, 0.0), (0.0, -2.0), (2.0, 0.0), (-2.0, 0.0)],
                min_distance=5.5,
            )
            self._add_text(
                line,
                ramal_point,
                layer="BT_RAMAIS",
                height=1.8,
                color=2,
            )

    def _draw_bt_edge(self, edge):
        start = self._safe_p(
            (edge.get("fromX", 0.0) - self.diff_x, edge.get("fromY", 0.0) - self.diff_y)
        )
        end = self._safe_p(
            (edge.get("toX", 0.0) - self.diff_x, edge.get("toY", 0.0) - self.diff_y)
        )
        points = self._validate_points([start, end], min_points=2)
        if not points:
            return

        self.msp.add_lwpolyline(
            points, close=False, dxfattribs={"layer": "BT_CONDUTORES", "color": 6}
        )

        label = self._format_conductor_label(edge.get("conductors", []))
        edge_change_flag = str(edge.get("edgeChangeFlag", "") or "").lower()
        replacement_from_label = self._format_conductor_label(
            edge.get("replacementFromConductors", [])
        )

        if label or replacement_from_label:
            mid_x = (points[0][0] + points[1][0]) / 2
            mid_y = (points[0][1] + points[1][1]) / 2
            dx = points[1][0] - points[0][0]
            dy = points[1][1] - points[0][1]
            length = math.sqrt((dx**2) + (dy**2)) or 1.0
            normal_x = -dy / length
            normal_y = dx / length
            label_point = self._find_clear_label_point(
                (mid_x + (normal_x * 2.0), mid_y + (normal_y * 2.0)),
                preferred_offsets=[
                    (0.0, 0.0),
                    (0.0, 4.0),
                    (0.0, -4.0),
                    (4.0, 0.0),
                    (-4.0, 0.0),
                ],
                min_distance=9.0,
            )
            rotation = np.degrees(np.arctan2(dy, dx))
            if rotation > 90 or rotation < -90:
                rotation += 180

            if edge_change_flag == "replace":
                incoming_point = (label_point[0], label_point[1] + 4.5)
                outgoing_point = (label_point[0], label_point[1] - 0.8)

                if label:
                    self._draw_boxed_text(
                        label,
                        incoming_point,
                        layer="BT_CONDUTORES",
                        color=6,
                        height=2.0,
                    )

                if replacement_from_label:
                    self._draw_crossed_text(
                        replacement_from_label,
                        outgoing_point,
                        layer="BT_CONDUTORES",
                        color=6,
                        height=2.0,
                    )
            elif label:
                self._add_text(
                    label,
                    label_point,
                    layer="BT_CONDUTORES",
                    height=2.0,
                    color=6,
                    rotation=rotation,
                )

    def _draw_bt_transformer_callout(self, origin, title, kva_label):
        origin_x, origin_y = origin
        elbow = (origin_x + 4.0, origin_y + 7.0)
        header_origin = (elbow[0] + 2.0, elbow[1] + 2.5)
        kva_origin = (header_origin[0] + 8.0, header_origin[1] - 5.5)

        self.msp.add_line(origin, elbow, dxfattribs={"layer": "BT_CALLOUT", "color": 1})
        self.msp.add_line(
            elbow, header_origin, dxfattribs={"layer": "BT_CALLOUT", "color": 1}
        )

        header_width = max(20.0, len(title) * 2.2)
        kva_width = max(14.0, len(kva_label) * 2.2)

        self.msp.add_lwpolyline(
            [
                header_origin,
                (header_origin[0] + header_width, header_origin[1]),
                (header_origin[0] + header_width, header_origin[1] + 4.0),
                (header_origin[0], header_origin[1] + 4.0),
            ],
            close=True,
            dxfattribs={"layer": "BT_CALLOUT", "color": 1},
        )
        self.msp.add_lwpolyline(
            [
                kva_origin,
                (kva_origin[0] + kva_width, kva_origin[1]),
                (kva_origin[0] + kva_width, kva_origin[1] + 4.0),
                (kva_origin[0], kva_origin[1] + 4.0),
            ],
            close=True,
            dxfattribs={"layer": "BT_CALLOUT", "color": 1},
        )

        self._add_text(
            title,
            (header_origin[0] + 1.2, header_origin[1] + 1.0),
            layer="BT_LABELS",
            height=2.8,
            color=2,
        )
        self._add_text(
            kva_label,
            (kva_origin[0] + 1.2, kva_origin[1] + 1.0),
            layer="BT_LABELS",
            height=2.6,
            color=2,
        )

    def _draw_bt_transformer(self, transformer):
        x = self._safe_v(transformer.get("x", 0.0) - self.diff_x)
        y = self._safe_v(transformer.get("y", 0.0) - self.diff_y)
        self.msp.add_blockref("BT_TRAFO_INV", (x, y))

        title = str(
            transformer.get("title", transformer.get("id", "TRAFO"))
            or transformer.get("id", "TRAFO")
        )
        project_power = float(transformer.get("projectPowerKva", 0.0) or 0.0)
        demand_kw = float(transformer.get("demandKw", 0.0) or 0.0)
        kva_value = project_power if project_power > 0 else demand_kw
        kva_label = f"{kva_value:.0f}KVA" if kva_value > 0 else "0KVA"
        self._draw_bt_transformer_callout(
            (x, y + 1.2), title.upper(), kva_label.upper()
        )

    def add_bt_topology(self):
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
