
import sys
import os
import sys
import os
# Adicionar o diretório pai (py_engine) ao path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dxf_generator import DXFGenerator
import geopandas as gpd
from shapely.geometry import Polygon, Point, LineString

def generate_test_dxf(output_path):
    gen = DXFGenerator(output_path)
    
    # Criar dados de teste variados
    data = gpd.GeoDataFrame({
        'geometry': [
            Polygon([(0,0), (50,0), (50,50), (0,50)]),   # Edificação
            LineString([(0,10), (100,10)]),               # Via
            Point(25, 25),                                 # Árvore/Vegetação
            LineString([(0,60), (100,60)]),               # Poste/Energia
        ],
        'building': ['yes', None, None, None],
        'highway':  [None, 'residential', None, None],
        'natural':  [None, None, 'tree', None],
        'power':    [None, None, None, 'line'],
        'name':     ['Edificio Teste', 'Rua ABNT', 'Ipê Amarelo', 'Rede MT']
    }, crs='EPSG:31983')
    
    gen.add_features(data)
    
    # Adicionar curvas de nível (List[List[Tuple[x,y,z]]])
    contours = [
        [(0, 0, 100.0), (100, 100, 100.0)],
        [(0, 10, 101.0), (100, 110, 101.0)]
    ]
    gen.add_contour_lines(contours)
    
    gen.save()
    print(f"DXF de teste gerado em: {output_path}")

if __name__ == "__main__":
    generate_test_dxf("test_abnt.dxf")
