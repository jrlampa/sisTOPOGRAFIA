import hashlib
import json
import math
import os
import datetime

import numpy as np
from ezdxf.enums import TextEntityAlignment

try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger


class DXFLayoutMixin:
    """Mixin providing layout, cartographic, and save methods for DXFGenerator."""

    def add_terrain_from_grid(self, grid_rows):
        """
        grid_rows: List of rows, where each row is a list of (x, y, z) tuples.
        """
        if not grid_rows or not grid_rows[0]:
            return

        rows = len(grid_rows)
        cols = len(grid_rows[0])

        if rows < 2 or cols < 2:
            return

        mesh = self.msp.add_polymesh(size=(rows, cols), dxfattribs={"layer": "TERRENO"})

        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                try:
                    x = self._safe_v(float(p[0]) - self.diff_x)
                    y = self._safe_v(float(p[1]) - self.diff_y)
                    z = self._safe_v(float(p[2]))
                    mesh.set_mesh_vertex((r, c), (x, y, z))
                except (ValueError, TypeError, IndexError) as e:
                    Logger.error(f"Error setting mesh vertex at ({r}, {c}): {e}")
                    mesh.set_mesh_vertex((r, c), (0.0, 0.0, 0.0))

    def add_contour_lines(self, contour_lines, use_spline=True):
        """
        Draws contour lines as smooth SPLINE entities when possible.
        Falls back to 3D polylines for compatibility.
        contour_lines: List of points [(x, y, z), ...] or list of lists of points.
        """
        for line_points in contour_lines:
            if len(line_points) < 2:
                continue

            valid_line = self._validate_points(line_points, min_points=2, is_3d=True)
            if not valid_line:
                continue

            if use_spline and len(valid_line) >= 3:
                try:
                    self.msp.add_spline(
                        fit_points=valid_line,
                        dxfattribs={"layer": "TOPOGRAFIA_CURVAS", "color": 8},
                    )
                    continue
                except Exception as e:
                    Logger.info(f"Spline contour fallback to polyline: {e}")

            self.msp.add_polyline3d(
                valid_line, dxfattribs={"layer": "TOPOGRAFIA_CURVAS", "color": 8}
            )

    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Adds North Arrow and Scale Bar to the drawing"""
        try:
            margin = 10.0
            na_x = self._safe_v(max_x - diff_x - margin)
            na_y = self._safe_v(max_y - diff_y - margin)
            self.msp.add_blockref("NORTE", (na_x, na_y))

            sb_x = self._safe_v(max_x - diff_x - 30.0)
            sb_y = self._safe_v(min_y - diff_y + margin)
            self.msp.add_blockref("ESCALA", (sb_x, sb_y))
        except Exception as e:
            Logger.info(f"Cartographic elements failed: {e}")

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Draws a boundary frame with coordinate labels"""
        min_x, max_x = self._safe_v(min_x), self._safe_v(max_x)
        min_y, max_y = self._safe_v(min_y), self._safe_v(max_y)
        diff_x, diff_y = self._safe_v(diff_x), self._safe_v(diff_y)

        frame_pts = [
            (min_x - diff_x - 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, max_y - diff_y + 5),
            (min_x - diff_x - 5, max_y - diff_y + 5),
        ]
        self.msp.add_lwpolyline(
            frame_pts, close=True, dxfattribs={"layer": "QUADRO", "color": 7}
        )

        step = 50.0
        x_range = np.arange(np.floor(min_x / step) * step, max_x + 1, step)
        for x in x_range[:50]:
            dx = self._safe_v(x - diff_x)
            if min_x - 5 <= x <= max_x + 5:
                try:
                    self.msp.add_text(
                        f"E: {x:.0f}", dxfattribs={"height": 2, "layer": "QUADRO"}
                    ).set_placement(
                        (dx, min_y - diff_y - 8), align=TextEntityAlignment.CENTER
                    )
                except Exception as e:
                    Logger.error(f"Error adding x-axis label at {x}: {e}")
        y_range = np.arange(np.floor(min_y / step) * step, max_y + 1, step)
        for y in y_range[:50]:
            dy = self._safe_v(y - diff_y)
            if min_y - 5 <= y <= max_y + 5:
                try:
                    self.msp.add_text(
                        f"N: {y:.0f}",
                        dxfattribs={"height": 2, "layer": "QUADRO", "rotation": 90.0},
                    ).set_placement(
                        (min_x - diff_x - 8, dy), align=TextEntityAlignment.CENTER
                    )
                except Exception as e:
                    Logger.error(f"Error adding y-axis label at {y}: {e}")

    def add_legend(self):
        """Adds a professional legend to the Model Space"""
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
        """Adds a BT summary panel to the Model Space when BT context is available."""
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
        demand_entries = []
        if isinstance(raw_ranking, list):
            for entry in raw_ranking:
                if isinstance(entry, dict):
                    demand_entries.append(entry)

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
                dxfattribs={
                    "height": text_height,
                    "layer": "QUADRO",
                    "style": "PRO_STYLE",
                },
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
            self.msp.add_text(
                "POSTE",
                dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 3, col_header_y))
            self.msp.add_text(
                "CLT",
                dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 48, col_header_y))
            self.msp.add_text(
                "DEM(kVA)",
                dxfattribs={"height": 2.0, "layer": "QUADRO", "style": "PRO_STYLE"},
            ).set_placement((start_x + 68, col_header_y))

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

    def add_title_block(
        self, client="N/A", project="Projeto Urbanístico", designer="sisRUA AI"
    ):
        """Creates a professional A3 Title Block in Paper Space"""
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

        v_height = (
            max(
                abs(self.bounds[2] - self.bounds[0]),
                abs(self.bounds[3] - self.bounds[1]),
            )
            * 1.2
        )
        if v_height < 50:
            v_height = 200

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
            Logger.error(f"Error adding logo block reference: {e}")

    def _generate_provenance(self, filename: str, entity_count: int) -> dict:
        """Computes SHA-256 of the saved DXF file and writes a provenance JSON sidecar."""
        sha256_hash = hashlib.sha256()
        with open(filename, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256_hash.update(chunk)
        record = {
            "sha256": sha256_hash.hexdigest(),
            "generated_at": datetime.datetime.utcnow().isoformat(),
            "generator": "sisTOPOGRAFIA/sisrua_unified",
            "version": "1.0.0",
            "entity_count": entity_count,
        }
        provenance_path = filename + ".provenance.json"
        with open(provenance_path, "w", encoding="utf-8") as pf:
            json.dump(record, pf, indent=2)
        Logger.info(
            f"Provenance written: {os.path.basename(provenance_path)} "
            f"(sha256={record['sha256'][:16]}...)"
        )
        return record

    def _count_modelspace_entities(self):
        return sum(1 for _ in self.msp)

    def _run_finalize_step(self, label, fn):
        try:
            fn()
        except Exception as e:
            Logger.error(f"DXF finalize step failed ({label}): {e}")

    def save(self):
        initial_entities = self._count_modelspace_entities()
        if initial_entities <= 0:
            raise RuntimeError("DXF export aborted: model space has no entities")

        try:
            self._run_finalize_step("legend", self.add_legend)
            self._run_finalize_step("bt_summary", self.add_bt_summary)
            self._run_finalize_step(
                "title_block",
                lambda: self.add_title_block(
                    client=self.project_info.get("client", "CLIENTE PADRÃO"),
                    project=self.project_info.get("project", "EXTRACAO ESPACIAL OSM"),
                ),
            )

            self.doc.saveas(self.filename)
            final_entities = self._count_modelspace_entities()
            output_size = os.path.getsize(self.filename)

            if final_entities <= 0:
                raise RuntimeError("DXF saved without model-space entities")
            if output_size <= 0:
                raise RuntimeError("DXF saved with zero-byte size")

            Logger.info(
                f"DXF saved successfully: {os.path.basename(self.filename)} "
                f"({final_entities} entities, {output_size} bytes)"
            )
            self._generate_provenance(self.filename, final_entities)
        except Exception as e:
            Logger.error(f"DXF Save Error: {e}")
            raise
