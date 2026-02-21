
"""
verify_abnt_standards.py — Script de verificação automatizada para padrões ABNT em DXF.
Valida:
1. Prefixos de camadas (TOPO_*)
2. Cores ACI (1-7 para camadas técnicas)
3. Pesos de linha (0.35 para mestras, 0.13 para intermediárias)
"""
import ezdxf
import sys
import os

def verify_dxf(file_path):
    if not os.path.exists(file_path):
        print(f"Erro: Arquivo {file_path} não encontrado.")
        return False

    try:
        doc = ezdxf.readfile(file_path)
    except Exception as e:
        print(f"Erro ao ler DXF: {e}")
        return False

    errors = []
    
    # 1. Verificar Prefixos e Cores das Camadas
    for layer in doc.layers:
        name = layer.dxf.name
        color = layer.dxf.color
        
        # Ignorar camadas padrão do sistema e de sistema CAD
        if name == '0' or name.upper().startswith('DEF'):
            continue
            
        if not name.startswith('sisTOPO_'):
            errors.append(f"Camada com prefixo inválido: {name}")
            
        # Verificar cores ACI (exceções para camadas de análise como RISCO ou TIN)
        if "RISCO" not in name and "TIN" not in name and "PONTOS" not in name:
            if color > 7 and color != 8: # 8 é cinza para intermediárias, permitido
                errors.append(f"Camada {name} usa cor fora do padrão técnico (ACI {color})")

    # 2. Verificar Pesos de Linha em Curvas de Nível
    if 'sisTOPO_CURVAS_NIVEL_MESTRA' in doc.layers:
        l = doc.layers.get('sisTOPO_CURVAS_NIVEL_MESTRA')
        if l.dxf.lineweight != 35: # milímetros * 100
             errors.append(f"Camada TOPO_CURVAS_NIVEL_MESTRA deve ter peso 0.35mm (atual: {l.dxf.lineweight/100}mm)")

    if 'sisTOPO_CURVAS_NIVEL_INTERM' in doc.layers:
        l = doc.layers.get('sisTOPO_CURVAS_NIVEL_INTERM')
        if l.dxf.lineweight != 13:
             errors.append(f"Camada TOPO_CURVAS_NIVEL_INTERM deve ter peso 0.13mm (atual: {l.dxf.lineweight/100}mm)")

    if errors:
        print("\n=== FALHAS NA PADRONIZAÇÃO ABNT ===")
        for err in errors:
            print(f"[-] {err}")
        return False
    else:
        print("\n[+] DXF validado com sucesso conforme padrões ABNT/NBR 13133.")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python verify_abnt_standards.py <path_ao_dxf>")
    else:
        success = verify_dxf(sys.argv[1])
        sys.exit(0 if success else 1)
