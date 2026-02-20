import os
import argparse
import geopandas as gpd
import fiona

def extract_and_convert_kml(input_file: str, output_file: str, layer_type='UC_MUNICIPAL', year=2025):
    """
    Reads a KML/KMZ file, sanitizes its geometries and properties, 
    and saves it as an optimized GeoJSON for offline fallback cache.
    """
    if not os.path.exists(input_file):
        print(f"Error: KML/KMZ file not found at {input_file}")
        return False

    print(f"Starting conversion of {input_file}...")
    
    # Needs driver support for KML
    fiona.drvsupport.supported_drivers['KML'] = 'rw'
    fiona.drvsupport.supported_drivers['LIBKML'] = 'rw'
    
    try:
        # Load the raw file
        gdf = gpd.read_file(input_file, driver='KML')
        
        # Metadata Enrichment
        gdf['sisTOPO_type'] = layer_type
        gdf['vintage_year'] = year
        
        # Output as optimized GeoJSON
        gdf.to_file(output_file, driver='GeoJSON')
        
        print(f"Success! Optimized cache saved to: {output_file}")
        print(f"Total features converted: {len(gdf)}")
        return True
        
    except Exception as e:
        print(f"Failed to process KMZ/KML: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compile KMZ files to GeoJSON cache")
    parser.add_argument("input", help="Path to input KMZ or KML file")
    parser.add_argument("output", help="Path to output GeoJSON file")
    parser.add_argument("--type", default="UC_MUNICIPAL", help="Type of environmental layer (e.g. UC_ESTADUAL)")
    parser.add_argument("--year", default=2025, type=int, help="Vintage year of the data")
    
    args = parser.parse_args()
    extract_and_convert_kml(args.input, args.output, args.type, args.year)
