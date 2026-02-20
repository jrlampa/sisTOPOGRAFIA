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

# ── Módulos extraídos (SRP Refactor P3-C2) ───────────────────────────────────
try:
    from .layer_classifier import classify_layer
    from .bim_data_attacher import attach_bim_data
    from .legend_builder import LegendBuilder
except (ImportError, ValueError):
    from layer_classifier import classify_layer
    from bim_data_attacher import attach_bim_data
    from legend_builder import LegendBuilder

class DXFGenerator:
    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new('R2013')
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]  # Standard bounding box
        
        # Setup CAD standards via StyleManager (SRP Refactor)
        DXFStyleManager.setup_all(self.doc)
        
        self.msp = self.doc.modelspace()
        self.project_info = {} # Store metadata for title block
        self._offset_initialized = False

        # Half-way BIM AppID Registration
        try:
            self.doc.appids.new('SISRUA_BIM')
        except Exception:
            pass # Already exists

    def _add_bim_data(self, entity, tags):
        """Delega para bim_data_attacher (SRP Refactor P3-C2)."""
        attach_bim_data(entity, tags)

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
            tags = row.drop('geometry')
            layer = self.determine_layer(tags, row)
            
            self._draw_geometry(geom, layer, self.diff_x, self.diff_y, tags)

    def determine_layer(self, tags, row):
        """Delega para layer_classifier.classify_layer() (SRP Refactor P3-C2)."""
        return classify_layer(tags)

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
            cx = self.bounds[0] + (self.bounds[2] - self.bounds[0])/2
            cy = self.bounds[1] + (self.bounds[3] - self.bounds[1])/2
            return (self._safe_v(p[0], fallback_val=cx), self._safe_v(p[1], fallback_val=cy))
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
        if not lines_with_tags: return []
        
        merged_results = []
        processed = set()
        dist_threshold = 0.5 # Max 50cm gap for auto-merging
        
        for i, (line, tags) in enumerate(lines_with_tags):
            if i in processed: continue
            
            curr_line = line
            processed.add(i)
            
            changed = True
            while changed:
                changed = False
                for j, (other_line, other_tags) in enumerate(lines_with_tags):
                    if j in processed: continue
                    
                    # Tags must match exactly (basic check)
                    if tags.get('name') != other_tags.get('name') or tags.get('highway') != other_tags.get('highway'):
                        continue
                        
                    p1_start, p1_end = curr_line.coords[0], curr_line.coords[-1]
                    p2_start, p2_end = other_line.coords[0], other_line.coords[-1]
                    
                    # Helper to check distance
                    def get_dist(pa, pb):
                        return math.sqrt((pa[0]-pb[0])**2 + (pa[1]-pb[1])**2)

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
            
        Logger.info(f"Geometry Merging: Reduced {len(lines_with_tags)} segments to {len(merged_results)} polylines.")
        return merged_results

    def _draw_geometry(self, geom, layer, diff_x, diff_y, tags):
        """Recursive geometry drawing with text support"""
        if geom.is_empty:
            return

        # Ensure layer exists in the document, or fallback to '0'
        if layer not in self.doc.layers:
            layer = '0'

        # Draw Labels for Streets
        if (layer == 'sisTOPO_VIAS' or layer == '0') and 'name' in tags:
            name = str(tags['name'])
            if name.lower() != 'nan' and name.strip():
                # Use centroid of the line to place text
                rotation = 0.0
                centroid = geom.centroid
                if not centroid.is_empty and not math.isnan(centroid.x) and not math.isnan(centroid.y):
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
                                    rotation = angle if -90 <= angle <= 90 else angle + 180
                        except Exception:
                            pass

                    try:
                        safe_val = self._safe_v(rotation)
                        safe_align = (self._safe_v(centroid.x - diff_x), self._safe_v(centroid.y - diff_y))
                        text = self.msp.add_text(
                            name, 
                            dxfattribs={
                                'layer': 'sisTOPO_TEXTO', 
                                'height': 2.5,
                                'rotation': safe_val,
                                'style': 'PRO_STYLE'
                            }
                        )
                        # AutoCAD REQUIRES both insert and align_point to be the same for centered text
                        text.dxf.halign = 1 # Center
                        text.dxf.valign = 2 # Middle
                        text.dxf.insert = safe_align
                        text.dxf.align_point = safe_align
                    except Exception as te:
                        Logger.info(f"Label creation failed: {te}")

        if isinstance(geom, Polygon):
            self._draw_polygon(geom, layer, diff_x, diff_y, tags)
        elif isinstance(geom, MultiPolygon):
            for poly in geom.geoms:
                self._draw_polygon(poly, layer, diff_x, diff_y, tags)
        if isinstance(geom, LineString):
            self._draw_linestring(geom, layer, diff_x, diff_y, tags)
            # Draw offsets for streets
            if layer == 'sisTOPO_VIAS' and 'highway' in tags:
                 self._draw_street_offsets(geom, tags, diff_x, diff_y) # Call offset method

        elif isinstance(geom, MultiLineString):
            for line in geom.geoms:
                self._draw_linestring(line, layer, diff_x, diff_y, tags)
                if layer == 'sisTOPO_VIAS' and 'highway' in tags:
                     self._draw_street_offsets(line, tags, diff_x, diff_y)

        elif isinstance(geom, Point):
            self._draw_point(geom, layer, diff_x, diff_y, tags)

    def _draw_street_offsets(self, line, tags, diff_x, diff_y):
        """Draws parallel lines (curbs) for streets using authoritative widths."""
        highway = tags.get('highway', 'residential')
        if highway in ['footway', 'path', 'cycleway', 'steps']:
            return # Skip thin paths
            
        # Get width from centralized StyleManager
        width = DXFStyleManager.get_street_width(highway)
        
        try:
            # Shapely 2.0+ uses offset_curve
            if hasattr(line, 'offset_curve'):
                 left = line.offset_curve(width, join_style=2)
                 right = line.offset_curve(-width, join_style=2)
            else:
                 left = line.parallel_offset(width, 'left', join_style=2)
                 right = line.parallel_offset(width, 'right', join_style=2)
            
            for side_geom in [left, right]:
                if side_geom.is_empty: continue
                
                if isinstance(side_geom, LineString):
                    pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in side_geom.coords]
                    pts = self._validate_points(pts, min_points=2)
                    if pts:
                        self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'sisTOPO_VIAS_MEIO_FIO', 'color': 251})
                elif isinstance(side_geom, MultiLineString):
                    for subline in side_geom.geoms:
                        pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in subline.coords]
                        pts = self._validate_points(pts, min_points=2)
                        if pts:
                            self.msp.add_lwpolyline(pts, dxfattribs={'layer': 'sisTOPO_VIAS_MEIO_FIO', 'color': 251})
        except Exception as e:
            Logger.info(f"Street offset failed: {e}")

    def _get_thickness(self, tags, layer):
        """Calculates extrusion height based on OSM tags"""
        if layer != 'sisTOPO_EDIFICACAO':
            return 0.0
            
        try:
            # Try specific height first
            if 'height' in tags:
                # Handle "10 m" or "10"
                h = str(tags['height']).split(' ')[0]
                val = float(h)
                return self._safe_v(val, fallback_val=3.5)
            
            # Try levels
            if 'building:levels' in tags:
                val = float(tags['building:levels']) * 3.0
                return self._safe_v(val, fallback_val=3.5)
            
            if 'levels' in tags:
                val = float(tags['levels']) * 3.0
                return self._safe_v(val, fallback_val=3.5)

            # Default for buildings
            return 3.5
        except (ValueError, TypeError, KeyError) as e:
            Logger.error(f"Error calculating height from tags: {e}")
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        # Calculate thickness (height)
        thickness = self._get_thickness(tags, layer)
        dxf_attribs = {'layer': layer, 'thickness': thickness}

        # Exterior
        points = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in poly.exterior.coords]
        points = self._validate_points(points, min_points=3)  # Polygons need at least 3 points
        if not points:
            return  # Skip invalid polygon
        entity = self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)
        self._add_bim_data(entity, tags)
        
        if layer == 'sisTOPO_EDIFICACAO':
            try:
                area = poly.area
                centroid = poly.centroid
                if centroid and not (math.isnan(area) or math.isinf(area) or math.isnan(centroid.x) or math.isnan(centroid.y)):
                    safe_p = (self._safe_v(centroid.x - diff_x), self._safe_v(centroid.y - diff_y))
                    txt = self.msp.add_text(
                        f"{area:.1f} m2",
                        dxfattribs={
                            'layer': 'sisTOPO_ANNOT_AREA',
                            'height': 1.5,
                            'color': 7
                        }
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
                    if not pts: return []
                    res = [pts[0]]
                    for i in range(1, len(pts)):
                        if math.dist(pts[i], res[-1]) > eps:
                            res.append(pts[i])
                    return res

                clean_points = deduplicate_epsilon(points)
                if clean_points and len(clean_points) >= 3:
                    hatch = self.msp.add_hatch(color=253, dxfattribs={'layer': 'sisTOPO_EDIFICACAO_HATCH'})
                    hatch.set_pattern_fill('ANSI31', scale=0.5, angle=45.0)
                    hatch.paths.add_polyline_path(clean_points, is_closed=True)
            except Exception as he:
                Logger.info(f"Hatch failed for building: {he}")

        # Holes (optional, complex polygons)
        for interior in poly.interiors:
             points = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in interior.coords]
             points = self._validate_points(points, min_points=3)
             if points:
                 inner_entity = self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)
                 self._add_bim_data(inner_entity, tags)

    def _draw_linestring(self, line, layer, diff_x, diff_y, tags):
        # Temporarily disabled simplification to troubleshoot distortion
        # pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]
        
        pts = [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords]
        points = self._validate_points(pts, min_points=2)
        if not points:
            return  # Skip invalid linestring
        entity = self.msp.add_lwpolyline(points, close=False, dxfattribs={'layer': layer})
        self._add_bim_data(entity, tags)
        
        # Annotate length for roads
        if layer == 'sisTOPO_VIAS':
            try:
                length = line.length
                if not (math.isnan(length) or math.isinf(length)):
                    mid = line.interpolate(0.5, normalized=True)
                    if mid and not (math.isnan(mid.x) or math.isnan(mid.y)):
                        safe_mid = (self._safe_v(mid.x - diff_x), self._safe_v(mid.y - diff_y))
                        ltxt = self.msp.add_text(
                            f"{length:.1f}m",
                            dxfattribs={
                                'layer': 'sisTOPO_ANNOT_LENGTH',
                                'height': 2.0,
                                'color': 7,
                                'rotation': 0.0
                            }
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
            if val.lower() == 'nan' or not val.strip():
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
        attribs = self._sanitize_attribs({
            'ID': tags.get('osmid', '999'),
            'TYPE': tags.get('power', tags.get('amenity', 'UNKNOWN')),
            'V_LEVEL': tags.get('voltage', '0V')
        })

        if layer == 'sisTOPO_VEGETACAO':
             ent = self.msp.add_blockref('ARVORE', (x, y))
             self._add_bim_data(ent, tags)
        elif layer == 'sisTOPO_MOBILIARIO_URBANO':
             amenity = tags.get('amenity')
             highway = tags.get('highway')
             if amenity == 'bench':
                 ent = self.msp.add_blockref('BANCO', (x, y))
             elif amenity == 'waste_basket':
                 ent = self.msp.add_blockref('LIXEIRA', (x, y))
             elif highway == 'street_lamp':
                 ent = self.msp.add_blockref('POSTE_LUZ', (x, y))
             else:
                 ent = self.msp.add_circle((x, y), radius=0.3, dxfattribs={'layer': layer, 'color': 40})
             self._add_bim_data(ent, tags)
        elif layer == 'sisTOPO_EQUIPAMENTOS':
             ent = self.msp.add_blockref('POSTE', (x, y))
             ent.add_auto_attribs(attribs)
             self._add_bim_data(ent, tags)
        elif 'INFRA_POWER' in layer:
             if layer == 'sisTOPO_INFRA_POWER_HV' or tags.get('power') == 'tower':
                 ent = self.msp.add_blockref('TORRE', (x, y))
             else:
                 ent = self.msp.add_blockref('POSTE', (x, y))
             ent.add_auto_attribs(attribs)
             self._add_bim_data(ent, tags)
        elif layer == 'sisTOPO_INFRA_TELECOM':
             ent = self.msp.add_blockref('POSTE', (x, y), dxfattribs={'xscale': 0.8, 'yscale': 0.8})
             ent.add_auto_attribs(attribs)
             self._add_bim_data(ent, tags)
        else:
             ent = self.msp.add_circle((x, y), radius=0.5, dxfattribs={'layer': layer})
             self._add_bim_data(ent, tags)

    def add_terrain_from_grid(self, grid_rows):
        """
        grid_rows: List of rows, where each row is a list of (x, y, z) tuples.
        """
        if not grid_rows or not grid_rows[0]:
            return
            
        rows = len(grid_rows)
        cols = len(grid_rows[0])
        
        # Ensure dimensions are valid (min 2x2 points)
        if rows < 2 or cols < 2:
            return

        # 2.5D Enforcement: Replaced 3D polymesh with individual 3D Points
        for r, row in enumerate(grid_rows):
            for c, p in enumerate(row):
                try:
                    x = self._safe_v(float(p[0]) - self.diff_x)
                    y = self._safe_v(float(p[1]) - self.diff_y)
                    z = self._safe_v(float(p[2]))
                    self.msp.add_point((x, y, z), dxfattribs={'layer': 'sisTOPO_TERRENO_PONTOS', 'color': 252})
                except (ValueError, TypeError, IndexError) as e:
                    Logger.error(f"Error setting point at ({r}, {c}): {e}")

    def add_contour_lines(self, contour_lines, interval=1.0):
        """
        Draws contour lines.
        contour_lines: List of points [(x, y, z), ...] or list of lists of points.
        """
        for line_points in contour_lines:
             if len(line_points) < 2:
                 continue
             
             # 2.5D Enforcement: Use 2D lwpolyline with elevation attribute rather than full 3D polyline
             z_val = self._safe_v(line_points[0][2]) if len(line_points[0]) > 2 else 0.0
             pts_2d = [(self._safe_v(p[0]), self._safe_v(p[1])) for p in line_points]
             
             is_major = abs(z_val % (5 * interval)) < 0.01
             layer = 'TOPOGRAFIA_CURVAS_MESTRA' if is_major else 'sisTOPO_TOPOGRAFIA_CURVAS'
             color = 8 if not is_major else 7
             
             valid_line = self._validate_points(pts_2d, min_points=2)
             if valid_line:
                 self.msp.add_lwpolyline(
                     valid_line, 
                     dxfattribs={
                         'layer': layer, 
                         'color': color,
                         'elevation': z_val
                     }
                 )
                 
                 # Automated Labeling for Major Contours
                 if is_major and len(valid_line) > 10:
                     mid_idx = len(valid_line) // 2
                     p1 = valid_line[mid_idx]
                     p2 = valid_line[mid_idx + 1]
                     
                     # Calculate rotation angle
                     angle = math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))
                     if angle > 90: angle -= 180
                     if angle < -90: angle += 180
                     
                     self.msp.add_text(
                         f"{z_val:.0f}",
                         dxfattribs={
                             'layer': 'sisTOPO_TOPOGRAFIA_CURVAS_TEXTO',
                             'height': 1.8,
                             'rotation': angle,
                             'color': 7,
                             'style': 'STANDARD'
                         }
                     ).set_placement(p1)


    def add_hydrology(self, grid_rows):
        """
        Extracts and draws natural drainage lines (talwegs) based on surface curvature.
        """
        if not grid_rows or len(grid_rows) < 3: return
        try:
            import numpy as np
            # Reconstruct Z grid
            rows = len(grid_rows)
            cols = len(grid_rows[0])
            Z = np.zeros((rows, cols))
            for r in range(rows):
                for c in range(cols):
                    Z[r, c] = grid_rows[r][c][2]
            
            # Simple analytical proxy for hydrology
            gy, gx = np.gradient(Z)
            gyy, gyx = np.gradient(gy)
            gxy, gxx = np.gradient(gx)
            laplacian = gxx + gyy
            
            # Areas of high positive laplacian and slope -> potential drainage
            mask = laplacian > 0.05
            
            segments_drawn = 0
            for r in range(1, rows - 1):
                for c in range(1, cols - 1):
                    if mask[r, c]:
                        p1 = grid_rows[r][c]
                        vx, vy = -gx[r, c], -gy[r, c]
                        mag = np.sqrt(vx**2 + vy**2)
                        if mag > 0:
                            # Calculate target node based on gradient direction
                            tr = r + int(np.round(vy/mag))
                            tc = c + int(np.round(vx/mag))
                            if 0 <= tr < rows and 0 <= tc < cols:
                                p2 = grid_rows[tr][tc]
                                
                                # Translate to CAD coords
                                x1 = self._safe_v(p1[0] - self.diff_x)
                                y1 = self._safe_v(p1[1] - self.diff_y)
                                x2 = self._safe_v(p2[0] - self.diff_x)
                                y2 = self._safe_v(p2[1] - self.diff_y)
                                
                                msp.add_line((x1, y1), (x2, y2), dxfattribs={'layer': layer_name, 'color': 4}) # Cyan
                                segments_drawn += 1
                                
            from .utils.logger import Logger
            Logger.info(f"Drawn {segments_drawn} hydrological flow segments.")
        except Exception as e:
            from .utils.logger import Logger
            Logger.warn(f"Hydrology simulation skipped (requires numpy): {e}")

    def add_raster_overlay(self, img_path: str, bounds: tuple):
        """
        Embeds a georeferenced raster image (like satellite ortho) into the DXF.
        bounds = (min_x, min_y, max_x, max_y) in project CRS.
        """
        try:
            import os
            # Use absolute path for safety in the DXF file
            abs_path = os.path.abspath(img_path)
            
            # bounds are already in local/project CRS, we need to apply our diff offset
            min_x, min_y, max_x, max_y = bounds
            x = self._safe_v(min_x - self.diff_x)
            y = self._safe_v(min_y - self.diff_y)
            width = self._safe_v(max_x - min_x)
            height = self._safe_v(max_y - min_y)
            
            # Setup layer
            layer_name = 'MDT_IMAGEM_SATELITE'
            if layer_name not in self.doc.layers:
                self.doc.layers.add(name=layer_name, color=252) # Gray shade
                
            msp = self.doc.modelspace()
            
            # ezdxf image insertion
            # The image goes from (x, y) with a 'u_pixel' vector and 'v_pixel' vector defining size/rotation
            from PIL import Image as PILImage
            with PILImage.open(abs_path) as img:
                px_w, px_h = img.size
                
            image_def = self.doc.add_image_def(filename=abs_path, size_in_pixel=(px_w, px_h))
            
            # u_pixel is the width vector (runs along X for no rotation)
            # v_pixel is the height vector (runs along Y)
            # Both need to be scaled by the real-world size divided by pixel size
            u_scale = width / px_w
            v_scale = height / px_h
            
            msp.add_image(
                image_def=image_def,
                insert=(x, y),
                size_in_units=(width, height), # Only supported in newer ezdxf, fallback below if needed
                dxfattribs={
                    'layer': layer_name,
                    'u_pixel': (u_scale, 0, 0),
                    'v_pixel': (0, v_scale, 0)
                }
            )
            
            from .utils.logger import Logger
            Logger.info(f"Raster Overlay embedded on DXF from: {os.path.basename(img_path)}")
        except Exception as e:
            from .utils.logger import Logger
            Logger.error(f"Failed to attach Raster Overlay to DXF: {e}")
                                
        except Exception as e:
            from .utils.logger import Logger
            Logger.error(f"Failed to attach Raster Overlay to DXF: {e}")

    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Delega para LegendBuilder (SRP Refactor P3-C2)."""
        self._legend_builder().add_cartographic_elements(min_x, min_y, max_x, max_y, diff_x, diff_y)

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y, spacing=50.0):
        """Delega para LegendBuilder (SRP Refactor P3-C2)."""
        self._legend_builder().add_coordinate_grid(min_x, min_y, max_x, max_y, diff_x, diff_y, spacing)

    def add_legend(self):
        """Delega para LegendBuilder (SRP Refactor P3-C2)."""
        self._legend_builder().add_legend()

    def add_title_block(self, client="N/A", project="sisTOPOGRAFIA - Engenharia", designer="sisTOPOGRAFIA AI"):
        """Delega para LegendBuilder (SRP Refactor P3-C2)."""
        self._legend_builder().add_title_block(client, project, designer)

    def _legend_builder(self) -> 'LegendBuilder':
        """Instancia LegendBuilder com contexto atual do DXFGenerator."""
        return LegendBuilder(
            msp=self.msp,
            doc=self.doc,
            bounds=self.bounds,
            diff_x=self.diff_x,
            diff_y=self.diff_y,
            safe_v_fn=self._safe_v,
            project_info=self.project_info
        )


    def save(self):
        # Professional finalization
        try:
            self.add_legend()
            self.add_title_block(
                client=self.project_info.get('client', 'CLIENTE PADRÃO'),
                project=self.project_info.get('project', 'BASE TOPOGRÁFICA - sisTOPOGRAFIA')
            )
            self.doc.saveas(self.filename)
            Logger.info(f"DXF saved successfully: {os.path.basename(self.filename)}")
        except Exception as e:
            Logger.error(f"DXF Save Error: {e}")
