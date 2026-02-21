"""
Use Case: ReportOrchestratorUseCase
Responsabilidade única: construir dados do relatório técnico e delegar ao PDF adapter.
DDD — Application Layer.
"""
import geopandas as gpd
from typing import Dict, Optional, List

try:
    from report_generator import generate_report
    from utils.logger import Logger
except ImportError:
    from report_generator import generate_report
    from utils.logger import Logger


class ReportOrchestratorUseCase:
    """
    Coleta estatísticas da área e delega a geração do PDF técnico ao report_generator.
    Não conhece nada sobre DXF ou OSM — apenas estatísticas e localização.
    """

    def __init__(self, output_file: str, project_metadata: Dict, lat: float, lon: float):
        self.output_file = output_file
        self.project_metadata = project_metadata
        self.lat = lat
        self.lon = lon

    # ── Public API ───────────────────────────────────────────────────────────

    def generate(self, gdf: gpd.GeoDataFrame,
                 analytics_res: Optional[Dict] = None,
                 satellite_img: Optional[str] = None) -> None:
        """Gera PDF técnico com dados da análise."""
        try:
            pdf_file = self.output_file.replace('.dxf', '_laudo.pdf')
            report_data = self._build_report_data(gdf, analytics_res, satellite_img)
            generate_report(report_data, pdf_file)
            Logger.info(f"Laudo técnico gerado: {pdf_file}")
        except Exception as e:
            Logger.info(f"Geração do laudo ignorada ou falhou: {e}", "warning")

    # ── Private Helpers ───────────────────────────────────────────────────────

    def _build_report_data(self, gdf: gpd.GeoDataFrame,
                           analytics_res: Optional[Dict],
                           satellite_img: Optional[str]) -> Dict:
        """Constrói dicionário de dados para o relatório."""
        return {
            'project_name': self.project_metadata.get('project', 'BASE TOPOGRÁFICA'),
            'client': self.project_metadata.get('client', 'CLIENTE PADRÃO'),
            'location_label': f"{self.lat}, {self.lon}",
            'satellite_img': satellite_img,
            'stats': {
                'avg_slope': analytics_res['slope_avg'] if analytics_res else 8.4,
                'min_height': self._safe_centroid_stat(gdf, 'z', 'min'),
                'max_height': self._safe_centroid_stat(gdf, 'z', 'max'),
                'total_buildings': int(gdf[gdf['building'].notna()].shape[0]) if 'building' in gdf.columns else 0,
                'total_road_length': float(gdf[gdf['highway'].notna()].geometry.length.sum()) if 'highway' in gdf.columns else 0.0,
                'total_nature': int(gdf[gdf['natural'].notna()].shape[0]) if 'natural' in gdf.columns else 0,
                'total_building_area': float(gdf[gdf['building'].notna()].geometry.area.sum()) if 'building' in gdf.columns else 0.0,
                'avg_solar': float(analytics_res['solar'].mean()) if analytics_res and 'solar' in analytics_res else 0.72,
                'max_flow': float(analytics_res['hydrology'].max()) if analytics_res and 'hydrology' in analytics_res else 0.0,
                'cut_volume': float(analytics_res['earthwork']['cut_volume']) if analytics_res and 'earthwork' in analytics_res else 0.0,
                'fill_volume': float(analytics_res['earthwork']['fill_volume']) if analytics_res and 'earthwork' in analytics_res else 0.0,
            }
        }

    @staticmethod
    def _safe_centroid_stat(gdf: gpd.GeoDataFrame, attr: str, stat: str) -> float:
        """Retorna estatística de centróide de forma segura (evita erro se z ausente)."""
        try:
            centroids = gdf.geometry.centroid
            if hasattr(centroids, attr):
                vals = getattr(centroids, attr)
                return float(vals.min() if stat == 'min' else vals.max())
        except Exception:
            pass
        return 0.0
