import sys
import os
from pathlib import Path
from pyproj import Proj

sys.path.append(r"c:\sisTOPOGRAFIA\sisTOPOGRAFIA\sisTOPOGRAFIA\py_engine")

try:
    from controller import SisTopografiaController
except Exception as e:
    import traceback
    print(f"Could not import SisTopografiaController: {e}")
    traceback.print_exc()
    sys.exit(1)

# Ponto UTM enviado: 24K, 0196363, 7480161
# Faixa K é hemisfério Sul. 
p = Proj(proj='utm', zone=24, ellps='WGS84', south=True)
lon, lat = p(196363.0, 7480161.0, inverse=True)

print(f"=== INICIANDO EXTRACAO ===")
print(f"Coordenadas convertidas -> Lat: {lat}, Lon: {lon}")
print(f"Raio: 2000 metros")
print(f"Exportando para: C:\\Users\\jonat\\Downloads\\")

try:
    controller = SisTopografiaController(
        lat=lat,
        lon=lon,
        radius=2000,
        layers_config={'all': True} # Ativando fallback total
    )
    
    # Injetando um path de saida modificado se a API permitir. Caso o export_dir for hardcoded
    # vamos pegar o retorno e copiar se precisar.
    
    result_path = controller.run()
    print(f"Processo finalizado com sucesso! DXF Gerado em: {result_path}")
    
    # Copiar para downloads caso nao for gerado la
    import shutil
    if result_path and os.path.exists(result_path):
        dest = os.path.join(r"C:\Users\jonat\Downloads", os.path.basename(result_path))
        shutil.copy2(result_path, dest)
        print(f"Copiado para destino do usuário: {dest}")
        print("DXF PRONTO.")

except Exception as e:
    import traceback
    print(f"ERRO FATAL: {e}")
    traceback.print_exc()
