"""
Script para extrair dados de condutores, postes e método de cálculo de tração.
Versão robusta que trata merged cells.
"""

import sys
from openpyxl import load_workbook
from pathlib import Path
import pandas as pd
import json
import re

excel_path = Path(r"C:\Users\jonat\Downloads\CALC TRAÇÃO\GD - IMPACT CONSULTORIA LTDA - UFV ESTIMA__PARTE_3_POSTE_22.xlsm")

if not excel_path.exists():
    print(f"❌ Arquivo não encontrado: {excel_path}")
    sys.exit(1)

print(f"📂 Abrindo arquivo: {excel_path}\n")

try:
    # Carregar com pandas para facilitar análise
    xls = pd.ExcelFile(excel_path)
    
    print("=" * 80)
    print("RESUMO DAS ABAS")
    print("=" * 80)
    for sheet_name in xls.sheet_names:
        print(f"  • {sheet_name}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # EXTRAIR DADOS DE CONDUTORES (Plan1)
    # ─────────────────────────────────────────────────────────────────────────
    
    print("\n" + "=" * 80)
    print("DADOS DE CONDUTORES (Plan1)")
    print("=" * 80)
    
    df_plan1 = pd.read_excel(excel_path, sheet_name='Plan1', header=None)
    print(f"\nDimensões: {df_plan1.shape}")
    print("\nPrimeiras 20 linhas (sem filtro):")
    print(df_plan1.iloc[:20, :10].to_string())
    
    # Buscar linhas com "CONDUTOR"
    print("\n\nBuscando linhas com dados de condutores...")
    
    conductors = []
    for idx, row in df_plan1.iterrows():
        col_c = row.get(2) if len(row) > 2 else None  # Coluna C
        
        if col_c and isinstance(col_c, str):
            col_c = col_c.strip()
            
            # Padrões de condutores
            patterns = [
                r'^\d+MCM',
                r'^[0-9]+/0\s*AWG',
                r'^\d+mm²',
                r'MTX',
                r'CAA|CA',
                r'XLPE|PVC'
            ]
            
            if any(re.search(p, col_c, re.IGNORECASE) for p in patterns):
                # Extrair dados
                diameter = row.get(3) if len(row) > 3 else None
                weight = row.get(4) if len(row) > 4 else None
                qty = row.get(5) if len(row) > 5 else None
                
                conductor = {
                    'name': col_c,
                    'diameter_m': diameter,
                    'weight_kg_per_m': weight,
                    'quantity': qty,
                }
                
                conductors.append(conductor)
                print(f"\n✓ {col_c}")
                print(f"  Diâmetro: {diameter}")
                print(f"  Peso: {weight} Kg/m")
                print(f"  Quantidade de cabos: {qty}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # PROCURAR POR DADOS DE POSTES
    # ─────────────────────────────────────────────────────────────────────────
    
    print("\n\n" + "=" * 80)
    print("PROCURANDO POR DADOS DE POSTES")
    print("=" * 80)
    
    # Verificar se há coluna com "poste" ou "altura"
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
        
        # Buscar células que mencionem poste/altura/esforço
        for idx, row in df.iterrows():
            for col_idx, val in enumerate(row):
                if val and isinstance(val, str):
                    if any(term in val.lower() for term in ['poste', 'altura', 'esforço', 'height', 'effort']):
                        print(f"\n📌 Encontrado em {sheet_name} (linha {idx + 1}, col {col_idx}):")
                        print(f"   {val}")
                        
                        # Mostrar contexto (próximas linhas e colunas)
                        print(f"   Contexto:")
                        for r in range(max(0, idx - 2), min(len(df), idx + 5)):
                            print(f"     {df.iloc[r, max(0, col_idx - 1):min(len(df.columns), col_idx + 3)].values}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # PROCURAR PELO MÉTODO DE CÁLCULO DE TRAÇÃO
    # ─────────────────────────────────────────────────────────────────────────
    
    print("\n\n" + "=" * 80)
    print("PROCURANDO POR MÉTODO DE CÁLCULO DE TRAÇÃO")
    print("=" * 80)
    
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
        
        # Buscar menções de tração, tensão, fórmula, cálculo
        for idx, row in df.iterrows():
            for col_idx, val in enumerate(row):
                if val and isinstance(val, str):
                    if any(term in val.lower() for term in ['tração', 'traction', 'fórmula', 'formula', 'método', 'method', 'tensão', 'tension']):
                        print(f"\n📌 Encontrado em {sheet_name} (linha {idx + 1}, col {col_idx}):")
                        print(f"   {val}")
                        
                        # Mostrar contexto
                        context_start = max(0, idx - 2)
                        context_end = min(len(df), idx + 10)
                        context_cols = max(0, col_idx - 2)
                        context_cols_end = min(len(df.columns), col_idx + 5)
                        
                        print(f"\n   Contexto:")
                        for r in range(context_start, context_end):
                            print(f"     {df.iloc[r, context_cols:context_cols_end].values}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # SALVAR DADOS EXTRAÍDOS
    # ─────────────────────────────────────────────────────────────────────────
    
    print("\n\n" + "=" * 80)
    print("RESUMO DOS DADOS EXTRAÍDOS")
    print("=" * 80)
    
    print(f"\n✓ Total de condutores encontrados: {len(conductors)}")
    
    # Salvar em JSON para análise posterior
    output_json = {
        'conductors': conductors,
        'source_file': str(excel_path),
        'sheets': xls.sheet_names,
    }
    
    with open('extracted_data.json', 'w', encoding='utf-8') as f:
        json.dump(output_json, f, indent=2, ensure_ascii=False)
    
    print("\n✅ Dados salvos em extracted_data.json")
    print("\n🔍 Próximo passo: análise manual detalhada do arquivo para métodos de cálculo")
    
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
