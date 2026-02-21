import ezdxf
import os
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
import geopandas as gpd
import math
from scipy.spatial import Delaunay
try:  # pragma: no cover
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):  # pragma: no cover
    from dxf_styles import DXFStyleManager
from ezdxf.enums import TextEntityAlignment
try:  # pragma: no cover
    from .utils.logger import Logger
except (ImportError, ValueError):  # pragma: no cover
    from utils.logger import Logger

# ── Módulos SRP ───────────────────────────────────────────────────────────────
try:  # pragma: no cover
    from .layer_classifier import classify_layer
    from .bim_data_attacher import attach_bim_data
    from .legend_builder import LegendBuilder
    from .dxf_geometry_drawer import DXFGeometryDrawer
    from .dxf_terrain_drawer import DXFTerrainDrawer
except (ImportError, ValueError):  # pragma: no cover
    from layer_classifier import classify_layer
    from bim_data_attacher import attach_bim_data
    from legend_builder import LegendBuilder
    from dxf_geometry_drawer import DXFGeometryDrawer
    from dxf_terrain_drawer import DXFTerrainDrawer

class DXFGenerator:
    def __init__(self, filename, layers_config=None):
        self.filename = filename
        self.doc = ezdxf.new('R2013')
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]  # Standard bounding box
        
        # Setup CAD standards via StyleManager (SRP Refactor)
        # Filters layers based on layers_config if provided
        DXFStyleManager.setup_all(self.doc, layers_config)
        
        self.msp = self.doc.modelspace()
        self.project_info = {} # Store metadata for title block
        self._offset_initialized = False

        # Half-way BIM AppID Registration
        try:
            self.doc.appids.new('SISRUA_BIM')
        except Exception:  # pragma: no cover
            pass # Already exists

        # SRP: Geometry drawing delegated to DXFGeometryDrawer
        self._geom_drawer = DXFGeometryDrawer(
            msp=self.msp,
            doc=self.doc,
            safe_v_fn=self._safe_v,
            safe_p_fn=self._safe_p,
            validate_points_fn=self._validate_points,
        )

        # SRP: Terrain drawing delegated to DXFTerrainDrawer
        self._terrain_drawer = DXFTerrainDrawer(
            msp=self.msp,
            doc=self.doc,
            safe_v_fn=self._safe_v,
            validate_points_fn=self._validate_points,
            diff_x_getter=lambda: self.diff_x,
            diff_y_getter=lambda: self.diff_y,
        )

    def _add_bim_data(self, entity, tags):  # pragma: no cover
        """Delega para bim_data_attacher (SRP Refactor P3-C2) — não chamado diretamente em testes."""
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
                if None in vals:  # pragma: no cover  # _safe_v(v, None) always returns 0.0, never None
                    continue
                curr_p = tuple(vals)
                if curr_p != last_p:
                    valid_points.append(curr_p)
                    last_p = curr_p
            except (ValueError, TypeError, IndexError) as e:  # pragma: no cover
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
        """Delega para DXFGeometryDrawer (SRP)."""
        self._geom_drawer.draw(geom, layer, diff_x, diff_y, tags)

    def _draw_street_offsets(self, line, tags, diff_x, diff_y):
        """Delega para DXFGeometryDrawer (SRP)."""
        self._geom_drawer._draw_street_offsets(line, tags, diff_x, diff_y)

    def _get_thickness(self, tags, layer) -> float:
        """Delega para DXFGeometryDrawer.get_thickness (SRP)."""
        return DXFGeometryDrawer.get_thickness(tags, layer)

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        """Delega para DXFGeometryDrawer (SRP)."""
        self._geom_drawer._draw_polygon(poly, layer, diff_x, diff_y, tags)

    def _draw_linestring(self, line, layer, diff_x, diff_y, tags):
        """Delega para DXFGeometryDrawer (SRP)."""
        self._geom_drawer._draw_linestring(line, layer, diff_x, diff_y, tags)

    def _sanitize_attribs(self, attribs: dict) -> dict:
        """Delega para DXFGeometryDrawer (SRP)."""
        return DXFGeometryDrawer._sanitize_attribs(attribs)

    def _draw_point(self, point, layer, diff_x, diff_y, tags):
        """Delega para DXFGeometryDrawer (SRP)."""
        self._geom_drawer._draw_point(point, layer, diff_x, diff_y, tags)

    def add_terrain_from_grid(self, grid_rows, generate_tin=True):
        """Delega para DXFTerrainDrawer (SRP)."""
        self._terrain_drawer.add_terrain_from_grid(grid_rows, generate_tin)

    def add_tin_mesh(self, grid_rows):
        """Delega para DXFTerrainDrawer (SRP)."""
        self._terrain_drawer.add_tin_mesh(grid_rows)

    def add_slope_hatch(self, grid_rows, analytics):
        """Delega para DXFTerrainDrawer (SRP)."""
        self._terrain_drawer.add_slope_hatch(grid_rows, analytics)

    def add_contour_lines(self, contour_lines, interval=1.0):
        """Delega para DXFTerrainDrawer (SRP)."""
        self._terrain_drawer.add_contour_lines(contour_lines, interval)

    def add_hydrology(self, grid_rows):
        """Delega para DXFTerrainDrawer (SRP)."""
        self._terrain_drawer.add_hydrology(grid_rows)

    def add_raster_overlay(self, img_path: str, bounds: tuple):
        """Delega para DXFTerrainDrawer (SRP)."""
        self._terrain_drawer.add_raster_overlay(img_path, bounds)

    def add_cartographic_elements(self, min_x, min_y, max_x, max_y, diff_x, diff_y):
        """Delega para LegendBuilder (SRP Refactor P3-C2)."""
        self._legend_builder().add_cartographic_elements(min_x, min_y, max_x, max_y, diff_x, diff_y)

    def add_coordinate_grid(self, min_x, min_y, max_x, max_y, diff_x, diff_y, spacing=50.0):
        """Delega para LegendBuilder (SRP Refactor P3-C2)."""
        self._legend_builder().add_coordinate_grid(min_x, min_y, max_x, max_y, diff_x, diff_y, spacing)

    def add_legend(self):
        """Delega para LegendBuilder (SRP Refactor P3-C2)."""
        self._legend_builder().add_legend()

    def add_title_block(self, client="N/A", project="sisTOPOGRAFIA - Engenharia", designer="Jonatas Lampa (RT)", paper_size="A3"):
        """Delega para LegendBuilder com suporte a paper_size."""
        self._legend_builder().add_title_block(client, project, designer, paper_size)

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
            paper_size = self.project_info.get('paper_size', 'A3')
            self.add_title_block(
                client=self.project_info.get('client', 'CLIENTE PADRÃO'),
                project=self.project_info.get('project', 'BASE TOPOGRÁFICA - sisTOPOGRAFIA'),
                designer="Jonatas Lampa (RT)",
                paper_size=paper_size
            )
            self.doc.saveas(self.filename)
            Logger.info(f"DXF ({paper_size}) saved successfully: {os.path.basename(self.filename)}")
            
            # Auto-generate Memorial if area is available
            if self.project_info.get('total_area'):
                self._save_memorial()
        except Exception as e:  # pragma: no cover
            Logger.error(f"DXF Save Error: {e}")
    def _save_memorial(self):
        """Helper to save memorial text file alongside DXF."""
        try:
            try:
                from .memorial_engine import MemorialEngine
            except (ImportError, ValueError):
                from memorial_engine import MemorialEngine
            # We would need coordinates here. For now, use fallback or mock vertices if available
            # In a real scenario, we extract vertices from the main boundary polygon
            vertices = self.project_info.get('vertices', [])
            memorial_text = MemorialEngine.generate_memorial(self.project_info, vertices)
            mem_path = self.filename.replace('.dxf', '_MEMORIAL.txt')
            with open(mem_path, 'w', encoding='utf-8') as f:
                f.write(memorial_text)
            Logger.info(f"Memorial Descritivo gerado em: {os.path.basename(mem_path)}")
        except Exception as e:
            Logger.warn(f"Falha ao gerar memorial: {e}")

    def add_geodetic_marker(self, lat, lon, alt, label):
        """Adiciona um bloco de marco geodésico no ModelSpace."""
        from utils.geo import wgs84_to_utm
        try:
            # Converter para UTM (SIRGAS 2000)
            east, north = wgs84_to_utm(lat, lon)
            # Aplicar offset local da planta
            lx = self._safe_v(east - self.diff_x)
            ly = self._safe_v(north - self.diff_y)
            lz = self._safe_v(alt)

            # Inserir bloco
            self.msp.add_blockref('sisTOPO_MARCO_GEODESICO', (lx, ly), dxfattribs={
                'layer': 'sisTOPO_PONTOS_COORD',
                'color': 1
            })
            
            # Adicionar texto ID e Cota
            self.msp.add_text(f"{label} (H={lz:.3f}m)",
                              dxfattribs={'layer': 'sisTOPO_PONTOS_TEXTO', 'height': 0.8, 'color': 1}
                             ).set_placement((lx + 1, ly + 1))
        except Exception as e:
            Logger.warn(f"Erro ao adicionar marco {label}: {e}")
