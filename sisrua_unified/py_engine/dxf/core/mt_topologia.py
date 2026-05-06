"""
Submódulo: MtTopologia
Responsabilidade Única: Desenho de topologia MT (postes MT, estruturas n1-n4 e vãos/condutores).
Segue exatamente o mesmo padrão de BtTopologiaMixin.
"""

# Flag colours per change flag — mirroring BT convention
_EDGE_FLAG_COLORS = {
    "new": 3,       # green
    "remove": 1,    # red
    "replace": 2,   # yellow
    "existing": 30, # orange (MT default)
}


class MtTopologiaMixin:
    """Mixin com toda lógica de desenho da topologia de Média Tensão no DXF."""

    def _draw_mt_pole(self, pole):
        x = self._safe_v(pole.get("x", 0.0) - self.diff_x)
        y = self._safe_v(pole.get("y", 0.0) - self.diff_y)
        
        # BIM Attributes extraction
        mt_structures = pole.get("mtStructures") or {}
        bim_attribs = {
            "BIM_ID": str(pole.get("id", "-")),
            "BIM_ESTRUTURA_MT": ", ".join(filter(None, [
                mt_structures.get("n1"), mt_structures.get("n2"),
                mt_structures.get("n3"), mt_structures.get("n4")
            ])) or "-"
        }
        
        self.msp.add_blockref("MT_POSTE", (x, y)).add_auto_attribs(bim_attribs)

        pole_label = str(
            pole.get("title", pole.get("id", "POSTE-MT")) or pole.get("id", "POSTE-MT")
        )
        pole_label_point = self._find_clear_label_point(
            (x + 1.8, y + 1.3), min_distance=8.0
        )
        self._add_text(
            pole_label, pole_label_point, layer="MT_LABELS", height=2.1, color=30
        )

        mt_structures = pole.get("mtStructures")
        if not isinstance(mt_structures, dict):
            return

        struct_parts = []
        for key in ("n1", "n2", "n3", "n4"):
            val = str(mt_structures.get(key) or "").strip()
            if val:
                struct_parts.append(f"{key.upper()}: {val}")

        if not struct_parts:
            return

        struct_label = " | ".join(struct_parts)
        struct_point = self._find_clear_label_point(
            (x + 1.8, y + 3.8),
            preferred_offsets=[(0.0, 0.0), (0.0, 2.0), (2.0, 0.0), (-2.0, 0.0)],
            min_distance=6.0,
        )
        self._add_text(
            struct_label, struct_point, layer="MT_LABELS", height=1.8, color=30
        )

    def _draw_mt_edge(self, edge):
        """Desenha um vão MT como polilinha na camada MT_CONDUTORES."""
        from_xy = edge.get("fromXY")
        to_xy = edge.get("toXY")
        if not (isinstance(from_xy, (list, tuple)) and isinstance(to_xy, (list, tuple))):
            return
        if len(from_xy) < 2 or len(to_xy) < 2:
            return

        flag = str(edge.get("edgeChangeFlag") or "existing")
        color = _EDGE_FLAG_COLORS.get(flag, 30)

        x1 = self._safe_v(from_xy[0] - self.diff_x)
        y1 = self._safe_v(from_xy[1] - self.diff_y)
        x2 = self._safe_v(to_xy[0] - self.diff_x)
        y2 = self._safe_v(to_xy[1] - self.diff_y)

        self.msp.add_lwpolyline(
            [(x1, y1), (x2, y2)],
            dxfattribs={"layer": "MT_CONDUTORES", "color": color},
        )

        length_m = edge.get("lengthMeters")
        if length_m is not None:
            try:
                length_m = float(length_m)
                mid_x = (x1 + x2) / 2.0
                mid_y = (y1 + y2) / 2.0
                length_label = f"{length_m:.1f}m"
                label_point = self._find_clear_label_point(
                    (mid_x, mid_y + 1.2), min_distance=4.0
                )
                self._add_text(
                    length_label, label_point, layer="MT_LABELS", height=1.5, color=30
                )
            except (TypeError, ValueError):
                pass

    def add_mt_topology(self):
        """Desenha toda a topologia MT (postes e vãos) no DXF."""
        if not isinstance(self.mt_context, dict) or not self.mt_context:
            return

        topology = self.mt_context.get("topologyProjected")
        if not isinstance(topology, dict):
            return

        for edge in topology.get("edges", []):
            if isinstance(edge, dict):
                self._draw_mt_edge(edge)

        for pole in topology.get("poles", []):
            if isinstance(pole, dict):
                self._draw_mt_pole(pole)
