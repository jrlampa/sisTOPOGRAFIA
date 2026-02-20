import os

LAYERS = [
    'EDIFICACAO_HATCH', 'EDIFICACAO', 'VIAS_MEIO_FIO', 'VIAS', 'VEGETACAO',
    'MOBILIARIO_URBANO', 'EQUIPAMENTOS', 'INFRA_POWER_HV', 'INFRA_POWER_LV',
    'INFRA_TELECOM', 'TOPOGRAFIA_CURVAS_TEXTO', 'TOPOGRAFIA_CURVAS',
    'MALHA_COORD', 'ANNOT_AREA', 'ANNOT_LENGTH', 'ANNOT_STAMP', 'LEGENDA',
    'TEXTO', 'CURVAS_NIVEL_MESTRA', 'CURVAS_NIVEL_INTERM', 'QUADRO',
    'TERRENO_PONTOS', 'TERRAIN_CONTOUR_LABEL'
]

# Sort by length descending to prevent partial replacements (e.g. VIAS vs VIAS_MEIO_FIO)
LAYERS.sort(key=len, reverse=True)

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = False
    new_content = content
    for layer in LAYERS:
        # We replace the exact string representation in python
        # So we only touch hardcoded strings. e.g. 'EDIFICACAO' or "EDIFICACAO"
        sq = f"'{layer}'"
        sq_new = f"'sisTOPO_{layer}'"
        
        dq = f'"{layer}"'
        dq_new = f'"sisTOPO_{layer}"'
        
        if sq in new_content or dq in new_content:
            new_content = new_content.replace(sq, sq_new)
            new_content = new_content.replace(dq, dq_new)
            modified = True
            
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk(r'c:\sisTOPOGRAFIA\sisTOPOGRAFIA\sisTOPOGRAFIA\py_engine'):
    for f in files:
        if f.endswith('.py') and f != 'constants.py' and f != 'dxf_styles.py':
            process_file(os.path.join(root, f))

print("DONE")
