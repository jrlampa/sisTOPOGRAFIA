import numpy as np
import os
import json
from typing import Dict, Any, List

try:
    from ...domain.services.analytics import AnalyticsService
    from ...domain.services.contours import ContourService
    from ...domain.services.hydrology import HydrologyService
    from ...infrastructure.external_api.osm_api import OsmApiAdapter
    from ...infrastructure.external_api.elevation_api import ElevationApiAdapter
    from ...infrastructure.cad.dxf_adapter import DxfAdapter
    from ...infrastructure.pdf.pdf_adapter import PdfAdapter
    from ...infrastructure.external_api.heatmap_exporter import HeatmapExporter
    from ...infrastructure.external_api.groq_adapter import GroqAdapter
    from ...application.use_cases.suggestive_design import SuggestiveDesignUseCase
    from ...application.use_cases.economic_analysis import EconomicAnalysisUseCase
    from ...utils.logger import Logger
except (ImportError, ValueError):
    from domain.services.analytics import AnalyticsService
    from domain.services.contours import ContourService
    from domain.services.hydrology import HydrologyService
    from infrastructure.external_api.osm_api import OsmApiAdapter
    from infrastructure.external_api.elevation_api import ElevationApiAdapter
    from infrastructure.cad.dxf_adapter import DxfAdapter
    from infrastructure.pdf.pdf_adapter import PdfAdapter
    from infrastructure.external_api.heatmap_exporter import HeatmapExporter
    from infrastructure.external_api.groq_adapter import GroqAdapter
    from application.use_cases.suggestive_design import SuggestiveDesignUseCase
    from application.use_cases.economic_analysis import EconomicAnalysisUseCase
    from utils.logger import Logger

class SpatialAuditUseCase:
    """Application use case for performing a full topographical audit."""
    
    def __init__(self):
        self.osm_adapter = OsmApiAdapter()
        self.elevation_adapter = ElevationApiAdapter()
        self.analytics_service = AnalyticsService()
        self.contour_service = ContourService()
        self.economic_service = EconomicAnalysisUseCase()

    def execute(self, lat: float, lon: float, radius: float, output_file: str, metadata: dict):
        """Orchestrates the full audit process."""
        Logger.info(f"UseCase: Starting Spatial Audit at ({lat}, {lon})")
        
        # 1. Infrastructure: Fetch Data
        gdf = self.osm_adapter.fetch_data(lat, lon, radius)
        if gdf.empty:
            Logger.error("UseCase: No data found.")
            return False
            
        grid = self.elevation_adapter.fetch_grid(lat, lon, radius)
        z_grid = np.array([[p[2] for p in row] for row in grid])
        
        # 2. Domain: Calculate Analytics
        dx = (radius * 2) / (z_grid.shape[1] - 1)
        dy = (radius * 2) / (z_grid.shape[0] - 1)
        
        analytics = self.analytics_service.calculate_slope_grid(z_grid, dx, dy)
        # Store metadata in analytics for other services
        analytics['dx'] = dx
        analytics['dy'] = dy
        analytics['z_grid'] = z_grid
        
        contours = self.contour_service.generate_contours(z_grid, dx, dy)
        
        # 3. Infrastructure: DXF Generation (Engineering Phase)
        dxf = DxfAdapter(output_file, center=(lat, lon))
        
        # Hydrological Mapping
        try:
            talvegs = HydrologyService.extract_talwegs(analytics['z_grid'], analytics['dx'], analytics['dy'])
            dxf.add_hydrology(talvegs)
        except Exception as e:
            Logger.warn(f"Domain: Hydrology extraction failed: {str(e)}")
            
        # Standard Topo Layers
        dxf.add_contours(contours)
        
        # Professional Utility: UTM Grid and Stamp
        dxf.add_utm_grid(spacing=100.0)
        dxf.add_technical_stamp(metadata)
        
        # Add OSM Layers
        layers_config = metadata.get('layers', {})
        # Group features by type (buildings, roads, etc.)
        for lyr in ['buildings', 'roads', 'nature', 'curbs', 'terrain']:
            if layers_config.get(lyr, True):
                # Filter gdf by type if possible, or just add the whole thing to a default layer
                # For now, we use a simple approach: add all to a technical layer
                dxf.add_osm_layer(lyr, gdf)
        
        dxf.save()
        
        # 4. Professional Utility: CSV Profile Export
        csv_path = output_file.replace('.dxf', '_perfil_longitudinal.csv')
        try:
            mid_row = analytics['z_grid'][analytics['z_grid'].shape[0]//2, :]
            np.savetxt(csv_path, mid_row, delimiter=',', header='elevation_m', comments='')
            Logger.info(f"Infrastructure: Profile CSV saved to {os.path.basename(csv_path)}")
        except Exception as e:
            Logger.warn(f"Infrastructure: CSV Export failed: {str(e)}")

        # 5. Domain: Economic Analysis
        economics = self.economic_service.execute(analytics)
        
        # 6. Infrastructure: PDF Report
        report_data = {
            'project_name': metadata.get('project', 'BASE'),
            'stats': analytics,
            'economics': economics,
            'client': metadata.get('client', 'CLIENTE'),
            'location_label': f"{lat}, {lon}"
        }
        pdf = PdfAdapter()
        pdf.generate(report_data, output_file.replace('.dxf', '_laudo.pdf'))
        
        # 7. Infrastructure: Web Heatmaps & Economic JSON
        heatmap_exporter = HeatmapExporter()
        slope_heatmap = heatmap_exporter.export_to_json(analytics['slope_pct'], lat, lon, radius)
        solar_heatmap = heatmap_exporter.export_to_json(analytics['solar'], lat, lon, radius)
        
        heatmap_payload = {'slope': slope_heatmap, 'solar': solar_heatmap}
        heatmap_path = output_file.replace('.dxf', '.heatmap.json')
        with open(heatmap_path, 'w') as f:
            json.dump(heatmap_payload, f)
            
        econ_path = output_file.replace('.dxf', '.economics.json')
        with open(econ_path, 'w') as f:
            json.dump(economics, f)

        # 8. Infrastructure: AI Suggestive Design
        if metadata.get('enable_ai', True):
            try:
                api_key = os.getenv("GROQ_API_KEY")
                if api_key:
                    groq = GroqAdapter(api_key=api_key)
                    ai_use_case = SuggestiveDesignUseCase(groq)
                    ai_report = ai_use_case.execute(analytics, context=metadata.get('project', ''))
                    ai_path = output_file.replace('.dxf', '_ia_design.md')
                    with open(ai_path, 'w', encoding='utf-8') as f:
                        f.write(ai_report)
            except Exception as e:
                Logger.warn(f"Infrastructure: AI Suggestion failed: {str(e)}")

        return True
