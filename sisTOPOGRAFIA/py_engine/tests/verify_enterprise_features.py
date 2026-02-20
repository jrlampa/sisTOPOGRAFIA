"""
verify_enterprise_features.py — Script de validação funcional rápida.
Cria um DXF sintético com malha TIN e hachuras para validar a lógica em dxf_generator.py.
"""
import sys
import os
import numpy as np
import ezdxf

# Ajusta path para importar módulos locais
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from dxf_generator import DXFGenerator
    from analytics_engine import AnalyticsEngine
    print("Módulos carregados com sucesso.")
except ImportError as e:
    print(f"Erro de importação: {e}")
    sys.exit(1)

def test_enterprise_gen():
    output = "py_engine/tests/enterprise_test.dxf"
    dxf = DXFGenerator(output)
    
    # Grid sintético (3x3 pontos) para gerar 2 triângulos (ou faces)
    # Formato: List[List[Tuple(x, y, z)]]
    grid_rows = [
        [(0,0,10), (10,0,11), (20,0,10)],
        [(0,10,12), (10,10,13), (20,10,12)],
        [(0,20,10), (10,20,11), (20,20,10)]
    ]
    
    # 1. Testa Malha TIN
    print("Gerando Malha TIN...")
    dxf.add_tin_mesh(grid_rows)
    
    # 2. Testa Hachuras de Risco
    # Precisamos de um objeto analytics com slope_grid fake
    # Para o grid 3x3, o slope_grid será 3x3 (ou 2x2 dependendo da implementação)
    # No AnalyticsEngine, slope_grid tem o mesmo shape que os pontos da grade
    fake_slope = np.array([
        [10.0, 40.0, 10.0],
        [40.0, 110.0, 40.0],
        [10.0, 40.0, 10.0]
    ])
    analytics = {'slope_pct': fake_slope, 'rows': 3, 'cols': 3}
    
    print("Gerando Hachuras de Risco...")
    dxf.add_slope_hatch(grid_rows, analytics)
    
    dxf.save()
    print(f"DXF salvo em {output}")

    # Validação estrutural básica
    doc = ezdxf.readfile(output)
    msp = doc.modelspace()
    
    faces = msp.query('3DFACE')
    hatches = msp.query('HATCH')
    
    print(f"Entidades encontradas: {len(faces)} 3DFACEs, {len(hatches)} HATCHes.")
    
    if len(faces) > 0 and len(hatches) > 0:
        print("VERIFICAÇÃO P4: SUCESSO. Engine Enterprise funcional.")
    else:
        print("VERIFICAÇÃO P4: FALHA. Entidades ausentes.")
        sys.exit(1)

if __name__ == "__main__":
    test_enterprise_gen()
