"""
layer_classifier.py — DXF Layer Classifier
Responsabilidade única: mapear tags OSM para layers DXF sisTOPOGRAFIA.
DDD — Domain Layer (puro, sem dependências de infraestrutura).
"""
import pandas as pd


# Mapeamento de layers DXF da plataforma sisTOPOGRAFIA (Padrão ABNT)
LAYER_NAMES = {
    'HIDROGRAFIA':       'TOPO_HIDROGRAFIA',
    'INFRA_POWER_HV':    'TOPO_INFRA_POWER_HV',
    'INFRA_POWER_LV':    'TOPO_INFRA_POWER_LV',
    'INFRA_TELECOM':     'TOPO_INFRA_TELECOM',
    'MOBILIARIO_URBANO': 'TOPO_MOBILIARIO_URBANO',
    'EDIFICACAO':        'TOPO_EDIFICACAO',
    'UC_FEDERAL':        'TOPO_UC_FEDERAL',
    'UC_ESTADUAL':       'TOPO_UC_ESTADUAL',
    'UC_MUNICIPAL':      'TOPO_UC_MUNICIPAL',
    'APP_30M':           'TOPO_RESTRICAO_APP_30M',
    'USO_RESIDENCIAL':   'TOPO_USO_RESIDENCIAL',
    'USO_COMERCIAL':     'TOPO_USO_COMERCIAL',
    'USO_INDUSTRIAL':    'TOPO_USO_INDUSTRIAL',
    'USO_VEGETACAO':     'TOPO_USO_VEGETACAO',
    'VIAS':              'TOPO_VIAS',
    'VEGETACAO':         'TOPO_VEGETACAO',
    'EQUIPAMENTOS':      'TOPO_EQUIPAMENTOS',
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

    # 6. UCs e APP
    top_type = _get('TOPO_type') or _get('sisTOPO_type') # Suporte legado curto
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
