"""
geometry_drawer.py - Responsável pelo desenho de geometrias OSM no DXF.

Responsabilidades:
- Mapeamento de tags OSM para camadas DXF
- Desenho de polígonos (edificações), linhas (vias), pontos (infra urbana)
- Offsets de meio-fio para vias
- Anotações de área e comprimento
"""
import math

import numpy as np
import pandas as pd
from shapely.geometry import (
    GeometryCollection,
    LineString,
    MultiLineString,
    MultiPolygon,
    Point,
    Polygon,
)

try:
    from ..dxf_styles import DXFStyleManager
    from ..utils.logger import Logger
    from .drawing_context import DrawingContext
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager
    from utils.logger import Logger
    from domain.drawing_context import DrawingContext


class GeometryDrawer:
    """Desenhista especializado em geometrias OSM (features do GeoDataFrame)."""

    def __init__(self, ctx: DrawingContext):
        self.ctx = ctx

    # -------------------------------------------------------------------------
    # Ponto de entrada público
    # -------------------------------------------------------------------------

    def add_features(self, gdf) -> None:
        """
        Itera um GeoDataFrame projetado e adiciona entidades ao DXF.
        Inicializa o offset autorizado na primeira chamada.
        """
        if gdf.empty:
            return

        if not self.ctx._offset_initialized:
            centroids = gdf.geometry.centroid
            cx = centroids.x.dropna().mean() if not centroids.x.dropna().empty else 0.0
            cy = centroids.y.dropna().mean() if not centroids.y.dropna().empty else 0.0
            self.ctx.diff_x = self.ctx.safe_v(cx)
            self.ctx.diff_y = self.ctx.safe_v(cy)
            self.ctx._offset_initialized = True

        b = gdf.total_bounds
        self.ctx.bounds = (
            [0.0, 0.0, 100.0, 100.0]
            if any(math.isnan(v) or math.isinf(v) for v in b)
            else [float(v) for v in b]
        )

        for _, row in gdf.iterrows():
            geom = row.geometry
            tags = row.drop("geometry")
            layer = self.determine_layer(tags, row)
            self._draw_geometry(geom, layer, self.ctx.diff_x, self.ctx.diff_y, tags)

    # -------------------------------------------------------------------------
    # Mapeamento de tags -> Camadas
    # -------------------------------------------------------------------------

    def determine_layer(self, tags, row) -> str:
        """Mapeia tags OSM para camadas DXF."""
        if "power" in tags and not pd.isna(tags["power"]):
            return "INFRA_POWER_HV" if tags["power"] in ["line", "tower", "substation"] else "INFRA_POWER_LV"

        if "telecom" in tags and not pd.isna(tags["telecom"]):
            return "INFRA_TELECOM"

        furniture_amenities = ["bench", "waste_basket", "bicycle_parking", "fountain", "drinking_water"]
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

    # -------------------------------------------------------------------------
    # Orquestrador de geometrias
    # -------------------------------------------------------------------------

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags) -> None:
        """Despacha para o método de desenho correto conforme o tipo de geometria."""
        if geom is None or geom.is_empty:
            return

        if isinstance(geom, GeometryCollection) and not isinstance(
            geom, (Polygon, MultiPolygon, LineString, MultiLineString, Point)
        ):
            for sub in geom.geoms:
                self._draw_geometry(sub, layer, diff_x, diff_y, tags)
            return

        if layer not in self.ctx.doc.layers:
            layer = "0"

        if layer == "VIAS" and "name" in tags:
            self._draw_street_label(geom, tags, diff_x, diff_y)

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

    # -------------------------------------------------------------------------
    # Labels de vias
    # -------------------------------------------------------------------------

    def _draw_street_label(self, geom, tags, diff_x, diff_y) -> None:
        name = str(tags["name"])
        if name.lower() == "nan" or not name.strip():
            return

        rotation = 0.0
        centroid = geom.centroid
        if centroid.is_empty or math.isnan(centroid.x) or math.isnan(centroid.y):
            return

        if isinstance(geom, LineString) and geom.length > 0.1:
            try:
                p1 = geom.interpolate(0.45, normalized=True)
                p2 = geom.interpolate(0.55, normalized=True)
                if p1 and p2:
                    dx, dy = p2.x - p1.x, p2.y - p1.y
                    if abs(dx) > 1e-5 or abs(dy) > 1e-5:
                        angle = np.degrees(np.arctan2(dy, dx))
                        rotation = angle if -90 <= angle <= 90 else angle + 180
            except Exception:
                pass

        try:
            safe_val = self.ctx.safe_v(rotation)
            safe_align = (
                self.ctx.safe_v(centroid.x - diff_x),
                self.ctx.safe_v(centroid.y - diff_y),
            )
            if not self.ctx.should_draw_street_label(name, safe_align, float(geom.length)):
                return

            label_point = self.ctx.find_clear_label_point(
                safe_align,
                preferred_offsets=[(0.0, 0.0), (0.0, 5.0), (0.0, -5.0), (5.0, 0.0), (-5.0, 0.0)],
                min_distance=18.0,
            )
            text = self.ctx.msp.add_text(
                name,
                dxfattribs={"layer": "TEXTO", "height": 2.0, "rotation": safe_val, "style": "PRO_STYLE"},
            )
            text.dxf.halign = 1
            text.dxf.valign = 2
            text.dxf.insert = label_point
            text.dxf.align_point = label_point
        except Exception as te:
            Logger.info(f"Criação de label falhou: {te}")

    # -------------------------------------------------------------------------
    # Polígonos
    # -------------------------------------------------------------------------

    def _get_thickness(self, tags, layer) -> float:
        if layer != "EDIFICACAO":
            return 0.0
        try:
            if "height" in tags:
                h = str(tags["height"]).split(" ")[0]
                return self.ctx.safe_v(float(h), fallback_val=3.5)
            if "building:levels" in tags:
                return self.ctx.safe_v(float(tags["building:levels"]) * 3.0, fallback_val=3.5)
            if "levels" in tags:
                return self.ctx.safe_v(float(tags["levels"]) * 3.0, fallback_val=3.5)
            return 3.5
        except (ValueError, TypeError, KeyError) as e:
            Logger.error(f"Erro calculando altura das edificações: {e}")
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags) -> None:
        thickness = self._get_thickness(tags, layer)
        dxf_attribs = {"layer": layer, "thickness": thickness}

        points = [self.ctx.safe_p((p[0] - diff_x, p[1] - diff_y)) for p in poly.exterior.coords]
        points = self.ctx.validate_points(points, min_points=3)
        if not points:
            return

        self.ctx.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)

        if layer == "EDIFICACAO":
            self._annotate_building_area(poly, diff_x, diff_y)
            self._hatch_building(points)

        for interior in poly.interiors:
            inner = [self.ctx.safe_p((p[0] - diff_x, p[1] - diff_y)) for p in interior.coords]
            inner = self.ctx.validate_points(inner, min_points=3)
            if inner:
                self.ctx.msp.add_lwpolyline(inner, close=True, dxfattribs=dxf_attribs)

    def _annotate_building_area(self, poly, diff_x, diff_y) -> None:
        try:
            area = poly.area
            centroid = poly.centroid
            if centroid and not (math.isnan(area) or math.isinf(area)
                                 or math.isnan(centroid.x) or math.isnan(centroid.y)):
                safe_p = (self.ctx.safe_v(centroid.x - diff_x), self.ctx.safe_v(centroid.y - diff_y))
                txt = self.ctx.msp.add_text(
                    f"{area:.1f} m2",
                    dxfattribs={"layer": "ANNOT_AREA", "height": 1.5, "color": 7},
                )
                txt.dxf.halign = 1
                txt.dxf.valign = 2
                txt.dxf.insert = safe_p
                txt.dxf.align_point = safe_p
        except Exception as e:
            Logger.info(f"Anotação de área falhou: {e}")

    def _hatch_building(self, points) -> None:
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
                hatch = self.ctx.msp.add_hatch(color=253, dxfattribs={"layer": "EDIFICACAO_HATCH"})
                hatch.set_pattern_fill("ANSI31", scale=0.5, angle=45.0)
                hatch.paths.add_polyline_path(clean_points, is_closed=True)
        except Exception as he:
            Logger.info(f"Hachura de edificação falhou: {he}")

    # -------------------------------------------------------------------------
    # Linhas
    # -------------------------------------------------------------------------

    def _draw_linestring(self, line, layer, diff_x, diff_y) -> None:
        pts = [self.ctx.safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]
        points = self.ctx.validate_points(pts, min_points=2)
        if not points:
            return

        self.ctx.msp.add_lwpolyline(points, close=False, dxfattribs={"layer": layer})

        if layer == "VIAS":
            self._annotate_road_length(line, diff_x, diff_y)

    def _annotate_road_length(self, line, diff_x, diff_y) -> None:
        try:
            length = line.length
            if math.isnan(length) or math.isinf(length):
                return
            mid = line.interpolate(0.5, normalized=True)
            if mid and not (math.isnan(mid.x) or math.isnan(mid.y)):
                safe_mid = (self.ctx.safe_v(mid.x - diff_x), self.ctx.safe_v(mid.y - diff_y))
                ltxt = self.ctx.msp.add_text(
                    f"{length:.1f}m",
                    dxfattribs={"layer": "ANNOT_LENGTH", "height": 2.0, "color": 7, "rotation": 0.0},
                )
                ltxt.dxf.halign = 1
                ltxt.dxf.valign = 2
                ltxt.dxf.insert = safe_mid
                ltxt.dxf.align_point = safe_mid
        except Exception as e:
            Logger.info(f"Anotação de comprimento falhou: {e}")

    def _draw_street_offsets(self, line, tags, diff_x, diff_y) -> None:
        """Desenha linhas paralelas (meio-fio) para vias."""
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
                    pts = [self.ctx.safe_p((p[0] - diff_x, p[1] - diff_y)) for p in side_geom.coords]
                    pts = self.ctx.validate_points(pts, min_points=2)
                    if pts:
                        self.ctx.msp.add_lwpolyline(pts, dxfattribs={"layer": "VIAS_MEIO_FIO"})
                elif isinstance(side_geom, MultiLineString):
                    for subline in side_geom.geoms:
                        pts = [self.ctx.safe_p((p[0] - diff_x, p[1] - diff_y)) for p in subline.coords]
                        pts = self.ctx.validate_points(pts, min_points=2)
                        if pts:
                            self.ctx.msp.add_lwpolyline(pts, dxfattribs={"layer": "VIAS_MEIO_FIO"})
        except Exception as e:
            Logger.info(f"Offset de via falhou: {e}")

    # -------------------------------------------------------------------------
    # Pontos
    # -------------------------------------------------------------------------

    def _draw_point(self, point, layer, diff_x, diff_y, tags) -> None:
        if math.isnan(point.x) or math.isnan(point.y):
            return

        x = self.ctx.safe_v(point.x - diff_x)
        y = self.ctx.safe_v(point.y - diff_y)
        attribs = self.ctx.sanitize_attribs({
            "ID": tags.get("osmid", "999"),
            "TYPE": tags.get("power", tags.get("amenity", "UNKNOWN")),
            "V_LEVEL": tags.get("voltage", "0V"),
        })

        if layer == "VEGETACAO":
            self.ctx.msp.add_blockref("ARVORE", (x, y))
        elif layer == "MOBILIARIO_URBANO":
            amenity = tags.get("amenity")
            highway = tags.get("highway")
            if amenity == "bench":
                self.ctx.msp.add_blockref("BANCO", (x, y))
            elif amenity == "waste_basket":
                self.ctx.msp.add_blockref("LIXEIRA", (x, y))
            elif highway == "street_lamp":
                self.ctx.msp.add_blockref("POSTE_LUZ", (x, y))
            else:
                self.ctx.msp.add_circle((x, y), radius=0.3, dxfattribs={"layer": layer, "color": 40})
        elif layer == "EQUIPAMENTOS":
            self.ctx.msp.add_blockref("POSTE", (x, y)).add_auto_attribs(attribs)
        elif "INFRA_POWER" in layer:
            if layer == "INFRA_POWER_HV" or tags.get("power") == "tower":
                self.ctx.msp.add_blockref("TORRE", (x, y)).add_auto_attribs(attribs)
            else:
                self.ctx.msp.add_blockref("POSTE", (x, y)).add_auto_attribs(attribs)
        elif layer == "INFRA_TELECOM":
            self.ctx.msp.add_blockref(
                "POSTE", (x, y), dxfattribs={"xscale": 0.8, "yscale": 0.8}
            ).add_auto_attribs(attribs)
        else:
            self.ctx.msp.add_circle((x, y), radius=0.5, dxfattribs={"layer": layer})

    # -------------------------------------------------------------------------
    # Fusão de linhas contíguas
    # -------------------------------------------------------------------------

    def merge_contiguous_lines(self, lines_with_tags: list) -> list:
        """
        Tenta fundir LineStrings contíguas com tags idênticas.
        Usa threshold de distância para tolerar ruído de coordenadas.
        """
        if not lines_with_tags:
            return []

        merged_results = []
        processed = set()
        dist_threshold = 0.5

        for i, (line, tags) in enumerate(lines_with_tags):
            if i in processed:
                continue

            curr_line = line
            processed.add(i)
            changed = True

            while changed:
                changed = False
                for j, (other_line, other_tags) in enumerate(lines_with_tags):
                    if j in processed:
                        continue
                    if tags.get("name") != other_tags.get("name") or tags.get("highway") != other_tags.get("highway"):
                        continue

                    p1_start, p1_end = curr_line.coords[0], curr_line.coords[-1]
                    p2_start, p2_end = other_line.coords[0], other_line.coords[-1]

                    def get_dist(pa, pb):
                        return math.sqrt((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2)

                    new_coords = None
                    if get_dist(p1_end, p2_start) < dist_threshold:
                        new_coords = list(curr_line.coords) + list(other_line.coords)[1:]
                    elif get_dist(p1_start, p2_end) < dist_threshold:
                        new_coords = list(other_line.coords) + list(curr_line.coords)[1:]
                    elif get_dist(p1_start, p2_start) < dist_threshold:
                        new_coords = list(reversed(other_line.coords)) + list(curr_line.coords)[1:]
                    elif get_dist(p1_end, p2_end) < dist_threshold:
                        new_coords = list(curr_line.coords) + list(reversed(other_line.coords))[1:]

                    if new_coords:
                        curr_line = LineString(new_coords)
                        processed.add(j)
                        changed = True
                        break

            merged_results.append((curr_line, tags))

        Logger.info(
            f"Fusão de geometrias: {len(lines_with_tags)} segmentos → {len(merged_results)} polylines."
        )
        return merged_results
