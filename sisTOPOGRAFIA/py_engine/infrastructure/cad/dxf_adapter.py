import ezdxf
import os
import numpy as np
import pandas as pd
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point
import geopandas as gpd
import math
from typing import List, Dict, Any, Optional
from ezdxf.enums import TextEntityAlignment

try:
    from ...utils.logger import Logger
    from ...dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from utils.logger import Logger
    from dxf_styles import DXFStyleManager

class DxfAdapter:
    """Infrastructure adapter for DXF generation using ezdxf."""
    
    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new('R2013')
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]
        
        # Setup CAD standards
        DXFStyleManager.setup_all(self.doc)
        
        self.msp = self.doc.modelspace()
        self.project_info = {}
        self._offset_initialized = False
        
        # AppID for BIM Data
        try:
            self.doc.appids.new('SISRUA_BIM')
        except Exception:
            pass

    def add_features(self, gdf):
        """Adds features from a GeoDataFrame to the DXF."""
        if gdf.empty: return
        
        if not self._offset_initialized:
            centroids = gdf.geometry.centroid
            cx = centroids.x.dropna().mean() if not centroids.x.dropna().empty else 0.0
            cy = centroids.y.dropna().mean() if not centroids.y.dropna().empty else 0.0
            self.diff_x = float(cx)
            self.diff_y = float(cy)
            self._offset_initialized = True

        b = gdf.total_bounds
        self.bounds = [float(v) for v in b]

        for _, row in gdf.iterrows():
            geom = row.geometry
            tags = row.drop('geometry')
            # Layer logic could be externalized to a Domain Service later
            layer = self._determine_layer(tags)
            self._draw_geometry(geom, layer, tags)

    def _determine_layer(self, tags):
        """Standard layer mapping for sisTOPOGRAFIA enterprise standards."""
        if 'building' in tags and not pd.isna(tags['building']): return 'sisTOPO_EDIFICACAO'
        if 'highway' in tags and not pd.isna(tags['highway']):
            kind = tags['highway']
            if kind in ['primary', 'secondary', 'tertiary']: return 'sisTOPO_VIAS'
            return 'sisTOPO_VIAS'
        if 'natural' in tags and tags['natural'] == 'tree': return 'sisTOPO_VEGETACAO'
        if 'water' in tags or 'natural' in tags and tags['natural'] == 'water': return 'sisTOPO_HIDROGRAFIA'
        return '0'

    def _draw_geometry(self, geom, layer, tags):
        """Draws complex geometry with BIM metadata."""
        if geom is None or geom.is_empty: return
        
        entity = None
        if isinstance(geom, Point):
            entity = self.msp.add_point((geom.x - self.diff_x, geom.y - self.diff_y, getattr(geom, 'z', 0.0)))
        elif isinstance(geom, LineString):
            entity = self.msp.add_lwpolyline([(p[0] - self.diff_x, p[1] - self.diff_y) for p in geom.coords])
        elif isinstance(geom, Polygon):
            # Outer boundary
            entity = self.msp.add_lwpolyline([(p[0] - self.diff_x, p[1] - self.diff_y) for p in geom.exterior.coords], close=True)
            # Inner holes (optional, simplified for now)
        elif isinstance(geom, MultiPolygon):
            for part in geom.geoms:
                self._draw_geometry(part, layer, tags)
            return
        elif isinstance(geom, MultiLineString):
            for part in geom.geoms:
                self._draw_geometry(part, layer, tags)
            return

        if entity:
            entity.dxf.layer = layer
            self._attach_bim_data(entity, tags)

    def add_contours(self, contours: List[Dict[str, Any]]):
        """Adds contour lines to the DXF with BIM enrichment and automated labeling."""
        for c in contours:
            is_major = c.get('is_major', False)
            layer = 'sisTOPO_CURVAS_NIVEL_MESTRA' if is_major else 'sisTOPO_CURVAS_NIVEL_INTERM'
            pts = [(p[0] - self.diff_x, p[1] - self.diff_y) for p in c['points']]
            
            if len(pts) < 2: continue
            
            entity = self.msp.add_lwpolyline(pts) 
            entity.dxf.layer = layer
            entity.dxf.elevation = float(c['elevation'])
            
            # BIM Metadata for contours
            bim_tags = {
                "type": "Contour",
                "elevation": c['elevation'],
                "major": "Yes" if is_major else "No"
            }
            self._attach_bim_data(entity, bim_tags)
            
            # Automated Labeling for Major Contours
            if is_major and len(pts) > 10:
                # Place label near the middle of the polyline
                mid_idx = len(pts) // 2
                p1 = pts[mid_idx]
                p2 = pts[mid_idx + 1]
                
                # Calculate rotation angle
                angle = math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))
                if angle > 90: angle -= 180
                if angle < -90: angle += 180
                
                self.msp.add_text(
                    f"{c['elevation']:.0f}",
                    dxfattribs={
                        'layer': 'sisTOPO_TOPOGRAFIA_CURVAS_TEXTO',
                        'height': 1.8,
                        'rotation': angle,
                        'style': 'STANDARD'
                    }
                ).set_placement(p1)

    def add_hydrology(self, talvegs: List[List[List[float]]]):
        """Adds natural drainage lines (talwegs) to the DXF."""
        Logger.info(f"Infrastructure: Adding Hydrology ({len(talvegs)} segments)...")
        layer = 'sisTOPO_HIDROGRAFIA'
        for segment in talvegs:
            p1 = (segment[0][0], segment[0][1])
            p2 = (segment[1][0], segment[1][1])
            self.msp.add_line(p1, p2, dxfattribs={'layer': layer, 'color': 5}) # Blue

    def add_utm_grid(self, spacing: float = 100.0):
        """Generates a UTM coordinate grid with crosshairs and labels."""
        Logger.info(f"Infrastructure: Generating UTM Grid (spacing={spacing}m)...")
        
        # Determine grid bounds aligned to spacing
        min_x = math.floor(self.bounds[0] / spacing) * spacing
        max_x = math.ceil(self.bounds[2] / spacing) * spacing
        min_y = math.floor(self.bounds[1] / spacing) * spacing
        max_y = math.ceil(self.bounds[3] / spacing) * spacing
        
        layer_grid = 'sisTOPO_MALHA_COORD'
        layer_text = 'sisTOPO_TEXTO'
        
        for x in np.arange(min_x, max_x + spacing, spacing):
            for y in np.arange(min_y, max_y + spacing, spacing):
                # Draw small crosshair
                lx = x - self.diff_x
                ly = y - self.diff_y
                size = spacing * 0.05
                self.msp.add_line((lx - size, ly), (lx + size, ly), dxfattribs={'layer': layer_grid})
                self.msp.add_line((lx, ly - size), (lx, ly + size), dxfattribs={'layer': layer_grid})
                
                # Add coordinate text at grid intersections
                self.msp.add_text(
                    f"{x:.0f}, {y:.0f}",
                    dxfattribs={
                        'layer': layer_text,
                        'height': spacing * 0.08,
                        'style': 'STANDARD'
                    }
                ).set_placement((lx + size, ly + size))

    def add_technical_stamp(self, metadata: Dict[str, Any]):
        """Adds a professional engineering stamp/legend to the drawing."""
        lx = self.bounds[0] - self.diff_x
        ly = self.bounds[1] - self.diff_y
        
        self.msp.add_text(
            f"PROJETO: {metadata.get('project', 'sisTOPOGRAFIA_GEN_001')}",
            dxfattribs={'layer': 'sisTOPO_QUADRO', 'height': 2.5}
        ).set_placement((lx, ly - 10))
        
        self.msp.add_text(
            f"COORDENADA CENTRAL: {self.diff_x:.2f}, {self.diff_y:.2f}",
            dxfattribs={'layer': 'sisTOPO_QUADRO', 'height': 2.0}
        ).set_placement((lx, ly - 15))

    def _attach_bim_data(self, entity, tags):
        """XDATA attachment for Half-way BIM."""
        xdata = []
        for k, v in tags.items():
            if pd.isna(v) or k == 'geometry': continue
            val_str = str(v)
            xdata.append((1000, f"{k}={val_str}"[:240]))
        if xdata:
            entity.set_xdata('SISRUA_BIM', xdata)

    def save(self):
        self.doc.saveas(self.filename)
        Logger.info(f"Infrastructure: DXF Saved to {self.filename}")
