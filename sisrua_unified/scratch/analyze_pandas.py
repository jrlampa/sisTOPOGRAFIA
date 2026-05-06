import pandas as pd
import os

file_path = r"C:\Users\jonat\OneDrive - IM3 Brasil\LIGHT\PROJETOS\CACUIA - RUA PEDREIRA - NOVA IGUAÇU\CQT - CACUIA - RUA PEDREIRA - NOVA IGUAÇU - ZNA1.xlsm"

def analyze_with_pandas(path):
    try:
        # Read the first 100 rows of the sheet
        df = pd.read_excel(path, sheet_name='QDT Dutra 2.3 Lado Esquerdo', header=None, nrows=100)
        
        # Save to a text file for manual inspection
        output_path = r"c:\Users\jonat\OneDrive - IM3 Brasil\utils\sisTOPOGRAFIA\sisrua_unified\scratch\qdt_head.txt"
        df.to_csv(output_path, sep='\t', index=False)
        print(f"Saved head to {output_path}")
        
        # Also let's try to find headers automatically
        for i, row in df.iterrows():
            row_str = " ".join([str(val).upper() for val in row.values if pd.notnull(val)])
            if "PONTO" in row_str and ("IB" in row_str or "CABO" in row_str):
                print(f"Potential header at row {i}: {row_str}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_with_pandas(file_path)
