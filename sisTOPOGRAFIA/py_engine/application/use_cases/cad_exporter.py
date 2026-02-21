"""
Use Case: CadExporterUseCase
Responsabilidade única: adicionar layers de features ao DXFGenerator,
emitir overlay de satélite e exportar metadados CSV.
DDD — Application Layer.
"""
import os
import pandas as pd
import geopandas as gpd
from typing import Dict, List

try:
    from dxf_generator import DXFGenerator
    from utils.logger import Logger
except ImportError:  # pragma: no cover
    from dxf_generator import DXFGenerator
    from utils.logger import Logger


class CadExporterUseCase:
    """
    Gerencia a escrita no DXFGenerator: features OSM, features ambientais,
    elementos cartográficos, overlay de satélite e metadados CSV.
    """

    def __init__(self, output_file: str, lat: float, lon: float, layers_config: Dict):
        self.output_file = output_file
        self.lat = lat
        self.lon = lon
        self.layers_config = layers_config
        self.satellite_cache_path: str | None = None

    # ── Public API ───────────────────────────────────────────────────────────

    def initialize_dxf(self, use_georef: bool = True) -> DXFGenerator:
        """Cria e configura o DXFGenerator."""
        gen = DXFGenerator(self.output_file, layers_config=self.layers_config)
        if use_georef:
            gen.diff_x = 0.0
            gen.diff_y = 0.0
            gen._offset_initialized = True
        return gen

    def add_environmental_layers(self, dxf_gen: DXFGenerator,
                                  app_gdf: gpd.GeoDataFrame,
                                  landuse_gdf: gpd.GeoDataFrame,
                                  uc_gdf: gpd.GeoDataFrame) -> None:
        """Adiciona camadas AS IS ambientais ao DXF."""
        for label, layer_gdf in [
            ("APP", app_gdf), ("Uso do solo", landuse_gdf), ("UCs", uc_gdf)
        ]:
            if layer_gdf is not None and not layer_gdf.empty:
                dxf_gen.add_features(layer_gdf)
                Logger.info(f"Layer ambiental adicionada: {label} ({len(layer_gdf)} feições)")

    def add_cartographic_elements(self, dxf_gen: DXFGenerator) -> None:
        """Adiciona grade de coordenadas, norte e carimbo ao DXF."""
        if dxf_gen.bounds is None:
            return
        min_x, min_y, max_x, max_y = dxf_gen.bounds
        dxf_gen.add_coordinate_grid(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)
        dxf_gen.add_cartographic_elements(min_x, min_y, max_x, max_y, dxf_gen.diff_x, dxf_gen.diff_y)

    def add_satellite_overlay(self, dxf_gen: DXFGenerator) -> None:
        """Busca e embeds imagem de satélite Google Maps no DXF."""
        try:
            from infrastructure.external_api.google_maps_static import GoogleMapsStaticAPI

            zoom = 18
            if self.layers_config.get('radius', 100) > 800:   zoom = 15
            elif self.layers_config.get('radius', 100) > 400: zoom = 16
            elif self.layers_config.get('radius', 100) > 200: zoom = 17
            elif self.layers_config.get('radius', 100) < 50:  zoom = 19

            img_path = GoogleMapsStaticAPI.fetch_satellite_image(self.lat, self.lon, zoom=zoom, scale=2)
            if img_path and os.path.exists(img_path) and dxf_gen.bounds:
                dxf_gen.add_raster_overlay(img_path, dxf_gen.bounds)
                self.satellite_cache_path = img_path
        except ImportError:
            Logger.warn("GoogleMapsStaticAPI não encontrado. Overlay ignorado.")
        except Exception as e:
            Logger.error(f"Falha ao integrar overlay de satélite: {e}")

    def export_csv_metadata(self, gdf: gpd.GeoDataFrame) -> None:
        """Exporta metadados das feições para CSV."""
        try:
            csv_file = self.output_file.replace('.dxf', '_metadata.csv')
            df = gdf.copy()
            df['area_m2'] = df.geometry.area
            df['length_m'] = df.geometry.length
            pd.DataFrame(df.drop(columns='geometry')).to_csv(csv_file, index=False)
            Logger.info(f"Metadados exportados: {os.path.basename(csv_file)}")
        except Exception as e:
            Logger.error(f"Falha na exportação CSV: {e}")
