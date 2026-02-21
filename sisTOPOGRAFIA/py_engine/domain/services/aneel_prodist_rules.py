"""
aneel_prodist_rules.py — Regras ANEEL/PRODIST para Infraestrutura Elétrica
Responsabilidade única: calcular faixas de servidão conforme PRODIST Módulo 3.

Referência: ANEEL — PRODIST Módulo 3 §6.4 (Acesso ao Sistema de Distribuição).
IMPORTANTE: Quando normas da concessionária forem aplicadas, os padrões ABNT são
substituídos pelas regras ANEEL/PRODIST. O controlador sinaliza isso via a flag
`_concessionaria_rules_applied`, que é incluída no payload GeoJSON; o frontend
exibe o toast explicativo ao detectar o campo `concessionaria_rules_applied=True`.
"""
import geopandas as gpd

try:
    from constants import (
        PRODIST_BUFFER_HV_M, PRODIST_BUFFER_MT_M, PRODIST_BUFFER_BT_M,
        LAYER_PRODIST_FAIXA_HV, LAYER_PRODIST_FAIXA_MT, LAYER_PRODIST_FAIXA_BT,
    )
    from utils.logger import Logger
except ImportError:
    from ...constants import (
        PRODIST_BUFFER_HV_M, PRODIST_BUFFER_MT_M, PRODIST_BUFFER_BT_M,
        LAYER_PRODIST_FAIXA_HV, LAYER_PRODIST_FAIXA_MT, LAYER_PRODIST_FAIXA_BT,
    )
    from ...utils.logger import Logger

# Tags OSM que indicam infraestrutura de Alta Tensão (≥ 69 kV)
_HV_POWER_TAGS = frozenset(['line', 'tower', 'substation'])

# Tags OSM que indicam infraestrutura de Baixa Tensão (< 13,8 kV)
_BT_POWER_TAGS = frozenset(['minor_line', 'cable'])


class AneelProdistRules:
    """
    Implementa as regras ANEEL/PRODIST para infraestrutura de distribuição elétrica.

    PRODIST Módulo 3 — Acesso ao Sistema de Distribuição (§6.4 Faixa de Servidão):
    - Alta Tensão (≥ 69 kV): buffer de 15 m por lado
    - Média Tensão (13,8 – 34,5 kV): buffer de 8 m por lado
    - Baixa Tensão (< 13,8 kV): buffer de 2 m por lado

    Quando aplicado, normas ABNT são substituídas pelas normas da concessionária.
    """

    @staticmethod
    def has_power_infrastructure(gdf: gpd.GeoDataFrame) -> bool:
        """Verifica se o GeoDataFrame contém elementos de infraestrutura elétrica."""
        if gdf is None or gdf.empty or 'power' not in gdf.columns:
            return False
        return bool(gdf['power'].notna().any())

    @staticmethod
    def generate_faixas_servid(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """
        Gera faixas de servidão PRODIST para linhas/postes de transmissão e distribuição.

        Args:
            gdf: GeoDataFrame projetado com features OSM (deve conter coluna 'power').

        Returns:
            GeoDataFrame com buffers PRODIST classificados por tensão (HV / MT / BT).
            Retorna GeoDataFrame vazio se nenhum elemento elétrico for encontrado.
        """
        _empty = gpd.GeoDataFrame(columns=['geometry', 'prodist_type'])

        if gdf is None or gdf.empty or 'power' not in gdf.columns:
            return _empty

        power_gdf = gdf[gdf['power'].notna()].copy()
        if power_gdf.empty:
            return _empty

        crs_is_geographic = bool(power_gdf.crs and power_gdf.crs.is_geographic)
        if crs_is_geographic:
            power_gdf = power_gdf.to_crs(epsg=3857)

        results = []
        for _, row in power_gdf.iterrows():
            power_val = row.get('power')
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue

            if power_val in _HV_POWER_TAGS:
                buf = geom.buffer(PRODIST_BUFFER_HV_M)
                results.append({'geometry': buf, 'prodist_type': 'HV'})
            elif power_val in _BT_POWER_TAGS:
                buf = geom.buffer(PRODIST_BUFFER_BT_M)
                results.append({'geometry': buf, 'prodist_type': 'BT'})
            else:
                # Média Tensão como default para valores não classificados como HV ou BT
                # (ex.: 'pole', 'transformer', 'switch', 'catenary_mast')
                buf = geom.buffer(PRODIST_BUFFER_MT_M)
                results.append({'geometry': buf, 'prodist_type': 'MT'})

        if not results:
            return _empty

        result_gdf = gpd.GeoDataFrame(results, crs=power_gdf.crs)
        if crs_is_geographic:
            result_gdf = result_gdf.to_crs(epsg=4326)

        Logger.info(
            f"ANEEL/PRODIST: {len(results)} faixas de servidão geradas "
            f"(normas ABNT substituídas por normas da concessionária)"
        )
        return result_gdf
