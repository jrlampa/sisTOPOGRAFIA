import os
import sys

# Ensure project root and py_engine are in path
py_engine_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(py_engine_root)

for path in [project_root, py_engine_root]:
    if path not in sys.path:
        sys.path.append(path)

from py_engine.controller import OSMController
from py_engine.utils.logger import Logger

def test_full_system_stress():
    """
    Teste 'God Mode': Ativa todos os filtros e gera todos os documentos simultaneamente.
    Ponto: Búzios, RJ (Alta densidade de dados geodésicos e topográficos).
    """
    lat, lon = -22.7558, -41.8916
    radius = 500  # 500m para um teste denso
    output_dxf = os.path.join(project_root, "output", "FULL_STRESS_TEST_BUZIOS.dxf")
    
    # Garantir diretório de saída
    os.makedirs(os.path.dirname(output_dxf), exist_ok=True)

    # Configuração Máxima (Todos os filtros ativos)
    layers_config = {
        'geodesy': True,
        'incra': True,
        'cartography': True,
        'satellite': True,
        'environmental': True,
        'contours': True,
        'slopeAnalysis': True,
        'hydrology': True,
        'cadastral': True,
        'terrain': True,
        'report': True
    }

    Logger.info("=== INICIANDO TESTE DE ESTRESSE COMPLETO (GOD MODE) ===")
    Logger.info(f"Coordenadas: {lat}, {lon} | Raio: {radius}m")
    
    try:
        controller = OSMController(
            lat=lat,
            lon=lon,
            radius=radius,
            output_file=output_dxf,
            layers_config=layers_config,
            crs='EPSG:31983', # SIRGAS 2000 / UTM zone 23S
            selection_mode='circle'
        )
        
        # Sobrescrever metadados para o carimbo
        controller.project_metadata = {
            'client': 'AUDITORIA TÉCNICA FINAL',
            'project': 'STRESS TEST - SISTOPOGRAFIA v2.0',
            'rt': 'Jonatas Lampa'
        }
        
        controller.run()
        
        Logger.success("=== TESTE DE ESTRESSE CONCLUÍDO COM SUCESSO ===")
        Logger.info(f"DXF Gerado: {output_dxf}")
        
        # Verificar arquivos gerados
        base_path = output_dxf.replace(".dxf", "")
        expected_files = [
            output_dxf,
            f"{base_path}_MEMORIAL.txt",
            # PDF dependendo da implementação pode ter nome diferente ou ser capturado pelo report orchestrator
        ]
        
        for f in expected_files:
            if os.path.exists(f):
                Logger.info(f"Documento Validado: {os.path.basename(f)}")
            else:
                Logger.warning(f"Documento Faltante: {os.path.basename(f)}")

    except Exception as e:
        Logger.error(f"FALHA NO TESTE DE ESTRESSE: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_full_system_stress()
