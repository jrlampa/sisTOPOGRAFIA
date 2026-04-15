"""
Submódulo: Geometria
Responsabilidade Única: Desenho de features OSM, camadas, polígonos, linhas e pontos.
Herda utilitários de GeometriaUtilsMixin.
Parte do decomposition do dxf_generator.py (Item 1 do Roadmap T1).
"""
import math
import numpy as np
import pandas as pd
from shapely.geometry import (
    Polygon, MultiPolygon, LineString, MultiLineString, Point, GeometryCollection
)

try:
    from ...dxf_styles import DXFStyleManager
    from ...utils.logger import Logger
except (ImportError, ValueError):
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from dxf_styles import DXFStyleManager
    from utils.logger import Logger


class GeometriaMixin:
    """Mixin com desenho de features OSM, camadas DXF, terreno e elementos cartográficos."""

    def add_features(self, gdf):
        """
        Itera sobre um GeoDataFrame e adiciona entidades ao DXF.
        Assume que o GDF está projetado (unidades em metros).
        """
        if gdf.empty:
            return

        if not self._offset_initialized:
            centroids = gdf.geometry.centroid
            cx = centroids.x.dropna().mean() if not centroids.x.dropna().empty else 0.0
            cy = centroids.y.dropna().mean() if not centroids.y.dropna().empty else 0.0
            self.diff_x = self._safe_v(cx)
            self.diff_y = self._safe_v(cy)
            self._offset_initialized = True

        b = gdf.total_bounds
        if any(math.isnan(v) or math.isinf(v) for v in b):
            self.bounds = [0.0, 0.0, 100.0, 100.0]
        else:
            self.bounds = [float(v) for v in b]

        for _, row in gdf.iterrows():
            geom = row.geometry
            tags = row.drop("geometry")
            layer = self.determine_layer(tags, row)
            self._draw_geometry(geom, layer, self.diff_x, self.diff_y, tags)

    def determine_layer(self, tags, row):
        """Mapeia tags OSM para Camadas DXF."""
        if "power" in tags and not pd.isna(tags["power"]):
            if tags["power"] in ["line", "tower", "substation"]:
                return "INFRA_POWER_HV"
            return "INFRA_POWER_LV"

        if "telecom" in tags and not pd.isna(tags["telecom"]):
            return "INFRA_TELECOM"

        furniture_amenities = [
            "bench", "waste_basket", "bicycle_parking", "fountain", "drinking_water",
        ]
        if ("amenity" in tags and tags["amenity"] in furniture_amenities) or (
            "highway" in tags and tags["highway"] == "street_lamp"
        ):
            return "MOBILIARIO_URBANO"

        if "building" in tags and not pd.isna(tags["building"]):
            return "EDIFICACAO"
        if "highway" in tags and not pd.isna(tags["highway"]):
            return "VIAS"
        if "natural" in tags and tags["natural"] in ["tree", "wood", "scrub"]:
            return "VEGETACAO"
        if "amenity" in tags:
            return "EQUIPAMENTOS"
        if "leisure" in tags:
            return "VEGETACAO"
        if "waterway" in tags or "natural" in tags and tags["natural"] == "water":
            return "HIDROGRAFIA"

        return "0"

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags):
        """Desenho recursivo de geometrias com suporte a texto."""
        if geom is None or geom.is_empty:
            return

        if isinstance(geom, GeometryCollection) and not isinstance(
            geom, (Polygon, MultiPolygon, LineString, MultiLineString, Point)
        ):
            for sub in geom.geoms:
                self._draw_geometry(sub, layer, diff_x, diff_y, tags)
            return

        if layer not in self.doc.layers:
            layer = "0"

        if layer == "VIAS" and "name" in tags:
            name = str(tags["name"])
            if name.lower() != "nan" and name.strip():
                rotation = 0.0
                centroid = geom.centroid
                if (
                    not centroid.is_empty
                    and not math.isnan(centroid.x)
                    and not math.isnan(centroid.y)
                ):
                    if isinstance(geom, LineString) and geom.length > 0.1:
                        try:
                            p1 = geom.interpolate(0.45, normalized=True)
                            p2 = geom.interpolate(0.55, normalized=True)
                            if p1 and p2:
                                dx = p2.x - p1.x
                                dy = p2.y - p1.y
                                if abs(dx) > 1e-5 or abs(dy) > 1e-5:
                                    angle = np.degrees(np.arctan2(dy, dx))
                                    rotation = (angle if -90 <= angle <= 90 else angle + 180)
                        except Exception:
                            pass

                    try:
                        safe_val = self._safe_v(rotation)
                        safe_align = (
                            self._safe_v(centroid.x - diff_x),
                            self._safe_v(centroid.y - diff_y),
                        )
                        if not self._should_draw_street_label(name, safe_align, float(geom.length)):
                            return

                        label_point = self._find_clear_label_point(
                            safe_align,
                            preferred_offsets=[
                                (0.0, 0.0), (0.0, 5.0), (0.0, -5.0), (5.0, 0.0), (-5.0, 0.0),
                            ],
                            min_distance=18.0,
                        )
                        text = self.msp.add_text(
                            name,
                            dxfattribs={
                                "layer": "TEXTO",
                                "height": 2.0,
                                "rotation": safe_val,
                                "style": "PRO_STYLE",
                            },
                        )
                        text.dxf.halign = 1
                        text.dxf.valign = 2
                        text.dxf.insert = label_point
                        text.dxf.align_point = label_point
                    except Exception as te:
                        Logger.info(f"Criação de label falhou: {te}")

        if isinstance(geom, Polygon):
            self._draw_polygon(geom, layer, diff_x, diff_y, tags)
        elif isinstance(geom, MultiPolygon):
            for poly in geom.geoms:
                self._draw_polygon(poly, layer, diff_x, diff_y, tags)
        if isinstance(geom, LineString):
            self._draw_linestring(geom, layer, diff_x, diff_y)
            if layer == "VIAS" and "highway" in tags:
                self._draw_street_offsets(geom, tags, diff_x, diff_y)
        elif isinstance(geom, MultiLineString):
            for line in geom.geoms:
                self._draw_linestring(line, layer, diff_x, diff_y)
                if layer == "VIAS" and "highway" in tags:
                    self._draw_street_offsets(line, tags, diff_x, diff_y)
        elif isinstance(geom, Point):
            self._draw_point(geom, layer, diff_x, diff_y, tags)

    def _draw_street_offsets(self, line, tags, diff_x, diff_y):
        """Desenha linhas paralelas (meio-fios) para vias usando larguras autoritativas."""
        highway = tags.get("highway", "residential")
        if highway in ["footway", "path", "cycleway", "steps"]:
            return

        width = DXFStyleManager.get_street_width(highway)

        try:
            if hasattr(line, "offset_curve"):
                left = line.offset_curve(width, join_style=2)
                right = line.offset_curve(-width, join_style=2)
            else:
                left = line.parallel_offset(width, "left", join_style=2)
                right = line.parallel_offset(width, "right", join_style=2)

            for side_geom in [left, right]:
                if side_geom.is_empty:
                    continue

                if isinstance(side_geom, LineString):
                    pts = [
                        self._safe_p((p[0] - diff_x, p[1] - diff_y))
                        for p in side_geom.coords
                    ]
                    pts = self._validate_points(pts, min_points=2)
                    if pts:
                        self.msp.add_lwpolyline(pts, dxfattribs={"layer": "VIAS_MEIO_FIO"})
                elif isinstance(side_geom, MultiLineString):
                    for subline in side_geom.geoms:
                        pts = [
                            self._safe_p((p[0] - diff_x, p[1] - diff_y))
                            for p in subline.coords
                        ]
                        pts = self._validate_points(pts, min_points=2)
                        if pts:
                            self.msp.add_lwpolyline(pts, dxfattribs={"layer": "VIAS_MEIO_FIO"})
        except Exception as e:
            Logger.info(f"Offset de via falhou: {e}")

    def _get_thickness(self, tags, layer):
        """Calcula altura de extrusão baseada em tags OSM (padrão 2.5D)."""
        if layer != "EDIFICACAO":
            return 0.0

        try:
            if "height" in tags:
                h = str(tags["height"]).split(" ")[0]
                val = float(h)
                return self._safe_v(val, fallback_val=3.5)

            if "building:levels" in tags:
                val = float(tags["building:levels"]) * 3.0
                return self._safe_v(val, fallback_val=3.5)

            if "levels" in tags:
                val = float(tags["levels"]) * 3.0
                return self._safe_v(val, fallback_val=3.5)

            return 3.5
        except (ValueError, TypeError, KeyError) as e:
            Logger.error(f"Erro calculando altura das tags: {e}")
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        thickness = self._get_thickness(tags, layer)
        dxf_attribs = {"layer": layer, "thickness": thickness}

        points = [
            self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in poly.exterior.coords
        ]
        points = self._validate_points(points, min_points=3)
        if not points:
            return
        self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)

        if layer == "EDIFICACAO":
            try:
                area = poly.area
                centroid = poly.centroid
                if centroid and not (
                    math.isnan(area) or math.isinf(area)
                    or math.isnan(centroid.x) or math.isnan(centroid.y)
                ):
                    safe_p = (
                        self._safe_v(centroid.x - diff_x),
                        self._safe_v(centroid.y - diff_y),
                    )
                    txt = self.msp.add_text(
                        f"{area:.1f} m2",
                        dxfattribs={"layer": "ANNOT_AREA", "height": 1.5, "color": 7},
                    )
                    txt.dxf.halign = 1
                    txt.dxf.valign = 2
                    txt.dxf.insert = safe_p
                    txt.dxf.align_point = safe_p
            except Exception as e:
                Logger.info(f"Anotação de área falhou: {e}")

            try:
                def deduplicate_epsilon(pts, eps=0.001):
                    if not pts:
                        return []
                    res = [pts[0]]
                    for i in range(1, len(pts)):
                        if math.dist(pts[i], res[-1]) > eps:
                            res.append(pts[i])
                    return res

                clean_points = deduplicate_epsilon(points)
                if clean_points and len(clean_points) >= 3:
                    hatch = self.msp.add_hatch(
                        color=253, dxfattribs={"layer": "EDIFICACAO_HATCH"}
                    )
                    hatch.set_pattern_fill("ANSI31", scale=0.5, angle=45.0)
                    hatch.paths.add_polyline_path(clean_points, is_closed=True)
            except Exception as he:
                Logger.info(f"Hatch de edificação falhou: {he}")

        for interior in poly.interiors:
            points = [
                self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in interior.coords
            ]
            points = self._validate_points(points, min_points=3)
            if points:
                self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)

    def _draw_linestring(self, line, layer, diff_x, diff_y):
        pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]
        points = self._validate_points(pts, min_points=2)
        if not points:
            return
        self.msp.add_lwpolyline(points, close=False, dxfattribs={"layer": layer})

        if layer == "VIAS":
            try:
                length = line.length
                if not (math.isnan(length) or math.isinf(length)):
                    mid = line.interpolate(0.5, normalized=True)
                    if mid and not (math.isnan(mid.x) or math.isnan(mid.y)):
                        safe_mid = (
                            self._safe_v(mid.x - diff_x),
                            self._safe_v(mid.y - diff_y),
                        )
                        ltxt = self.msp.add_text(
                            f"{length:.1f}m",
                            dxfattribs={
                                "layer": "ANNOT_LENGTH",
                                "height": 2.0,
                                "color": 7,
                                "rotation": 0.0,
                            },
                        )
                        ltxt.dxf.halign = 1
                        ltxt.dxf.valign = 2
                        ltxt.dxf.insert = safe_mid
                        ltxt.dxf.align_point = safe_mid
            except Exception as e:
                Logger.info(f"Anotação de comprimento falhou: {e}")

    def _draw_point(self, point, layer, diff_x, diff_y, tags):
        if math.isnan(point.x) or math.isnan(point.y):
            return

        x, y = self._safe_v(point.x - diff_x), self._safe_v(point.y - diff_y)

        attribs = self._sanitize_attribs(
            {
                "ID": tags.get("osmid", "999"),
                "TYPE": tags.get("power", tags.get("amenity", "UNKNOWN")),
                "V_LEVEL": tags.get("voltage", "0V"),
            }
        )

        if layer == "VEGETACAO":
            self.msp.add_blockref("ARVORE", (x, y))
        elif layer == "MOBILIARIO_URBANO":
            amenity = tags.get("amenity")
            highway = tags.get("highway")
            if amenity == "bench":
                self.msp.add_blockref("BANCO", (x, y))
            elif amenity == "waste_basket":
                self.msp.add_blockref("LIXEIRA", (x, y))
            elif highway == "street_lamp":
                self.msp.add_blockref("POSTE_LUZ", (x, y))
            else:
                self.msp.add_circle((x, y), radius=0.3, dxfattribs={"layer": layer, "color": 40})
        elif layer == "EQUIPAMENTOS":
            self.msp.add_blockref("POSTE", (x, y)).add_auto_attribs(attribs)
        elif "INFRA_POWER" in layer:
            if layer == "INFRA_POWER_HV" or tags.get("power") == "tower":
                self.msp.add_blockref("TORRE", (x, y)).add_auto_attribs(attribs)
            else:
                self.msp.add_blockref("POSTE", (x, y)).add_auto_attribs(attribs)
        elif layer == "INFRA_TELECOM":
            self.msp.add_blockref(
                "POSTE", (x, y), dxfattribs={"xscale": 0.8, "yscale": 0.8}
            ).add_auto_attribs(attribs)
        else:
            self.msp.add_circle((x, y), radius=0.5, dxfattribs={"layer": layer})

    def add_terrain_from_grid(self, grid_rows):
        """
        grid_rows: Lista de linhas, onde cada linha é uma lista de tuplas (x, y, z).
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
                    Logger.error(f"Erro definindo vértice ({r}, {c}): {e}")
                    mesh.set_mesh_vertex((r, c), (0.0, 0.0, 0.0))

    def add_contour_lines(self, contour_lines, use_spline=True):
        """
        Desenha curvas de nível como SPLINE suaves quando possível.
        Fallback para polylines 3D por compatibilidade.
        contour_lines: Lista de pontos [(x, y, z), ...] ou lista de listas de pontos.
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
                    Logger.info(f"Spline de contorno → fallback polyline: {e}")

            self.msp.add_polyline3d(
                valid_line, dxfattribs={"layer": "TOPOGRAFIA_CURVAS", "color": 8}
            )

    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Adiciona Rosa dos Ventos e Barra de Escala ao desenho."""
        try:
            margin = 10.0
            na_x = self._safe_v(max_x - diff_x - margin)
            na_y = self._safe_v(max_y - diff_y - margin)
            self.msp.add_blockref("NORTE", (na_x, na_y))

            sb_x = self._safe_v(max_x - diff_x - 30.0)
            sb_y = self._safe_v(min_y - diff_y + margin)
            self.msp.add_blockref("ESCALA", (sb_x, sb_y))
        except Exception as e:
            Logger.info(f"Elementos cartográficos falharam: {e}")

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Desenha moldura com rótulos de coordenadas."""
        import numpy as np
        from ezdxf.enums import TextEntityAlignment

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
                    Logger.error(f"Erro adicionando label eixo-x em {x}: {e}")

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
                    Logger.error(f"Erro adicionando label eixo-y em {y}: {e}")
