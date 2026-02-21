"""
controller.py — Orquestrador OSM2DXF (DDD Application Layer)
Responsabilidade única: coordenar o fluxo entre use cases.
Toda lógica de domínio reside nos use cases em application/use_cases/.
"""
import math
import json
import geopandas as gpd
from typing import Dict, Optional

from spatial_audit import run_spatial_audit
from analytics_engine import AnalyticsEngine
from utils.logger import Logger
from utils.geo import sirgas2000_utm_epsg, validate_coordinates
from application.use_cases.osm_fetcher import OsmFetcherUseCase
from application.use_cases.environmental_extractor import EnvironmentalExtractorUseCase
from application.use_cases.terrain_processor import TerrainProcessorUseCase
from application.use_cases.cad_exporter import CadExporterUseCase
from application.use_cases.report_orchestrator import ReportOrchestratorUseCase
from infrastructure.external_api.ibge_adapter import IBGEAdapter
from infrastructure.external_api.incra_adapter import INCRAAdapter


class OSMController:
    """
    Orquestra o pipeline OSM → Análise Espacial → DXF + PDF.
    Delega toda responsabilidade de domínio para use cases especializados.
    """

    def __init__(self, lat: float, lon: float, radius: float, output_file: str,
                 layers_config: Dict, crs: str, export_format: str = 'dxf',
                 selection_mode: str = 'circle', polygon=None):
        validate_coordinates(lat, lon, radius)
        self.lat = lat
        self.lon = lon
        self.radius = radius
        self.output_file = output_file
        self.layers_config = self._normalize_layers_config(layers_config)
        self.crs = crs
        self.export_format = export_format.lower()
        self.selection_mode = selection_mode
        self.polygon = polygon
        self.project_metadata = {'client': 'CLIENTE PADRÃO', 'project': 'EXTRAÇÃO ESPACIAL'}
        self.audit_summary: Dict = {'violations': 0, 'coverageScore': 0}
        self._uc_metadata: Dict = {}
        self._geodetic_features: list = []

    def _normalize_layers_config(self, config: Dict) -> Dict:
        """Expande aliases de configuração para garantir compatibilidade entre módulos."""
        normalized = config.copy()
        
        # Mapeamento de Aliases para chaves canônicas do sistema
        if config.get('cadastral'):
            for k in ['buildings', 'roads', 'furniture', 'equipment', 'infrastructure']:
                normalized.setdefault(k, True)
                
        if config.get('environmental'):
            for k in ['nature', 'vegetation', 'landuse', 'uc', 'app', 'hydrology']:
                normalized.setdefault(k, True)
                
        if config.get('terrain'):
            for k in ['terrain', 'contours', 'generate_tin', 'slopeAnalysis']:
                normalized.setdefault(k, True)
                
        return normalized

    # ── Main pipeline ─────────────────────────────────────────────────────────

    def run(self) -> None:
        """Executa o pipeline completo OSM → DXF + PDF."""
        Logger.info(f"Pipeline OSM iniciado (formato: {self.export_format})", progress=5)

        # 1. Buscar features OSM
        osm = OsmFetcherUseCase(
            self.lat, self.lon, self.radius,
            self.layers_config, self.crs, self.selection_mode, self.polygon
        )
        tags = osm.build_tags()
        if not tags:
            Logger.error("Nenhuma layer selecionada."); return

        Logger.info("1/5: Buscando features OSM...", progress=10)
        gdf = osm.fetch(tags)
        if gdf is None or gdf.empty:
            Logger.info("Nenhuma feature encontrada no raio.", "warning"); return

        # 2. Auditoria espacial
        Logger.info("2/5: Auditoria espacial...", progress=30)
        analysis_gdf = self._run_audit(gdf)

        # 3. Inicializar DXF e adicionar features OSM
        Logger.info("3/5: Gerando DXF...", progress=50)
        use_georef = self.layers_config.get('georef', True)
        cad = CadExporterUseCase(self.output_file, self.lat, self.lon, self.layers_config)
        dxf_gen = cad.initialize_dxf(use_georef)
        dxf_gen.add_features(gdf)

        # 3.5 Calcular Geometria para Memorial
        if self.selection_mode == 'circle':
            area = math.pi * (self.radius ** 2)
            perimeter = 2 * math.pi * self.radius
            # Vértices aproximados para o memorial se for círculo
            dxf_gen.project_info['vertices'] = [
                (self.lon, self.lat + 0.0001, 0, "P1"),
                (self.lon + 0.0001, self.lat, 0, "P2"),
                (self.lon, self.lat - 0.0001, 0, "P3"),
                (self.lon - 0.0001, self.lat, 0, "P4")
            ]
        else:
            area = 0.0
            perimeter = 0.0
            
        dxf_gen.project_info['total_area'] = area
        dxf_gen.project_info['perimeter'] = perimeter
        dxf_gen.project_info.update(self.project_metadata)

        # 3.6 ANEEL/PRODIST: Faixas de Servidão (normas da concessionária sobrescrevem ABNT)
        self._concessionaria_rules_applied = False
        if self.layers_config.get('infrastructure', False):
            from domain.services.aneel_prodist_rules import AneelProdistRules
            if AneelProdistRules.has_power_infrastructure(gdf):
                faixas_gdf = AneelProdistRules.generate_faixas_servid(gdf)
                if not faixas_gdf.empty:
                    dxf_gen.add_features(faixas_gdf)
                    self._concessionaria_rules_applied = True

        # 4. Extração ambiental (APP / Uso do Solo / UCs)
        env_result = {'app_gdf': None, 'landuse_gdf': None, 'uc_gdf': None}
        if any(self.layers_config.get(k, False) for k in ('app', 'landuse', 'uc')):
            Logger.info("4/5: Extraindo restrições ambientais...", progress=70)
            env = EnvironmentalExtractorUseCase(self.lat, self.lon, self.radius)
            env_result = env.extract(gdf)
            cad.add_environmental_layers(
                dxf_gen, env_result['app_gdf'],
                env_result['landuse_gdf'], env_result['uc_gdf']
            )
            self._uc_metadata = env_result.get('uc_metadata', {})
        else:
            self._uc_metadata = {}

        # 5. Geodésia Oficial (IBGE/INCRA) - Antes do preview para aparecer no mapa
        if self.layers_config.get('geodesy', True):
            self._fetch_geodetic_data(dxf_gen)

        # 6. Preview GeoJSON
        self._send_geojson_preview(gdf, analysis_gdf, **{
            k: env_result[k] for k in ('app_gdf', 'landuse_gdf', 'uc_gdf')
        })

        # 6. Terreno (opcional)
        analytics_res, grid_rows = None, []
        if self.layers_config.get('terrain', False):
            terrain = TerrainProcessorUseCase(self.output_file, self.layers_config)
            terrain_result = terrain.process(gdf, dxf_gen)
            grid_rows = terrain_result['grid_rows']
            analytics_res = terrain_result['analytics_res']

        # 7. Enriquecimento BIM com analytics
        if analytics_res and grid_rows:
            self._enrich_with_analytics(gdf, grid_rows, analytics_res)

        # 8. Elementos cartográficos + satélite
        if self.layers_config.get('cartography', True):
            cad.add_cartographic_elements(dxf_gen)
            
        if self.layers_config.get('satellite', False):
            cad.add_satellite_overlay(dxf_gen)

        # 10. Salvar DXF + CSV
        Logger.info("5/5: Finalizando exportação...", progress=90)
        dxf_gen.save()
        cad.export_csv_metadata(gdf)

        # 11. Relatório PDF
        report = ReportOrchestratorUseCase(
            self.output_file, self.project_metadata, self.lat, self.lon
        )
        report.generate(gdf, analytics_res, cad.satellite_cache_path)

        Logger.success(f"Pipeline concluído: {self.output_file}")

    # ── Helpers internos ───────────────────────────────────────────────────────

    def _run_audit(self, gdf: gpd.GeoDataFrame) -> Optional[gpd.GeoDataFrame]:
        if self.crs == 'auto':
            centroid = gdf.geometry.centroid
            epsg = sirgas2000_utm_epsg(centroid.y.mean(), centroid.x.mean())
            Logger.info(f"CRS automático: EPSG:{epsg} (SIRGAS 2000 UTM)")
        try:
            audit_summary, analysis_gdf = run_spatial_audit(gdf)
            self.audit_summary = audit_summary
            Logger.info(f"Auditoria: {audit_summary['violations']} violações detectadas.")
            return analysis_gdf
        except Exception as e:
            Logger.error(f"Falha na auditoria espacial: {e}")
            return None

    def _enrich_with_analytics(self, gdf: gpd.GeoDataFrame,
                                grid_rows: list, analytics_res: Dict) -> None:
        Logger.info("Enriquecimento BIM: Hidrologia / Solar / Terreno...")

        def interp(geom, grid, **kw):
            if geom is None or geom.is_empty: return 0.0
            return AnalyticsEngine.interpolate_point_value(geom.centroid, grid_rows, grid)

        gdf['declividade_pct'] = gdf.geometry.apply(
            lambda g: AnalyticsEngine.interpolate_point_slope(g.centroid, grid_rows, analytics_res)
            if g and not g.is_empty else 0.0
        )
        gdf['orientacao_deg']  = gdf.geometry.apply(lambda g: interp(g, analytics_res['aspect']))
        gdf['fluxo_acumulado'] = gdf.geometry.apply(lambda g: interp(g, analytics_res['hydrology']))
        if 'solar' in analytics_res:
            gdf['potencial_solar'] = gdf.geometry.apply(lambda g: interp(g, analytics_res['solar']))

    def _send_geojson_preview(self, gdf, analysis_gdf=None,
                               app_gdf=None, landuse_gdf=None, uc_gdf=None) -> None:
        if Logger.SKIP_GEOJSON: return
        try:
            preview = gdf.copy()
            preview['area'] = preview.geometry.area
            preview['length'] = preview.geometry.length
            preview['feature_type'] = preview.apply(
                lambda r: 'building' if r.get('building')
                else ('highway' if r.get('highway') else 'other'), axis=1
            )
            payload = json.loads(preview.to_crs(epsg=4326).to_json())

            extras = [
                (analysis_gdf, 'is_analysis'), (app_gdf, 'is_app'),
                (landuse_gdf, 'is_landuse'),
            ]
            for extra_gdf, flag in extras:
                if extra_gdf is not None and not extra_gdf.empty:
                    feats = json.loads(extra_gdf.to_crs(epsg=4326).to_json())['features']
                    for f in feats: f['properties'][flag] = True
                    payload['features'].extend(feats)

            if uc_gdf is not None and not uc_gdf.empty:
                feats = json.loads(uc_gdf.to_crs(epsg=4326).to_json())['features']
                for f in feats:
                    f['properties']['is_uc'] = True
                    f['properties']['landuse'] = 'conservation_unit'
                payload['features'].extend(feats)

            # 4. Geodésia (Marcos e INCRA)
            if hasattr(self, '_geodetic_features'):
                payload['features'].extend(self._geodetic_features)

            payload['audit_summary'] = self.audit_summary
            if getattr(self, '_uc_metadata', None):
                payload['uc_metadata'] = self._uc_metadata
            if getattr(self, '_concessionaria_rules_applied', False):
                payload['concessionaria_rules_applied'] = True
            Logger.geojson(payload)
        except Exception as e:
            Logger.error(f"Erro no preview GeoJSON: {str(e)}")

    def _fetch_geodetic_data(self, dxf_gen) -> None:
        """Busca marcos geodésicos e dados SIGEF via adaptadores."""
        Logger.info("Buscando marcos geodésicos oficiais (IBGE)...")
        # Criar BBOX aproximado (raio de ~5km para marcos)
        delta = 0.05 
        bbox = [self.lat - delta, self.lon - delta, self.lat + delta, self.lon + delta]
        
        self._geodetic_features = []
        marcos = IBGEAdapter.get_stations_nearby(*bbox)
        if marcos:
            dxf_gen.project_info['geodetic_markers'] = marcos
            for m in marcos:
                dxf_gen.add_geodetic_marker(
                    m['lat'], m['lon'], m['altitude'], f"IBGE-{m['id']}"
                )
                self._geodetic_features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [m['lon'], m['lat']]},
                    "properties": {"name": f"IBGE-{m['id']}", "altitude": m['altitude'], "is_geodesy": True}
                })

        if self.layers_config.get('incra', False):
            Logger.info("Buscando parcelas certificadas (INCRA SIGEF)...")
            parcelas = INCRAAdapter.get_parcels_nearby(*bbox)
            dxf_gen.project_info['incra_parcels'] = parcelas
            # Convert simple parcel list if possible or just log metadata
