"""
Submódulo: MtTopologia
Responsabilidade Única: Desenho de topologia MT (postes MT e estruturas n1-n4).
Segue exatamente o mesmo padrão de BtTopologiaMixin.
"""


class MtTopologiaMixin:
    """Mixin com toda lógica de desenho da topologia de Média Tensão no DXF."""

    def _draw_mt_pole(self, pole):
        x = self._safe_v(pole.get("x", 0.0) - self.diff_x)
        y = self._safe_v(pole.get("y", 0.0) - self.diff_y)
        self.msp.add_blockref("MT_POSTE", (x, y))

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

    def add_mt_topology(self):
        """Desenha toda a topologia MT (postes MT) no DXF."""
        if not isinstance(self.mt_context, dict) or not self.mt_context:
            return

        topology = self.mt_context.get("topologyProjected")
        if not isinstance(topology, dict):
            return

        for pole in topology.get("poles", []):
            if isinstance(pole, dict):
                self._draw_mt_pole(pole)
