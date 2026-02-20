"""
run_acad_validation.py — Orquestrador de testes nativos AutoCAD (Headless).
Cumpre a regra inegociável de validar o DXF usando accoreconsole.exe.
Busca automática da instalação do AutoCAD no sistema Windows.
"""
import os
import subprocess
import glob
from pathlib import Path

def find_accoreconsole():
    """Busca o executável accoreconsole nos caminhos padrão da Autodesk."""
    paths = [
        "C:\\Program Files\\Autodesk\\AutoCAD 20*\\accoreconsole.exe",
        "C:\\Program Files\\Autodesk\\AutoCAD LT 20*\\accoreconsole.exe"
    ]
    for p in paths:
        found = glob.glob(p)
        if found:
            return sorted(found, reverse=True)[0] # Pega a versão mais recente
    return None

def validate_dxf(dxf_path):
    """Executa o AutoCAD headless para auditar o DXF."""
    accore = find_accoreconsole()
    if not accore:
        return False, "AutoCAD (accoreconsole.exe) não encontrado no sistema."

    script_path = os.path.join(os.path.dirname(__file__), "acad_audit.scr")
    if not os.path.exists(script_path):
        return False, f"Script de auditoria ausente: {script_path}"

    try:
        # Comando: accoreconsole.exe /i "arquivo.dxf" /s "script.scr"
        cmd = [
            accore,
            "/i", os.path.abspath(dxf_path),
            "/s", script_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        # O AutoCAD reporta erros no stdout/err
        if "Audit fixing" in result.stdout or "0 errors found" in result.stdout:
            # Verifica se gerou log de erro
            err_log = dxf_path.replace(".dxf", ".err")
            if os.path.exists(err_log):
                with open(err_log, 'r') as f:
                    content = f.read()
                    if "Total errors found 0" in content:
                        return True, "Validado com sucesso pelo AutoCAD."
                    return False, f"Erros encontrados no DXF: {content}"
            return True, "Validado estruturalmente (sem erros fatais)."
        
        return False, f"Falha na validação AutoCAD: {result.stdout[:500]}"

    except subprocess.TimeoutExpired:
        return False, "Timeout na validação AutoCAD (60s excedidos)."
    except Exception as e:
        return False, f"Erro ao executar validação: {str(e)}"

if __name__ == "__main__":
    # Teste simples com o último DXF gerado em tests/
    test_dxf = "py_engine/tests/test_output.dxf"
    if os.path.exists(test_dxf):
        success, msg = validate_dxf(test_dxf)
        print(f"RESULTADO: {'SUCESSO' if success else 'FALHA'}")
        print(f"MSG: {msg}")
    else:
        print("Arquivo de teste não encontrado. Gere um DXF primeiro.")
