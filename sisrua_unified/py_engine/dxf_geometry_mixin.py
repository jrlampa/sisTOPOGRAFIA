import math
import re

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
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager

try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

# Patterns considered dangerous in DXF text/attribute values
_DANGEROUS_PATTERNS = re.compile(
    r'[;`]'                        # semicolons and backticks
    r'|\$\('                       # shell command substitution $(
    r'|[\x00-\x08\x0b-\x0c\x0e-\x1f]'  # control chars except \t(\x09) and \n(\x0a)
)


def sanitize_text_value(value: str, max_length: int = 512) -> str:
    """Sanitize a DXF text/attribute value against injection patterns.

    Strips dangerous characters (semicolons, backticks, shell substitution
    ``$(...)``, and C0 control characters except tab/newline) and truncates
    values that exceed *max_length* characters.

    Args:
        value: Raw string to sanitize.
        max_length: Maximum allowed length (default 512). Values longer than
            this are truncated and appended with ``"..."``.

    Returns:
        Sanitized string safe for inclusion in DXF attributes.
    """
    if not isinstance(value, str):
        value = str(value)

    # Remove dangerous patterns
    value = _DANGEROUS_PATTERNS.sub("", value)

    # Truncate if over length limit
    if len(value) > max_length:
        value = value[:max_length] + "..."

    return value


class DXFGeometryMixin:
    """Mixin providing geometry and feature drawing methods for DXFGenerator."""

    def add_features(self, gdf):
        """
        Iterates over a GeoDataFrame and adds entities to the DXF.
        Assumes the GDF is projected (units in meters).
        """
        if gdf.empty:
            return

        # Center the drawing roughly around (0,0) based on the first feature.
        # AUTHORITATIVE OFFSET: Once set, it applies to everything.
        if not self._offset_initialized:
            centroids = gdf.geometry.centroid
            cx = centroids.x.dropna().mean() if not centroids.x.dropna().empty else 0.0
            cy = centroids.y.dropna().mean() if not centroids.y.dropna().empty else 0.0
            self.diff_x = self._safe_v(cx)
            self.diff_y = self._safe_v(cy)
            self._offset_initialized = True

        # Validate and store bounds
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
        """Maps OSM tags to DXF Layers"""
        # Power Infrastructure
        if "power" in tags and not pd.isna(tags["power"]):
            if tags["power"] in ["line", "tower", "substation"]:  # High Voltage usually
                return "INFRA_POWER_HV"
            return "INFRA_POWER_LV"

        # Telecom Infrastructure
        if "telecom" in tags and not pd.isna(tags["telecom"]):
            return "INFRA_TELECOM"

        # Street Furniture
        furniture_amenities = [
            "bench",
            "waste_basket",
            "bicycle_parking",
            "fountain",
            "drinking_water",
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

    def _safe_v(self, v, fallback_val=None):
        """Absolute guard for float values. Returns fallback_val if invalid."""
        try:
            val = float(v)
            if math.isnan(val) or math.isinf(val) or abs(val) > 1e11:
                return fallback_val if fallback_val is not None else 0.0
            return val
        except (ValueError, TypeError) as e:
            Logger.error(f"Invalid float value '{v}': {e}")
            return fallback_val if fallback_val is not None else 0.0

    def _safe_p(self, p):
        """Absolute guard for point tuples. Uses centroid fallbacks if possible."""
        try:
            cx = self.bounds[0] + (self.bounds[2] - self.bounds[0]) / 2
            cy = self.bounds[1] + (self.bounds[3] - self.bounds[1]) / 2
            return (
                self._safe_v(p[0], fallback_val=cx),
                self._safe_v(p[1], fallback_val=cy),
            )
        except (IndexError, TypeError) as e:
            Logger.error(f"Invalid point data '{p}': {e}")
            return (0.0, 0.0)

    def _validate_points(self, points, min_points=2, is_3d=False):
        """Validate points list for DXF entities to prevent read errors"""
        if not points or len(points) < min_points:
            return None

        valid_points = []
        last_p = None
        for p in points:
            try:
                vals = [self._safe_v(v, fallback_val=None) for v in p]
                if None in vals:
                    continue
                curr_p = tuple(vals)
                if curr_p != last_p:
                    valid_points.append(curr_p)
                    last_p = curr_p
            except (ValueError, TypeError, IndexError) as e:
                Logger.error(f"Skipping invalid point in validation: {e}")
                continue

        if len(valid_points) < min_points:
            return None

        return valid_points

    def _simplify_line(self, line, tolerance=0.1):
        """Uses shapely's built-in simplification for robust results."""
        return line.simplify(tolerance, preserve_topology=True)

    def _merge_contiguous_lines(self, lines_with_tags):
        """
        Attempts to merge LineStrings that share endpoints and have identical tags.
        Uses a small distance threshold to handle coordinate noise.
        """
        if not lines_with_tags:
            return []

        merged_results = []
        processed = set()
        dist_threshold = 0.5  # Max 50cm gap for auto-merging

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

                    if tags.get("name") != other_tags.get("name") or tags.get(
                        "highway"
                    ) != other_tags.get("highway"):
                        continue

                    p1_start, p1_end = curr_line.coords[0], curr_line.coords[-1]
                    p2_start, p2_end = other_line.coords[0], other_line.coords[-1]

                    def get_dist(pa, pb):
                        return math.sqrt((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2)

                    new_coords = None
                    if get_dist(p1_end, p2_start) < dist_threshold:
                        new_coords = (
                            list(curr_line.coords) + list(other_line.coords)[1:]
                        )
                    elif get_dist(p1_start, p2_end) < dist_threshold:
                        new_coords = (
                            list(other_line.coords) + list(curr_line.coords)[1:]
                        )
                    elif get_dist(p1_start, p2_start) < dist_threshold:
                        new_coords = (
                            list(reversed(other_line.coords))
                            + list(curr_line.coords)[1:]
                        )
                    elif get_dist(p1_end, p2_end) < dist_threshold:
                        new_coords = (
                            list(curr_line.coords)
                            + list(reversed(other_line.coords))[1:]
                        )

                    if new_coords:
                        curr_line = LineString(new_coords)
                        processed.add(j)
                        changed = True
                        break

            merged_results.append((curr_line, tags))

        Logger.info(
            f"Geometry Merging: Reduced {len(lines_with_tags)} segments to {len(merged_results)} polylines."
        )
        return merged_results

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags):
        """Recursive geometry drawing with text support"""
        if geom is None or geom.is_empty:
            return

        # Flatten GeometryCollections – gpd.clip can produce mixed-type collections.
        if isinstance(geom, GeometryCollection) and not isinstance(
            geom, (Polygon, MultiPolygon, LineString, MultiLineString, Point)
        ):
            for sub in geom.geoms:
                self._draw_geometry(sub, layer, diff_x, diff_y, tags)
            return

        if layer not in self.doc.layers:
            layer = "0"

        # Draw Labels for Streets
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
                                    rotation = (
                                        angle if -90 <= angle <= 90 else angle + 180
                                    )
                        except Exception:
                            pass

                    try:
                        safe_val = self._safe_v(rotation)
                        safe_align = (
                            self._safe_v(centroid.x - diff_x),
                            self._safe_v(centroid.y - diff_y),
                        )
                        if not self._should_draw_street_label(
                            name, safe_align, float(geom.length)
                        ):
                            return

                        label_point = self._find_clear_label_point(
                            safe_align,
                            preferred_offsets=[
                                (0.0, 0.0),
                                (0.0, 5.0),
                                (0.0, -5.0),
                                (5.0, 0.0),
                                (-5.0, 0.0),
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
                        Logger.info(f"Label creation failed: {te}")

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
        """Draws parallel lines (curbs) for streets using authoritative widths."""
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
                        self.msp.add_lwpolyline(
                            pts, dxfattribs={"layer": "VIAS_MEIO_FIO"}
                        )
                elif isinstance(side_geom, MultiLineString):
                    for subline in side_geom.geoms:
                        pts = [
                            self._safe_p((p[0] - diff_x, p[1] - diff_y))
                            for p in subline.coords
                        ]
                        pts = self._validate_points(pts, min_points=2)
                        if pts:
                            self.msp.add_lwpolyline(
                                pts, dxfattribs={"layer": "VIAS_MEIO_FIO"}
                            )
        except Exception as e:
            Logger.info(f"Street offset failed: {e}")

    def _get_thickness(self, tags, layer):
        """Calculates extrusion height based on OSM tags"""
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
            Logger.error(f"Error calculating height from tags: {e}")
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
                    math.isnan(area)
                    or math.isinf(area)
                    or math.isnan(centroid.x)
                    or math.isnan(centroid.y)
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
                Logger.info(f"Area annotation failed: {e}")

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
                Logger.info(f"Hatch failed for building: {he}")

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
                Logger.info(f"Length annotation failed: {e}")

    def _sanitize_attribs(self, attribs):
        """Sanitize attribute dict: reject NaN/empty values and apply injection hardening."""
        sanitized = {}
        for k, v in attribs.items():
            val = str(v)
            if val.lower() == "nan" or not val.strip():
                sanitized[k] = "N/A"
            else:
                sanitized[k] = sanitize_text_value(val)
        return sanitized

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
                self.msp.add_circle(
                    (x, y), radius=0.3, dxfattribs={"layer": layer, "color": 40}
                )
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
