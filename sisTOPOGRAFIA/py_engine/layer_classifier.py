"""
layer_classifier.py — DXF Layer Classifier
Responsabilidade única: mapear tags OSM para layers DXF sisTOPOGRAFIA.
DDD — Domain Layer (puro, sem dependências de infraestrutura).
"""
import pandas as pd


# Mapeamento de layers DXF da plataforma sisTOPOGRAFIA (Padrão ABNT)
LAYER_NAMES = {
    'HIDROGRAFIA':          'sisTOPO_HIDROGRAFIA',
    'INFRA_POWER_HV':       'sisTOPO_INFRA_POWER_HV',
    'INFRA_POWER_LV':       'sisTOPO_INFRA_POWER_LV',
    'INFRA_TELECOM':        'sisTOPO_INFRA_TELECOM',
    'PRODIST_FAIXA_HV':     'sisTOPO_PRODIST_FAIXA_HV',
    'PRODIST_FAIXA_MT':     'sisTOPO_PRODIST_FAIXA_MT',
    'PRODIST_FAIXA_BT':     'sisTOPO_PRODIST_FAIXA_BT',
    'MOBILIARIO_URBANO': 'sisTOPO_MOBILIARIO_URBANO',
    'EDIFICACAO':        'sisTOPO_EDIFICACAO',
    'UC_FEDERAL':        'sisTOPO_UC_FEDERAL',
    'UC_ESTADUAL':       'sisTOPO_UC_ESTADUAL',
    'UC_MUNICIPAL':      'sisTOPO_UC_MUNICIPAL',
    'APP_30M':           'sisTOPO_RESTRICAO_APP_30M',
    'USO_RESIDENCIAL':   'sisTOPO_USO_RESIDENCIAL',
    'USO_COMERCIAL':     'sisTOPO_USO_COMERCIAL',
    'USO_INDUSTRIAL':    'sisTOPO_USO_INDUSTRIAL',
    'USO_VEGETACAO':     'sisTOPO_USO_VEGETACAO',
    'VIAS':              'sisTOPO_VIAS',
    'VEGETACAO':         'sisTOPO_VEGETACAO',
    'EQUIPAMENTOS':      'sisTOPO_EQUIPAMENTOS',
}

_FURNITURE_AMENITIES = frozenset([
    'bench', 'waste_basket', 'bicycle_parking', 'fountain', 'drinking_water'
])
_WATER_NATURAL = frozenset(['water', 'wetland', 'bay', 'coastline'])
_VEGETATION_NATURAL = frozenset(['tree', 'wood', 'scrub'])
_LANDUSE_VEGETATION = frozenset(['forest', 'grass', 'meadow', 'park'])


def classify_layer(tags) -> str:
    """
    Mapeia um dicionário/Series de tags OSM para o nome da layer DXF correspondente.

    Prioridade (ordem top-down):
    1. Hidrografia (waterway / natural=water)
    2. Infraestrutura de energia e telecom
    3. Mobiliário urbano
    4. Edificações
    5. Restrições ambientais (UCs, APP)
    6. Uso do solo
    7. Vias
    8. Vegetação / Amenidades
    9. Layer padrão '0'
    """
    def _get(key):
        val = tags.get(key)
        if val is None or (hasattr(pd, 'isna') and pd.isna(val)):
            return None
        return val

    # 1. HIDROGRAFIA — prioridade máxima (rios podem ter tag amenity=fountain)
    if _get('waterway') is not None:
        return LAYER_NAMES['HIDROGRAFIA']
    natural = _get('natural')
    if natural in _WATER_NATURAL:
        return LAYER_NAMES['HIDROGRAFIA']

    # 1.5. Faixa de Servidão ANEEL/PRODIST (sobrepõe ABNT para infraestrutura elétrica)
    prodist_type = _get('prodist_type')
    if prodist_type == 'HV':
        return LAYER_NAMES['PRODIST_FAIXA_HV']
    if prodist_type == 'MT':
        return LAYER_NAMES['PRODIST_FAIXA_MT']
    if prodist_type == 'BT':
        return LAYER_NAMES['PRODIST_FAIXA_BT']

    # 2. Infraestrutura elétrica
    power = _get('power')
    if power is not None:
        if power in ('line', 'tower', 'substation'):
            return LAYER_NAMES['INFRA_POWER_HV']
        return LAYER_NAMES['INFRA_POWER_LV']

    # 3. Telecom
    if _get('telecom') is not None:
        return LAYER_NAMES['INFRA_TELECOM']

    # 4. Mobiliário urbano
    amenity = _get('amenity')
    highway = _get('highway')
    if amenity in _FURNITURE_AMENITIES or highway == 'street_lamp':
        return LAYER_NAMES['MOBILIARIO_URBANO']

    # 5. Edificações
    if _get('building') is not None:
        return LAYER_NAMES['EDIFICACAO']

    # 6. UCs e APP — suporte legado: coluna TOPO_type (pré-Fase 12) e sisTOPO_type (atual)
    top_type = _get('sisTOPO_type') or _get('TOPO_type')
    if top_type is not None:
        if top_type == 'UC_FEDERAL':   return LAYER_NAMES['UC_FEDERAL']
        if top_type == 'UC_ESTADUAL':  return LAYER_NAMES['UC_ESTADUAL']
        if top_type == 'UC_MUNICIPAL': return LAYER_NAMES['UC_MUNICIPAL']

    app_type = _get('app_type')
    if app_type == 'APP_30M':
        return LAYER_NAMES['APP_30M']

    # 7. Uso do solo
    landuse = _get('landuse')
    if landuse is not None:
        if landuse == 'residential': return LAYER_NAMES['USO_RESIDENCIAL']
        if landuse == 'commercial':  return LAYER_NAMES['USO_COMERCIAL']
        if landuse == 'industrial':  return LAYER_NAMES['USO_INDUSTRIAL']
        if landuse in _LANDUSE_VEGETATION: return LAYER_NAMES['USO_VEGETACAO']
        return LAYER_NAMES['USO_VEGETACAO']  # fallback landuse

    # 8. Vias
    if highway is not None:
        return LAYER_NAMES['VIAS']

    # 9. Vegetação
    if natural in _VEGETATION_NATURAL:
        return LAYER_NAMES['VEGETACAO']

    # 10. Amenidades gerais / Lazer
    if amenity is not None:
        return LAYER_NAMES['EQUIPAMENTOS']
    if _get('leisure') is not None:
        return LAYER_NAMES['VEGETACAO']

    return '0'
