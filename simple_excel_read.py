"""
Simples extração dos dados do Excel em formato texto legível.
"""

from openpyxl import load_workbook
from pathlib import Path
import pandas as pd

excel_path = Path(r"C:\Users\jonat\Downloads\CALC TRAÇÃO\GD - IMPACT CONSULTORIA LTDA - UFV ESTIMA__PARTE_3_POSTE_22.xlsm")

# Ler com pandas de forma simples
print("CONDUTORES - Plan1:")
print("=" * 80)
df1 = pd.read_excel(excel_path, sheet_name='Plan1', header=None)
print(df1.iloc[:30, :8].to_string())

print("\n\nOPÇÕES DE REDE - Plan4:")
print("=" * 80)
df4 = pd.read_excel(excel_path, sheet_name='Plan4', header=None)
print(df4.iloc[:20, :8].to_string())

print("\n\nDADOS DE PROJETO - Ponto (1) - Primeiras 40 linhas:")
print("=" * 80)
dfp = pd.read_excel(excel_path, sheet_name='Ponto (1)', header=None)
print(dfp.iloc[:40, :10].to_string())

print("\n\nDADOS NUMÉRICOS EM Ponto (1):")
print("=" * 80)
for idx in range(min(80, len(dfp))):
    for col in range(min(12, len(dfp.columns))):
        val = dfp.iloc[idx, col]
        if isinstance(val, (int, float)) and not pd.isna(val) and val != 0:
            # Procurar label na coluna anterior ou anteriormente
            label = ""
            if col > 0:
                prev_val = dfp.iloc[idx, col - 1]
                if isinstance(prev_val, str):
                    label = prev_val
            print(f"L{idx+1:3d}:C{col+1:2d} = {val:15} | Label: {label}")

print("\n\n✅ Concluído")
