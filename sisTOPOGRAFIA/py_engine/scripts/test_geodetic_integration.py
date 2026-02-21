
import os
import sys

# Current script: c:\sisTOPOGRAFIA\sisTOPOGRAFIA\sisTOPOGRAFIA\py_engine\scripts\test_geodetic_integration.py
# Parent: scripts
# Grandparent: py_engine (This should be in sys.path)
script_path = os.path.abspath(__file__)
script_dir = os.path.dirname(script_path)
py_engine_root = os.path.dirname(script_dir)

if py_engine_root not in sys.path:
    sys.path.append(py_engine_root)

# Also add parent of py_engine to handle absolute imports if any
project_parent = os.path.dirname(py_engine_root)
if project_parent not in sys.path:
    sys.path.append(project_parent)

print(f"Debug: py_engine_root is {py_engine_root}")

try:
    # Based on main.py imports, this should work if py_engine_root is in sys.path
    from controller import OSMController
    from utils.logger import Logger
    print("Debug: Direct imports successful")
except ImportError as e:
    print(f"Debug: Direct import failed: {e}. Trying absolute...")
    try:
        from py_engine.controller import OSMController
        from py_engine.utils.logger import Logger
        print("Debug: Absolute imports successful")
    except ImportError as e2:
        print(f"Debug: Absolute import failed: {e2}")
        sys.exit(1)

def test_geodetic_integration():
    """
    Testa a integração geodésica completa em Búzios, RJ.
    """
    output_dir = r"C:\Users\jonat\OneDrive - IM3 Brasil\Teste\sisTOPOGRAFIA"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_file = os.path.join(output_dir, "projeto_geodesico_buzios.dxf")
    
    # Coordenadas em Búzios, RJ
    lat, lon = -22.7584, -41.8953 
    radius = 500  # 500m
    
    layers_config = {
        'building': True,
        'highway': True,
        'cartography': True,
        'geodesy': True,
        'incra': True
    }
    
    controller = OSMController(
        lat=lat, lon=lon, radius=radius,
        output_file=output_file,
        layers_config=layers_config,
        crs='auto',
        selection_mode='circle'
    )
    
    controller.project_metadata = {
        'client': 'Prefeitura de Búzios',
        'project': 'LEVANTAMENTO GEODÉSICO OFICIAL'
    }
    
    Logger.info("Iniciando Teste E2E de Integração Geodésica...")
    controller.run()
    
    if os.path.exists(output_file):
        Logger.success(f"Teste concluído! Verifique o DXF em: {output_file}")
        mem_file = output_file.replace('.dxf', '_MEMORIAL.txt')
        if os.path.exists(mem_file):
            Logger.success(f"Memorial gerado: {mem_file}")
    else:
        Logger.error("Falha ao gerar o arquivo DXF.")

if __name__ == "__main__":
    test_geodetic_integration()
