import sys
import os
import geopandas as gpd
from shapely.geometry import Polygon, Point, LineString

# Adicionar o diretório pai (py_engine) ao path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dxf_generator import DXFGenerator
from memorial_engine import MemorialEngine

def generate_test_dxf(output_path):
    gen = DXFGenerator(output_path)
    
    # Coordenadas SIRGAS 2000 UTM (Búzios - Vila Nova)
    center_x, center_y = 788547.0, 7634925.0
    
    # Criar um polígono de teste (lote de 20x50m)
    vertices = [
        (center_x, center_y, 10.0, "P1"),
        (center_x + 20, center_y, 10.5, "P2"),
        (center_x + 20, center_y + 50, 11.0, "P3"),
        (center_x, center_y + 50, 10.8, "P4"),
    ]
    
    poly_coords = [v[:3] for v in vertices]
    
    # Dados de teste para simular feições reais
    data = gpd.GeoDataFrame({
        'geometry': [
            Polygon(poly_coords),                        # Área do Lote
            LineString([(center_x-5, center_y-5), (center_x+25, center_y-5)]), # Rua
            Point(center_x + 10, center_y - 2),          # Poste Enel
            Point(center_x + 5, center_y + 5),           # Árvore
        ],
        'building': ['yes', None, None, None],
        'highway':  [None, 'residential', None, None],
        'natural':  [None, None, None, 'tree'],
        'power':    [None, None, 'pole', None],
        'name':     ['LOTE 01', 'RUA DAS ACÁCIAS', 'PE-001', 'AR-01']
    }, crs='EPSG:31983')
    
    gen.add_features(data)
    
    # Injetar informações de projeto para o Carimbo e Memorial
    gen.project_info.update({
        'client': 'JONATAS LAMPA - TESTE ENGENHARIA',
        'project': 'LOTEAMENTO VILA NOVA - BÚZIOS',
        'location': 'ARMAÇÃO DOS BÚZIOS, RJ',
        'designer': 'JONATAS LAMPA (RT)',
        'paper_size': 'A1',
        'total_area': MemorialEngine.calculate_area(poly_coords),
        'perimeter': MemorialEngine.calculate_perimeter(poly_coords),
        'vertices': vertices
    })
    
    gen.save()
    print(f"Processo concluído. Verifique {output_path} e o arquivo de memorial correspondente.")

if __name__ == "__main__":
    out_dir = r"C:\Users\jonat\OneDrive - IM3 Brasil\Teste\sisTOPOGRAFIA"
    out_file = os.path.join(out_dir, "PROJETO_EXECUTIVO_VILA_NOVA.dxf")
    generate_test_dxf(out_file)
