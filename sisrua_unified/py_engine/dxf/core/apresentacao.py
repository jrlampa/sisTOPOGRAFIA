"""
Submódulo: Apresentacao (BIM)
Responsabilidade Única: Elementos de apresentação (legenda, carimbo, quadro BT).
Corresponde à camada "BIM/Apresentação" do roadmap Half-way BIM.
Parte do decomposition do dxf_generator.py (Item 1 do Roadmap T1).
"""
try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from utils.logger import Logger


class ApresentacaoMixin:
    """Mixin com legenda técnica, quadro BT e carimbo A3 (Half-way BIM)."""

    def add_legend(self):
        """Adiciona legenda profissional ao Model Space."""
        min_x, min_y, max_x, max_y = self.bounds
        start_x = self._safe_v(max_x - self.diff_x + 20)
        start_y = self._safe_v(max_y - self.diff_y)

        self.msp.add_text(
            "LEGENDA TÉCNICA",
            dxfattribs={"height": 4, "style": "PRO_STYLE", "layer": "QUADRO"},
        ).set_placement((start_x, start_y))

        items = [
            ("EDIFICAÇÕES", "EDIFICACAO", 5),
            ("VIAS / RUAS", "VIAS", 1),
            ("MEIO-FIO", "VIAS_MEIO_FIO", 1),
            ("VEGETAÇÃO", "VEGETACAO", 3),
            ("ILUMINAÇÃO PÚBLICA", "MOBILIARIO_URBANO", 2),
            ("REDE ELÉTRICA (AT)", "INFRA_POWER_HV", 1),
            ("REDE ELÉTRICA (BT)", "INFRA_POWER_LV", 30),
            ("TELECOMUNICAÇÕES", "INFRA_TELECOM", 90),
            ("CURVAS DE NÍVEL", "TOPOGRAFIA_CURVAS", 8),
        ]

        y_offset = -10
        for label, layer, color in items:
            self.msp.add_line(
                (start_x, start_y + y_offset),
                (start_x + 10, start_y + y_offset),
                dxfattribs={"layer": layer, "color": color},
            )
            self.msp.add_text(
                label, dxfattribs={"height": 2.5, "layer": "QUADRO"}
            ).set_placement((start_x + 12, start_y + y_offset - 1))
            y_offset -= 8

    def add_bt_summary(self):
        """Adiciona painel de sumário BT ao Model Space quando contexto BT está disponível."""
        if not isinstance(self.bt_context, dict) or not self.bt_context:
            return

        min_x, min_y, max_x, max_y = self.bounds
        start_x = self._safe_v(max_x - self.diff_x + 20)
        start_y = self._safe_v(max_y - self.diff_y - 90)

        project_type = str(self.bt_context.get("projectType", "ramais")).upper()
        scenario = str(self.bt_context.get("btNetworkScenario", "asis")).upper()
        clandestino_area = self.bt_context.get("clandestinoAreaM2", 0)
        critical_pole = (
            self.bt_context.get("criticalPole")
            if isinstance(self.bt_context.get("criticalPole"), dict)
            else {}
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

        demand_extra_height = (
            (6 + 6 + 5 + len(demand_entries) * 5) if demand_entries else 0
        )
        panel_width = 100
        panel_height = 8 + (len(lines) * 6) + demand_extra_height
        top_y = start_y
        bottom_y = start_y - panel_height

        self.msp.add_lwpolyline(
            [
                (start_x, top_y),
                (start_x + panel_width, top_y),
                (start_x + panel_width, bottom_y),
                (start_x, bottom_y),
            ],
            close=True,
            dxfattribs={"layer": "QUADRO", "color": 7},
        )
        self.msp.add_line(
            (start_x, top_y - 8),
            (start_x + panel_width, top_y - 8),
            dxfattribs={"layer": "QUADRO", "color": 7},
        )

        for index, line in enumerate(lines):
            text_height = 3 if index == 0 else 2.2
            text_y = top_y - 5 - (index * 6)
            self.msp.add_text(
                line,
                dxfattribs={"height": text_height, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 3, text_y))

        if demand_entries:
            body_bottom_y = top_y - 5 - ((len(lines) - 1) * 6)
            separator_y = body_bottom_y - 6
            self.msp.add_line(
                (start_x, separator_y),
                (start_x + panel_width, separator_y),
                dxfattribs={"layer": "QUADRO", "color": 7},
            )

            section_header_y = separator_y - 4
            self.msp.add_text(
                "LISTA COMPLETA POSTE | CLT | kVA",
                dxfattribs={"height": 2.5, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 3, section_header_y))

            col_header_y = section_header_y - 6
            for col_text, col_x in [("POSTE", 3), ("CLT", 48), ("DEM(kVA)", 68)]:
                self.msp.add_text(
                    col_text,
                    dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
                ).set_placement((start_x + col_x, col_header_y))

            for rank_idx, entry in enumerate(demand_entries):
                entry_y = col_header_y - 5 - (rank_idx * 5)
                pole_label = f'#{rank_idx + 1} {str(entry.get("poleId", "?"))}'
                self.msp.add_text(
                    pole_label,
                    dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
                ).set_placement((start_x + 3, entry_y))
                self.msp.add_text(
                    str(int(entry.get("accumulatedClients", 0))),
                    dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
                ).set_placement((start_x + 48, entry_y))
                self.msp.add_text(
                    f'{float(entry.get("accumulatedDemandKva", 0.0)):.2f}',
                    dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
                ).set_placement((start_x + 68, entry_y))

    def add_title_block(self, client="N/A", project="Projeto Urbanístico", designer="sisRUA AI"):
        """Cria Carimbo A3 profissional no Paper Space (Half-way BIM)."""
        import datetime
        layout = self.doc.layout("Layout1")

        width, height = 420, 297

        layout.add_lwpolyline(
            [(0, 0), (width, 0), (width, height), (0, height)],
            close=True,
            dxfattribs={"layer": "QUADRO", "lineweight": 50},
        )

        cx = (self.bounds[0] + self.bounds[2]) / 2
        cy = (self.bounds[1] + self.bounds[3]) / 2
        view_x = cx - self.diff_x
        view_y = cy - self.diff_y

        vp = layout.add_viewport(
            center=(width / 2, height / 2 + 20),
            size=(width - 40, height - 80),
            view_center_point=(view_x, view_y),
            view_height=200,
        )
        vp.dxf.status = 1

        cb_x, cb_y = width - 185, 0
        cb_w, cb_h = 185, 50

        layout.add_lwpolyline(
            [
                (cb_x, cb_y),
                (cb_x + cb_w, cb_y),
                (cb_x + cb_w, cb_y + cb_h),
                (cb_x, cb_y + cb_h),
            ],
            close=True,
            dxfattribs={"layer": "QUADRO"},
        )

        layout.add_line(
            (cb_x, cb_y + 25), (cb_x + cb_w, cb_y + 25), dxfattribs={"layer": "QUADRO"}
        )
        layout.add_line(
            (cb_x + 100, cb_y), (cb_x + 100, cb_y + 25), dxfattribs={"layer": "QUADRO"}
        )

        date_str = datetime.date.today().strftime("%d/%m/%Y")
        p_name = str(project).upper()
        c_name = str(client)
        d_name = str(designer)

        def add_layout_text(text, pos, height, style="PRO_STYLE"):
            t = layout.add_text(text, dxfattribs={"height": height, "style": style})
            t.dxf.halign = 0
            t.dxf.valign = 0
            t.dxf.insert = pos
            t.dxf.align_point = pos
            return t

        add_layout_text(f"PROJETO: {p_name[:50]}", (cb_x + 5, cb_y + 35), 4)
        add_layout_text(f"CLIENTE: {c_name[:50]}", (cb_x + 5, cb_y + 15), 3)
        add_layout_text(f"DATA: {date_str}", (cb_x + 105, cb_y + 15), 2.5)
        add_layout_text(f"ENGINE: sisRUA Unified v1.5", (cb_x + 105, cb_y + 5), 2)
        add_layout_text(f"RESPONSÁVEL: {d_name[:50]}", (cb_x + 5, cb_y + 5), 2.5)

        try:
            layout.add_blockref("LOGO", (cb_x + cb_w - 20, cb_y + cb_h - 10))
        except Exception as e:
            Logger.error(f"Erro adicionando bloco de logo: {e}")

    def _count_modelspace_entities(self):
        return sum(1 for _ in self.msp)

    def _run_finalize_step(self, label, fn):
        try:
            fn()
        except Exception as e:
            Logger.error(f"Etapa de finalização DXF falhou ({label}): {e}")
