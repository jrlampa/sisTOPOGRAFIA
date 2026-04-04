#!/usr/bin/env python3
"""
TOPODATA Cache Warm-up Script
Pré-baixa tiles de elevação para áreas frequentemente usadas no Brasil

Uso: python warmup_topodata_cache.py [--areas all|sudeste|sul|nordeste|centro-oeste|norte]
"""

import argparse
import sys
import os

# Adicionar py_engine ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from topodata_reader import download_tile, get_cache_path
from utils.logger import Logger

# Áreas prioritárias (grandes cidades brasileiras)
PRIORITY_AREAS = {
    # Sudeste
    'sudeste': [
        # São Paulo e Grande SP
        (-23.5505, -46.6333),  # São Paulo (capital)
        (-23.9608, -46.3331),  # Guarulhos
        (-23.6821, -46.8755),  # Osasco
        (-23.6261, -46.5636),  # Santo André
        (-23.0108, -44.2708),  # São José dos Campos
        (-22.9068, -47.0466),  # Campinas
        (-23.3045, -45.9711),  # Taubaté
        (-21.1704, -47.8103),  # Ribeirão Preto
        
        # Rio de Janeiro
        (-22.9064, -43.1822),  # Rio de Janeiro
        (-22.8839, -43.1154),  # Niterói
        (-22.9009, -43.1771),  # São Gonçalo
        (-22.7692, -43.3726),  # Nova Iguaçu
        (-22.9250, -43.6109),  # Bangu
        
        # Belo Horizonte e MG
        (-19.9167, -43.9345),  # Belo Horizonte
        (-18.9113, -48.2622),  # Uberlândia
        (-21.7617, -43.3494),  # Juiz de Fora
        (-20.3856, -43.5035),  # Ouro Preto
        
        # Espírito Santo
        (-20.3155, -40.3128),  # Vitória
        (-19.4962, -40.6662),  # Colatina
    ],
    
    # Sul
    'sul': [
        # Curitiba e PR
        (-25.4290, -49.2671),  # Curitiba
        (-23.4200, -51.9331),  # Maringá
        (-24.9541, -53.4553),  # Cascavel
        (-25.0964, -50.1572),  # Ponta Grossa
        (-25.5313, -54.5783),  # Foz do Iguaçu
        
        # Porto Alegre e RS
        (-30.0346, -51.2177),  # Porto Alegre
        (-29.6842, -51.1103),  # Caxias do Sul
        (-28.2628, -52.4064),  # Passo Fundo
        (-31.7714, -52.3421),  # Pelotas
        (-32.0350, -52.0985),  # Rio Grande
        
        # Santa Catarina
        (-27.5969, -48.5495),  # Florianópolis
        (-26.3016, -48.8482),  # Joinville
        (-26.9166, -49.0713),  # Blumenau
        (-28.6788, -49.3700),  # Criciúma
    ],
    
    # Nordeste
    'nordeste': [
        # Salvador e BA
        (-12.9716, -38.5013),  # Salvador
        (-13.0059, -38.4581),  # Lauro de Freitas
        (-12.5930, -38.9667),  # Camaçari
        (-14.8619, -40.8443),  # Vitória da Conquista
        (-17.8572, -39.5276),  # Porto Seguro
        
        # Recife e PE
        (-8.0543, -34.8813),   # Recife
        (-7.8394, -34.9069),   # Olinda
        (-8.2832, -35.9698),   # Caruaru
        (-8.0597, -34.9519),   # Jaboatão dos Guararapes
        
        # Fortaleza e CE
        (-3.7327, -38.5270),   # Fortaleza
        (-3.6848, -38.4760),   # Caucaia
        (-4.8336, -40.3214),   # Juazeiro do Norte
        (-3.7213, -38.5387),   # Maracanaú
        
        # Outros estados NE
        (-9.6498, -35.7089),   # Maceió (AL)
        (-5.7793, -35.2009),   # Natal (RN)
        (-7.2307, -35.8817),   # Campina Grande (PB)
        (-2.5297, -44.3028),   # São Luís (MA)
        (-9.6658, -35.7344),   # Aracaju (SE)
    ],
    
    # Centro-Oeste
    'centro-oeste': [
        # Brasília e DF
        (-15.7975, -47.8919),  # Brasília
        (-15.8697, -47.9172),  # Taguatinga
        (-15.7801, -47.9292),  # Ceilândia
        (-15.6577, -48.0856),  # Águas Claras
        
        # Goiânia e GO
        (-16.6869, -49.2648),  # Goiânia
        (-16.2533, -48.9505),  # Anápolis
        (-17.7981, -49.1058),  # Rio Verde
        (-18.4831, -47.3916),  # Catalão
        
        # Mato Grosso
        (-15.6010, -56.0974),  # Cuiabá
        (-13.0390, -55.9214),  # Sinop
        (-16.4409, -54.6366),  # Rondonópolis
        
        # Mato Grosso do Sul
        (-20.4697, -54.6201),  # Campo Grande
        (-21.1419, -51.3988),  # Dourados
        (-22.2212, -54.8024),  # Ponta Porã
    ],
    
    # Norte
    'norte': [
        # Manaus e AM
        (-3.1019, -60.0250),   # Manaus
        (-3.4583, -60.4597),   # Manacapuru
        (-2.6286, -56.7353),   # Itacoatiara
        (-3.3688, -60.1958),   # Iranduba
        
        # Belém e PA
        (-1.4558, -48.4902),   # Belém
        (-1.3640, -48.4620),   # Ananindeua
        (-2.4429, -54.7178),   # Santarém
        
        # Outros estados N
        (0.0389, -51.0664),    # Macapá (AP)
        (-8.0524, -50.0377),   # Marabá (PA)
        (-3.1336, -60.0234),   # Parintins (AM)
        (2.8195, -60.6714),    # Boa Vista (RR)
        (-11.8596, -55.5092),  # Sinop (MT)
        (-9.9754, -67.8243),   # Rio Branco (AC)
        (-10.1815, -63.8999),  # Porto Velho (RO)
        (-10.2491, -48.3243),  # Palmas (TO)
    ]
}

def warmup_area(coords_list, label):
    """Pré-baixa tiles para uma lista de coordenadas"""
    Logger.info(f"Iniciando warm-up para: {label} ({len(coords_list)} pontos)")
    
    downloaded = 0
    cached = 0
    errors = 0
    
    for i, (lat, lon) in enumerate(coords_list):
        try:
            # Verifica se já existe no cache
            cache_path = get_cache_path(lat, lon)
            if cache_path and os.path.exists(cache_path):
                cached += 1
                Logger.info(f"[{i+1}/{len(coords_list)}] Cache hit: ({lat}, {lon})")
                continue
            
            # Download do tile
            Logger.info(f"[{i+1}/{len(coords_list)}] Downloading: ({lat}, {lon})")
            result = download_tile(lat, lon)
            if result:
                downloaded += 1
            else:
                errors += 1
                
        except Exception as e:
            Logger.error(f"Error warming up ({lat}, {lon}): {e}")
            errors += 1
    
    Logger.info(f"Área {label} completa: {downloaded} downloads, {cached} cached, {errors} errors")
    return downloaded, cached, errors

def main():
    parser = argparse.ArgumentParser(description='TOPODATA Cache Warm-up')
    parser.add_argument('--areas', type=str, default='all',
                        choices=['all', 'sudeste', 'sul', 'nordeste', 'centro-oeste', 'norte'],
                        help='Regiões para warm-up (default: all)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Apenas simula, não faz downloads')
    
    args = parser.parse_args()
    
    Logger.info("=" * 60)
    Logger.info("TOPODATA Cache Warm-up")
    Logger.info("=" * 60)
    
    if args.dry_run:
        Logger.info("MODO SIMULAÇÃO - Nenhum download será feito")
    
    # Seleciona áreas
    if args.areas == 'all':
        areas_to_process = PRIORITY_AREAS.keys()
    else:
        areas_to_process = [args.areas]
    
    # Estatísticas totais
    total_downloaded = 0
    total_cached = 0
    total_errors = 0
    total_points = 0
    
    # Processa cada área
    for area_name in areas_to_process:
        if area_name not in PRIORITY_AREAS:
            Logger.warning(f"Área desconhecida: {area_name}")
            continue
        
        coords = PRIORITY_AREAS[area_name]
        total_points += len(coords)
        
        if args.dry_run:
            Logger.info(f"[DRY-RUN] {area_name}: {len(coords)} pontos")
            continue
        
        downloaded, cached, errors = warmup_area(coords, area_name)
        total_downloaded += downloaded
        total_cached += cached
        total_errors += errors
    
    # Resumo
    Logger.info("=" * 60)
    Logger.info("RESUMO")
    Logger.info("=" * 60)
    Logger.info(f"Total de pontos: {total_points}")
    Logger.info(f"Downloads: {total_downloaded}")
    Logger.info(f"Já em cache: {total_cached}")
    Logger.info(f"Erros: {total_errors}")
    Logger.info(f"Taxa de sucesso: {((total_downloaded + total_cached) / max(total_points, 1) * 100):.1f}%")
    
    if total_errors > 0:
        Logger.warning(f"{total_errors} tiles não puderam ser baixados")
        return 1
    
    Logger.success("Cache warm-up completo!")
    return 0

if __name__ == '__main__':
    sys.exit(main())
