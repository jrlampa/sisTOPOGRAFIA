"""
Use Case: EnvironmentalExtractorUseCase
Responsabilidade única: extrair restrições ambientais AS IS (APP, uso do solo, UCs).
DDD — Application Layer.
"""
import numpy as np
import pandas as pd
import geopandas as gpd
from typing import Dict, Tuple

try:
    from domain.services.environmental_engine import EnvironmentalEngine
    from utils.logger import Logger
except ImportError:  # pragma: no cover
    from domain.services.environmental_engine import EnvironmentalEngine
    from utils.logger import Logger


class EnvironmentalExtractorUseCase:
    """
    Extrai Áreas de Preservação Permanente (APP), uso do solo
    e Unidades de Conservação (UC) para uma determinada área.
    """

    def __init__(self, lat: float, lon: float, radius: float):
        self.lat = lat
        self.lon = lon
        self.radius = radius

    # ── Public API ───────────────────────────────────────────────────────────

    def extract(self, gdf: gpd.GeoDataFrame) -> Dict:
        """
        Executa extração completa: APP + Uso do Solo + UCs.

        Returns:
            dict com chaves: app_gdf, landuse_gdf, uc_gdf, uc_metadata
        """
        Logger.info("Extração AS IS: APP / Uso do Solo / UCs (Fases 9-10)...")

        app_gdf = EnvironmentalEngine.extract_and_buffer_waterways(gdf)
        landuse_gdf = EnvironmentalEngine.extract_land_use(gdf)

        bounds = self._resolve_bounds(gdf)
        uc_res = EnvironmentalEngine.process_all_conservation_units(
            bounds[0], bounds[1], bounds[2], bounds[3]
        )

        return {
            'app_gdf': app_gdf,
            'landuse_gdf': landuse_gdf,
            'uc_gdf': uc_res.get('combined_gdf', gpd.GeoDataFrame()),
            'uc_metadata': uc_res.get('metadata', {})
        }

    # ── Private Helpers ───────────────────────────────────────────────────────

    def _resolve_bounds(self, gdf: gpd.GeoDataFrame) -> Tuple[float, float, float, float]:
        """Resolve bounding box da área — fallback para raio se bounds inválidos."""
        bounds = gdf.total_bounds
        if any(pd.isna(b) or np.isinf(b) for b in bounds):
            buffer_deg = self.radius / 111320.0
            return (
                self.lon - buffer_deg,
                self.lat - buffer_deg,
                self.lon + buffer_deg,
                self.lat + buffer_deg
            )
        return tuple(bounds)
