import ezdxf
import os
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
import geopandas as gpd
import math

try:
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager
from ezdxf.enums import TextEntityAlignment

try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger


class DXFGenerator:
    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new("R2013")
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]  # Standard bounding box

        # Setup CAD standards via StyleManager (SRP Refactor)
        DXFStyleManager.setup_all(self.doc)

        self.msp = self.doc.modelspace()
        self.project_info = {}  # Store metadata for title block
        self.bt_context = {}
        self._offset_initialized = False
        self._street_label_registry = {}
        self._used_label_points = []

    def _distance(self, p1, p2):
        return math.sqrt(((p1[0] - p2[0]) ** 2) + ((p1[1] - p2[1]) ** 2))

    def _find_clear_label_point(
        self, base_point, preferred_offsets=None, min_distance=7.0
    ):
        if preferred_offsets is None:
            preferred_offsets = [
                (0.0, 0.0),
                (0.0, 4.0),
                (0.0, -4.0),
                (4.0, 0.0),
                (-4.0, 0.0),
                (6.0, 3.0),
                (6.0, -3.0),
                (-6.0, 3.0),
                (-6.0, -3.0),
            ]

        for dx, dy in preferred_offsets:
            candidate = (base_point[0] + dx, base_point[1] + dy)
            if all(
                self._distance(candidate, used) >= min_distance
                for used in self._used_label_points
            ):
                self._used_label_points.append(candidate)
                return candidate

        fallback = (base_point[0] + 8.0, base_point[1] + 8.0)
        self._used_label_points.append(fallback)
        return fallback

    def _should_draw_street_label(self, name, anchor, length_m):
        if not name or name.lower() == "nan":
            return False

        if length_m < 35.0:
            return False

        entries = self._street_label_registry.setdefault(name, [])
        if len(entries) >= 2:
            return False

        if any(self._distance(anchor, existing) < 45.0 for existing in entries):
            return False

        entries.append(anchor)
        return True

    def _add_text(
        self,
        text,
        point,
        layer="TEXTO",
        height=2.2,
        color=None,
        rotation=0.0,
        align=TextEntityAlignment.LEFT,
    ):
        attribs = {
            "layer": layer,
            "height": height,
            "rotation": rotation,
            "style": "PRO_STYLE",
        }
        if color is not None:
            attribs["color"] = color

        entity = self.msp.add_text(str(text), dxfattribs=attribs)
        entity.set_placement(point, align=align)
        return entity

    def _format_conductor_label(self, conductors):
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

    def _format_ramal_summary(self, ramais):
        if not isinstance(ramais, list) or not ramais:
            return []

        grouped = {}
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
        if label:
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

    # Legacy setup methods removed (handled by StyleManager)

    def add_features(self, gdf):
        """
        Iterates over a GeoDataFrame and adds entities to the DXF.
        Assumes the GDF is projected (units in meters).
        """
        if gdf.empty:
            return

        # Center the drawing roughly around (0,0) based on the first feature
        # AUTHORITATIVE OFFSET: Once set, it applies to everything (features, terrain, labels)
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
            return "INFRA_POWER_LV"  # poles, minor_lines

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
            return "VEGETACAO"  # Parks, etc
        if "waterway" in tags or "natural" in tags and tags["natural"] == "water":
            return "HIDROGRAFIA"

        return "0"  # Default layer

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
            # Fallback to current drawing centroid to avoid spikes to 0,0
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
                # Use our safe helper for each coordinate
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

                    # Tags must match exactly (basic check)
                    if tags.get("name") != other_tags.get("name") or tags.get(
                        "highway"
                    ) != other_tags.get("highway"):
                        continue

                    p1_start, p1_end = curr_line.coords[0], curr_line.coords[-1]
                    p2_start, p2_end = other_line.coords[0], other_line.coords[-1]

                    # Helper to check distance
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

        # Flatten GeometryCollections – gpd.clip can produce mixed-type
        # collections when a geometry is only partially inside the clip mask.
        from shapely.geometry import GeometryCollection

        if isinstance(geom, GeometryCollection) and not isinstance(
            geom, (Polygon, MultiPolygon, LineString, MultiLineString, Point)
        ):
            for sub in geom.geoms:
                self._draw_geometry(sub, layer, diff_x, diff_y, tags)
            return

        # Ensure layer exists in the document, or fallback to '0'
        if layer not in self.doc.layers:
            layer = "0"

        # Draw Labels for Streets
        if layer == "VIAS" and "name" in tags:
            name = str(tags["name"])
            if name.lower() != "nan" and name.strip():
                # Use centroid of the line to place text
                rotation = 0.0
                centroid = geom.centroid
                if (
                    not centroid.is_empty
                    and not math.isnan(centroid.x)
                    and not math.isnan(centroid.y)
                ):
                    if isinstance(geom, LineString) and geom.length > 0.1:
                        try:
                            # Get point at 45% and 55% to determine vector
                            p1 = geom.interpolate(0.45, normalized=True)
                            p2 = geom.interpolate(0.55, normalized=True)
                            if p1 and p2:
                                dx = p2.x - p1.x
                                dy = p2.y - p1.y
                                if abs(dx) > 1e-5 or abs(dy) > 1e-5:
                                    angle = np.degrees(np.arctan2(dy, dx))
                                    # Ensure text is readable (not upside down)
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
                        # AutoCAD REQUIRES both insert and align_point to be the same for centered text
                        text.dxf.halign = 1  # Center
                        text.dxf.valign = 2  # Middle
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
            # Draw offsets for streets
            if layer == "VIAS" and "highway" in tags:
                self._draw_street_offsets(
                    geom, tags, diff_x, diff_y
                )  # Call offset method

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
            return  # Skip thin paths

        # Get width from centralized StyleManager
        width = DXFStyleManager.get_street_width(highway)

        try:
            # Shapely 2.0+ uses offset_curve
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
            # Try specific height first
            if "height" in tags:
                # Handle "10 m" or "10"
                h = str(tags["height"]).split(" ")[0]
                val = float(h)
                return self._safe_v(val, fallback_val=3.5)

            # Try levels
            if "building:levels" in tags:
                val = float(tags["building:levels"]) * 3.0
                return self._safe_v(val, fallback_val=3.5)

            if "levels" in tags:
                val = float(tags["levels"]) * 3.0
                return self._safe_v(val, fallback_val=3.5)

            # Default for buildings
            return 3.5
        except (ValueError, TypeError, KeyError) as e:
            Logger.error(f"Error calculating height from tags: {e}")
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        # Calculate thickness (height)
        thickness = self._get_thickness(tags, layer)
        dxf_attribs = {"layer": layer, "thickness": thickness}

        # Exterior
        points = [
            self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in poly.exterior.coords
        ]
        points = self._validate_points(
            points, min_points=3
        )  # Polygons need at least 3 points
        if not points:
            return  # Skip invalid polygon
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

            # High-Fidelity Hatching (ANSI31) - Use validated points
            # AutoCAD's hatch engine hates micro-gaps (< 0.001 units)
            # We deduplicate points with a small epsilon
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

        # Holes (optional, complex polygons)
        for interior in poly.interiors:
            points = [
                self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in interior.coords
            ]
            points = self._validate_points(points, min_points=3)
            if points:
                self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)

    def _draw_linestring(self, line, layer, diff_x, diff_y):
        # Temporarily disabled simplification to troubleshoot distortion
        # pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]

        pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]
        points = self._validate_points(pts, min_points=2)
        if not points:
            return  # Skip invalid linestring
        self.msp.add_lwpolyline(points, close=False, dxfattribs={"layer": layer})

        # Annotate length for roads
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
        """Helper to ensure no 'nan' values are sent as attributes"""
        sanitized = {}
        for k, v in attribs.items():
            val = str(v)
            if val.lower() == "nan" or not val.strip():
                sanitized[k] = "N/A"
            else:
                sanitized[k] = val
        return sanitized

    def _draw_point(self, point, layer, diff_x, diff_y, tags):
        # Draw a small circle or block for points
        if math.isnan(point.x) or math.isnan(point.y):
            return

        x, y = self._safe_v(point.x - diff_x), self._safe_v(point.y - diff_y)

        # Prepare attributes with non-empty defaults (AutoCAD stability)
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

    def add_terrain_from_grid(self, grid_rows):
        """
        grid_rows: List of rows, where each row is a list of (x, y, z) tuples.
        """
        if not grid_rows or not grid_rows[0]:
            return

        rows = len(grid_rows)
        cols = len(grid_rows[0])

        # Ensure dimensions are valid for polymesh (min 2x2)
        if rows < 2 or cols < 2:
            return

        mesh = self.msp.add_polymesh(size=(rows, cols), dxfattribs={"layer": "TERRENO"})

        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                try:
                    # Apply AUTHORITATIVE OFFSET with absolute safety
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

            # Use spline for smoother contour curves (more cartographically faithful).
            # Fallback to polyline3d if spline creation fails for any segment.
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
            # Place North Arrow at top-right with margin
            margin = 10.0
            na_x = self._safe_v(max_x - diff_x - margin)
            na_y = self._safe_v(max_y - diff_y - margin)
            self.msp.add_blockref("NORTE", (na_x, na_y))

            # Place Scale Bar at bottom-right
            sb_x = self._safe_v(max_x - diff_x - 30.0)
            sb_y = self._safe_v(min_y - diff_y + margin)
            self.msp.add_blockref("ESCALA", (sb_x, sb_y))
        except Exception as e:
            Logger.info(f"Cartographic elements failed: {e}")

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Draws a boundary frame with coordinate labels"""
        # Strictly validate all grid inputs
        min_x, max_x = self._safe_v(min_x), self._safe_v(max_x)
        min_y, max_y = self._safe_v(min_y), self._safe_v(max_y)
        diff_x, diff_y = self._safe_v(diff_x), self._safe_v(diff_y)

        # Outer Frame
        frame_pts = [
            (min_x - diff_x - 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, min_y - diff_y - 5),
            (max_x - diff_x + 5, max_y - diff_y + 5),
            (min_x - diff_x - 5, max_y - diff_y + 5),
        ]
        self.msp.add_lwpolyline(
            frame_pts, close=True, dxfattribs={"layer": "QUADRO", "color": 7}
        )

        # Tick marks and labels (every 50m)
        step = 50.0
        # horizontal ticks (x)
        x_range = np.arange(np.floor(min_x / step) * step, max_x + 1, step)
        for x in x_range[:50]:  # Limit to 50 ticks max per axis
            dx = self._safe_v(x - diff_x)
            if min_x - 5 <= x <= max_x + 5:
                # Bottom label
                try:
                    self.msp.add_text(
                        f"E: {x:.0f}", dxfattribs={"height": 2, "layer": "QUADRO"}
                    ).set_placement(
                        (dx, min_y - diff_y - 8), align=TextEntityAlignment.CENTER
                    )
                except Exception as e:
                    Logger.error(f"Error adding x-axis label at {x}: {e}")
        # vertical ticks (y)
        y_range = np.arange(np.floor(min_y / step) * step, max_y + 1, step)
        for y in y_range[:50]:
            dy = self._safe_v(y - diff_y)
            if min_y - 5 <= y <= max_y + 5:
                # Left label
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
        # Place to the right of the drawing with safety
        start_x = self._safe_v(max_x - self.diff_x + 20)
        start_y = self._safe_v(max_y - self.diff_y)

        # Legend Header
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
            # Sample Geometry
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

        # Demand section adds: separator gap (6) + section header (6) + col header (5) + each entry (5)
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
        # 1. Create Layout
        layout = self.doc.layout("Layout1")

        # A3 is roughly 420x297 units (mm)
        width, height = 420, 297

        # 2. Draw A3 Border
        layout.add_lwpolyline(
            [(0, 0), (width, 0), (width, height), (0, height)],
            close=True,
            dxfattribs={"layer": "QUADRO", "lineweight": 50},
        )

        # 3. Create Viewport (Visualizing Model Space)
        # AUTHORITATIVE FIX: Viewport must point to the drawing centroid, not (0,0)
        # This prevents the drawing "vanishing" in georeferenced mode.
        cx = (self.bounds[0] + self.bounds[2]) / 2
        cy = (self.bounds[1] + self.bounds[3]) / 2
        view_x = cx - self.diff_x
        view_y = cy - self.diff_y

        # Calculate appropriate zoom height based on bounds
        v_height = (
            max(
                abs(self.bounds[2] - self.bounds[0]),
                abs(self.bounds[3] - self.bounds[1]),
            )
            * 1.2
        )
        if v_height < 50:
            v_height = 200  # Fallback for small areas

        vp = layout.add_viewport(
            center=(width / 2, height / 2 + 20),
            size=(width - 40, height - 80),
            view_center_point=(view_x, view_y),
            view_height=200,  # Fixed zoom for consistency
        )
        vp.dxf.status = 1

        # 4. Draw Title Block (Carimbo) - Bottom Right Corner
        cb_x, cb_y = width - 185, 0
        cb_w, cb_h = 185, 50

        # Main box
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

        # Sub-divisions
        layout.add_line(
            (cb_x, cb_y + 25), (cb_x + cb_w, cb_y + 25), dxfattribs={"layer": "QUADRO"}
        )
        layout.add_line(
            (cb_x + 100, cb_y), (cb_x + 100, cb_y + 25), dxfattribs={"layer": "QUADRO"}
        )

        # Add Text Fields (Sanitized)
        import datetime

        date_str = datetime.date.today().strftime("%d/%m/%Y")

        # Project Title with standardized alignment
        p_name = str(project).upper()
        c_name = str(client)
        d_name = str(designer)

        def add_layout_text(text, pos, height, style="PRO_STYLE"):
            t = layout.add_text(text, dxfattribs={"height": height, "style": style})
            t.dxf.halign = 0  # Left
            t.dxf.valign = 0  # Baseline
            t.dxf.insert = pos
            t.dxf.align_point = pos
            return t

        add_layout_text(f"PROJETO: {p_name[:50]}", (cb_x + 5, cb_y + 35), 4)
        add_layout_text(f"CLIENTE: {c_name[:50]}", (cb_x + 5, cb_y + 15), 3)
        add_layout_text(f"DATA: {date_str}", (cb_x + 105, cb_y + 15), 2.5)
        add_layout_text(f"ENGINE: sisRUA Unified v1.5", (cb_x + 105, cb_y + 5), 2)
        add_layout_text(f"RESPONSÁVEL: {d_name[:50]}", (cb_x + 5, cb_y + 5), 2.5)

        # Logo
        try:
            layout.add_blockref("LOGO", (cb_x + cb_w - 20, cb_y + cb_h - 10))
        except Exception as e:
            Logger.error(f"Error adding logo block reference: {e}")

    def save(self):
        # Professional finalization
        try:
            self.add_legend()
            self.add_bt_summary()
            self.add_title_block(
                client=self.project_info.get("client", "CLIENTE PADRÃO"),
                project=self.project_info.get("project", "EXTRACAO ESPACIAL OSM"),
            )
            self.doc.saveas(self.filename)
            Logger.info(f"DXF saved successfully: {os.path.basename(self.filename)}")
        except Exception as e:
            Logger.error(f"DXF Save Error: {e}")
