import os
import json
import pandas as pd
import osmnx as ox
from shapely.geometry import Point
import numpy as np
from pyproj import Transformer

from osmnx_client import fetch_osm_data
from dxf_generator import DXFGenerator
from spatial_audit import run_spatial_audit
from elevation_client import fetch_elevation_grid
from contour_generator import generate_contours
from analytics_engine import AnalyticsEngine
try:
    from .report_generator import generate_report
    from .utils.logger import Logger
    from .utils.geo import sirgas2000_utm_epsg
except (ImportError, ValueError):
    from report_generator import generate_report
    from utils.logger import Logger
    from utils.geo import sirgas2000_utm_epsg

class OSMController:
    def __init__(self, lat, lon, radius, output_file, layers_config, crs, export_format='dxf', selection_mode='circle', polygon=None):
        self.lat = lat
        self.lon = lon
        self.radius = radius
        self.output_file = output_file
        self.layers_config = layers_config
        self.crs = crs
        self.export_format = export_format.lower()
        self.selection_mode = selection_mode
        self.polygon = polygon
        self.project_metadata = {
            'client': 'CLIENTE PADRÃO',
            'project': 'EXTRACAO ESPACIAL'
        }
        self.audit_summary = {"violations": 0, "coverageScore": 0}
        self.analytics_res = None
        self.grid_rows = []

    def run(self):
        """Orchestrates the Osm2Dxf flow."""
        Logger.info(f"OSM Audit & Export Starting (Format: {self.export_format})", progress=5)
        
        # 1. Prepare Layers
        tags = self._build_tags()
        if not tags:
            Logger.error("No infrastructure layers selected!")
            return

        # 2. Fetch Features
        Logger.info("Step 1/5: Fetching OSM features...", progress=10)
        gdf = self._fetch_features(tags)
        if gdf is None or gdf.empty:
            Logger.info("No architectural features found in radius.", "warning")
            return

        # 3. Spatial GIS Audit (Authoritative Logic)
        Logger.info("Step 2/5: Running spatial audit...", progress=30)
        analysis_gdf = self._run_audit(gdf)

        # 4. Preview Data (GeoJSON)
        self._send_geojson_preview(gdf, analysis_gdf)

        # 5. Coordinate Offset & CAD Export
        # AUTHORITATIVE FIX: Check if we want Georeferenced (Absolute) or Localized (0,0)
        use_georef = self.layers_config.get('georef', True)
        
        Logger.info(f"Step 3/5: Initializing DXF Generation (Georef: {use_georef})...", progress=50)
        dxf_gen = DXFGenerator(self.output_file)
        
        if use_georef:
            dxf_gen.diff_x = 0.0
            dxf_gen.diff_y = 0.0
            dxf_gen._offset_initialized = True
            
        dxf_gen.add_features(gdf) # Features set the offset ONLY if not initialized above

        # 6. Terrain & Contours (Optional)
        if self.layers_config.get('terrain', False):
            self._process_terrain(gdf, dxf_gen)

        # 6a. Post-process Analytics (Phase 2: Dominância de Mercado)
        # We enrich BEFORE final saving so XDATA includes analytics
        if self.analytics_res:
            self._enrich_with_analytics(gdf)


        # 7. Cartographic Elements
        if dxf_gen.bounds is not None:
            self._add_cad_essentials(dxf_gen)
            
        # 7a. Satellite Imagery (Raster Overlay)
        if self.layers_config.get('satellite', False):
            self._add_satellite_overlay(dxf_gen)

        # 8. Save & Cleanup
        Logger.info("Step 5/5: Finalizing export package...", progress=90)
        dxf_gen.save()
        self._export_csv_metadata(gdf)
        
        # 9. Technical Report (PDF)
        try:
            pdf_file = self.output_file.replace('.dxf', '_laudo.pdf')
            report_data = {
                'project_name': self.project_metadata.get('project', 'BASE TOPOGRÁFICA'),
                'client': self.project_metadata.get('client', 'CLIENTE PADRÃO'),
                'location_label': f"{self.lat}, {self.lon}",
                'satellite_img': getattr(self, 'satellite_cache_path', None),
                'stats': {
                    'avg_slope': self.analytics_res['slope_avg'] if self.analytics_res else 8.4,
                    'min_height': float(gdf.geometry.centroid.z.min()) if 'z' in gdf.geometry.centroid else 0.0,
                    'max_height': float(gdf.geometry.centroid.z.max()) if 'z' in gdf.geometry.centroid else 0.0,
                    'total_buildings': int(gdf[gdf['building'].notna()].shape[0]) if 'building' in gdf else 0,
                    'total_road_length': float(gdf[gdf['highway'].notna()].geometry.length.sum()) if 'highway' in gdf else 0,
                    'total_nature': int(gdf[gdf['natural'].notna()].shape[0]) if 'natural' in gdf else 0,
                    'total_building_area': float(gdf[gdf['building'].notna()].geometry.area.sum()) if 'building' in gdf else 0,
                    'avg_solar': float(self.analytics_res['solar'].mean()) if self.analytics_res else 0.72,
                    'max_flow': float(self.analytics_res['hydrology'].max()) if self.analytics_res else 0.0,
                    'cut_volume': float(self.analytics_res['earthwork']['cut_volume']) if self.analytics_res else 0.0,
                    'fill_volume': float(self.analytics_res['earthwork']['fill_volume']) if self.analytics_res else 0.0
                }
            }
            generate_report(report_data, pdf_file)
        except Exception as re:
            Logger.info(f"Report generation skipped or failed: {re}", "warning")

        Logger.success(f"Audit Complete: Generated {self.output_file}")

    def _fetch_features(self, tags):
        try:
            if self.selection_mode == 'polygon':
                 return fetch_osm_data(self.lat, self.lon, self.radius, tags, crs=self.crs, polygon=self.polygon)
            return fetch_osm_data(self.lat, self.lon, self.radius, tags, crs=self.crs)
        except Exception as e:
            Logger.error(f"OSM Fetch Error: {str(e)}")
            return None

    def _run_audit(self, gdf):
        """Runs spatial analysis on the fetched features."""
        # 1. Determine Target CRS (EPSG)
        target_epsg = self.crs
        if self.crs == 'auto':
            # Use centroid of the data to find the best SIRGAS 2000 UTM zone
            centroid = gdf.geometry.centroid
            avg_lat = centroid.y.mean()
            avg_lon = centroid.x.mean()
            target_epsg = f"EPSG:{sirgas2000_utm_epsg(avg_lat, avg_lon)}"
            Logger.info(f"Auto-selected CRS: {target_epsg} (SIRGAS 2000 UTM)")
        try:
            audit_summary, analysis_gdf = run_spatial_audit(gdf)
            self.audit_summary = audit_summary
            Logger.info(f"Spatial Audit: {audit_summary['violations']} violations detected.")
            return analysis_gdf
        except Exception as se:
            Logger.error(f"Spatial Audit internal failure: {se}")
            return None

    def _enrich_with_analytics(self, gdf):
        """Enriches feature GeoDataFrame with interpolated analytics data."""
        if not self.analytics_res or not self.grid_rows: return
        
        Logger.info("Enriching features with Enterprise BIM Metrics (Hydrology/Solar/Terrain)...")
        
        # 1. Slope Calculation
        def get_slope(geom):
            if geom is None or geom.is_empty: return 0.0
            return AnalyticsEngine.interpolate_point_slope(geom.centroid, self.grid_rows, self.analytics_res)
            
        # 2. Aspect (Orientation) Calculation
        def get_aspect(geom):
            if geom is None or geom.is_empty: return 0.0
            aspect_grid = self.analytics_res['aspect']
            return AnalyticsEngine.interpolate_point_value(geom.centroid, self.grid_rows, aspect_grid)
            
        # 3. Hydrology (Flow Accumulation)
        def get_hydrology(geom):
            if geom is None or geom.is_empty: return 0.0
            hydrology_grid = self.analytics_res['hydrology']
            return AnalyticsEngine.interpolate_point_value(geom.centroid, self.grid_rows, hydrology_grid)
            
        # 4. Solar Potential
        def get_solar(geom):
            if geom is None or geom.is_empty: return 0.0
            solar_grid = self.analytics_res['solar']
            return AnalyticsEngine.interpolate_point_value(geom.centroid, self.grid_rows, solar_grid)
            
        # Apply Metrics
        gdf['declividade_pct'] = gdf.geometry.apply(get_slope)
        gdf['orientacao_deg'] = gdf.geometry.apply(get_aspect)
        gdf['fluxo_acumulado'] = gdf.geometry.apply(get_hydrology)
        gdf['potencial_solar'] = gdf.geometry.apply(get_solar)

    def _process_terrain(self, gdf, dxf_gen):
        try:
            # AUTHORITATIVE FIX: Convert project-space bounds to Lat/Lon for elevation API
            gdf_4326 = gdf.to_crs(epsg=4326)
            b = gdf_4326.total_bounds
            north, south, east, west = b[3], b[1], b[2], b[0]
            
            # Resolution-aware expansion
            margin = 0.0005 # Degrees
            elev_points, rows, cols = fetch_elevation_grid(north + margin, south - margin, east + margin, west - margin, resolution=100) 
            
            if elev_points:
                Logger.info(f"Reconstructing {rows}x{cols} terrain grid...", progress=60)
                transformer = Transformer.from_crs("EPSG:4326", gdf.crs, always_xy=True)
                
                grid_rows = []
                current_row = []
                for lat, lon, z in elev_points:
                    x, y = transformer.transform(lon, lat)
                    current_row.append((x, y, z))
                    if len(current_row) >= cols:
                        grid_rows.append(current_row)
                        current_row = []
                
                if current_row: grid_rows.append(current_row)
                
                self.grid_rows = grid_rows # Store for enrichment
                # Dynamic Analytics (Phase 2 & 3)
                self.analytics_res = AnalyticsEngine.calculate_slope_grid(grid_rows)
                if self.analytics_res:
                    Logger.info(f"Geomorphometry Calculated: Avg Slope {self.analytics_res['slope_avg']:.1f}%")

                dxf_gen.add_terrain_from_grid(grid_rows)
                
                # Contours
                if self.layers_config.get('contours', False):
                    self._add_contours(grid_rows, dxf_gen)
                    
                # Hydrology 
                if self.layers_config.get('hydrology', False):
                    dxf_gen.add_hydrology(grid_rows)
                    
                # Profile CSV Export
                try:
                    import numpy as np
                    mid_idx = len(grid_rows) // 2
                    mid_row = [p[2] for p in grid_rows[mid_idx]]
                    csv_path = self.output_file.replace('.dxf', '_perfil_longitudinal.csv')
                    np.savetxt(csv_path, mid_row, delimiter=',', header='elevation_m', comments='')
                except Exception as e:
                    Logger.warn(f"Profile CSV export failed: {e}")
                    
        except Exception as e:
            Logger.error(f"Terrain submodule failure: {str(e)}")

    def _add_contours(self, grid_rows, dxf_gen):
        try:
            interval = 1.0 if not self.layers_config.get('high_res_contours') else 0.5
            contours = generate_contours(grid_rows, interval=interval)
            if contours:
                dxf_gen.add_contour_lines(contours)
                Logger.info(f"Integrated {len(contours)} contour lines.")
        except Exception as ce:
            Logger.error(f"Contour math error: {ce}")

    def _add_cad_essentials(self, dxf_gen):
        min_x, min_y, max_x, max_y = dxf_gen.bounds
        dxf_gen.add_coordinate_grid(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
        dxf_gen.add_cartographic_elements(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
        
    def _add_satellite_overlay(self, dxf_gen):
        """Fetches Google Maps Static Satellite Image and embeds it as a Raster in the DXF."""
        try:
            from infrastructure.external_api.google_maps_static import GoogleMapsStaticAPI
            import math
            import os
            
            # Simple zoom calculation based on radius (Google Maps zoom levels 14 to 20)
            zoom = 18
            if self.radius > 800: zoom = 15
            elif self.radius > 400: zoom = 16
            elif self.radius > 200: zoom = 17
            elif self.radius < 50: zoom = 19
            
            # Fetch using Google Web Mercator to get the image
            img_path = GoogleMapsStaticAPI.fetch_satellite_image(self.lat, self.lon, zoom=zoom, scale=2)
            
            if img_path and os.path.exists(img_path):
                # The bounds for the raster overlay need to roughly match the captured geographic box
                # For simplicity, we stretch the image over the entire requested radius bounds
                bounds = dxf_gen.bounds
                if bounds:
                    dxf_gen.add_raster_overlay(img_path, bounds)
                    # Keep a reference to attach to PDF later
                    self.satellite_cache_path = img_path
                    
        except ImportError:
            Logger.warn("Google Maps Static API module not found. Skipping overlay.")
        except Exception as e:
            Logger.error(f"Failed to integrate satellite overlay: {e}")

    def _export_csv_metadata(self, gdf):
        try:
            csv_file = self.output_file.replace('.dxf', '_metadata.csv')
            df = gdf.copy()
            df['area_m2'] = df.geometry.area
            df['length_m'] = df.geometry.length
            df_csv = pd.DataFrame(df.drop(columns='geometry'))
            df_csv.to_csv(csv_file, index=False)
            Logger.info(f"Metadata exported to {os.path.basename(csv_file)}")
        except Exception as e:
            Logger.error(f"CSV Metadata Export failed: {e}")

    def _build_tags(self):
        tags = {}
        if self.layers_config.get('buildings', True): tags['building'] = True
        if self.layers_config.get('roads', True): tags['highway'] = True
        if self.layers_config.get('nature', True):
            tags['natural'] = ['tree', 'wood', 'scrub', 'water']
            tags['landuse'] = ['forest', 'grass', 'park']
        if self.layers_config.get('furniture', False):
            tags['amenity'] = ['bench', 'waste_basket', 'bicycle_parking', 'fountain', 'bus_station']
            tags['highway'] = ['street_lamp']
        return tags

    def _send_geojson_preview(self, gdf, analysis_gdf=None):
        if Logger.SKIP_GEOJSON: return
        try:
            preview_gdf = gdf.copy()
            preview_gdf['area'] = preview_gdf.geometry.area
            preview_gdf['length'] = preview_gdf.geometry.length
            def get_type(row):
                if row.get('building'): return 'building'
                if row.get('highway'): return 'highway'
                return 'other'
            preview_gdf['feature_type'] = preview_gdf.apply(get_type, axis=1)
            gdf_wgs84 = preview_gdf.to_crs(epsg=4326)
            payload = json.loads(gdf_wgs84.to_json())
            if analysis_gdf is not None and not analysis_gdf.empty:
                analysis_wgs84 = analysis_gdf.to_crs(epsg=4326)
                analysis_json = json.loads(analysis_wgs84.to_json())
                for f in analysis_json['features']: f['properties']['is_analysis'] = True
                payload['features'].extend(analysis_json['features'])
            payload['audit_summary'] = self.audit_summary
            Logger.geojson(payload)
        except Exception as e:
            Logger.error(f"GeoJSON Sync Error: {str(e)}")
