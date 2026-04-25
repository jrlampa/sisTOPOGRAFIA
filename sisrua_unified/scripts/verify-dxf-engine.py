import sys
import os
import ezdxf
import geopandas as gpd
import osmnx as ox
import pandas as pd
from shapely.geometry import Point

def verify_dxf_engine():
    print("--- SISRUA DXF Engine Verification ---")
    
    # 1. Check Python Version
    print(f"Python Version: {sys.version}")
    
    # 2. Check Libraries
    libs = [
        ("ezdxf", ezdxf.__version__),
        ("geopandas", gpd.__version__),
        ("osmnx", ox.__version__),
        ("pandas", pd.__version__)
    ]
    
    for name, version in libs:
        print(f"✅ {name}: {version}")
        
    # 3. Test Geometry Operations
    try:
        p1 = Point(0, 0)
        p2 = Point(1, 1)
        dist = p1.distance(p2)
        print(f"✅ Shapely/Geopandas Geometry Test: OK (dist={dist:.4f})")
    except Exception as e:
        print(f"❌ Geometry Test FAILED: {str(e)}")
        
    # 4. Test DXF Creation
    try:
        doc = ezdxf.new('R2010')
        msp = doc.modelspace()
        msp.add_line((0, 0), (10, 10))
        
        test_file = "/app/public/dxf/test_connection.dxf"
        doc.saveas(test_file)
        
        if os.path.exists(test_file):
            print(f"✅ DXF Write Test: OK ({test_file})")
            os.remove(test_file)
        else:
            print("❌ DXF Write Test FAILED: File not created")
    except Exception as e:
        print(f"❌ DXF Write Test FAILED: {str(e)}")
        
    print("--- Verification Complete ---")

if __name__ == "__main__":
    verify_dxf_engine()
