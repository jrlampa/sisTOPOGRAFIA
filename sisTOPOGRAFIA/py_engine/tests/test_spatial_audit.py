import pytest
import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spatial_audit import run_spatial_audit

def test_spatial_audit_no_data():
    """Test audit with empty GDF."""
    gdf = gpd.GeoDataFrame()
    summary, analysis_gdf = run_spatial_audit(gdf)
    assert summary == {}
    assert analysis_gdf.empty

def test_violation_detection():
    """Test detection of building inside power line buffer."""
    # Power line (LineString)
    pl = LineString([(0,0), (10,0)])
    # Building inside (5m buffer)
    b_inside = Polygon([(5,1), (6,1), (6,2), (5,2)])
    # Building outside
    b_outside = Polygon([(5,10), (6,10), (6,11), (5,11)])
    
    data = {
        'geometry': [pl, b_inside, b_outside],
        'power': ['line', None, None],
        'building': [None, True, True]
    }
    gdf = gpd.GeoDataFrame(data, crs="EPSG:3857")
    
    summary, analysis_gdf = run_spatial_audit(gdf)
    
    assert summary['violations'] == 1
    assert 'violations_list' in summary
    violations = summary['violations_list']
    assert len(violations) == 1
    assert violations[0]['type'] == 'proximity'
    assert "within 5.0m of power line" in violations[0]['description']
    # Check coordinate propagation (within building bounds approx)
    assert isinstance(violations[0]['lat'], float)
    assert isinstance(violations[0]['lon'], float)
    
    assert 'analysis_type' in analysis_gdf.columns
    assert len(analysis_gdf[analysis_gdf['analysis_type'] == 'buffer']) == 1

def test_lighting_coverage():
    """Test lighting coverage score calculation."""
    # Road of 100m
    road = LineString([(0,0), (100,0)])
    # 2 lamps (Ideal is 100/30 = 3.33)
    # Score should be (2 / 3.33) * 100 approx 60%
    lamp1 = Point(10, 0)
    lamp2 = Point(40, 0)
    
    data = {
        'geometry': [road, lamp1, lamp2],
        'feature_type': ['highway', 'lamp', 'lamp'],
        'highway': ['residential', 'street_lamp', 'street_lamp']
    }
    gdf = gpd.GeoDataFrame(data)
    
    summary, _ = run_spatial_audit(gdf)
    
    assert 50 < summary['coverageScore'] < 70
    assert summary['violations'] == 0

def test_analysis_layers_output():
    """Test if analysis features are correctly generated."""
    lamp = Point(0,0)
    data = {
        'geometry': [lamp],
        'highway': ['street_lamp']
    }
    gdf = gpd.GeoDataFrame(data)
    
    _, analysis_gdf = run_spatial_audit(gdf)
    
    assert not analysis_gdf.empty
    assert analysis_gdf.iloc[0]['analysis_type'] == 'coverage'
    # Check if buffer radius is correct (15m radius circle area approx 706)
    assert 700 < analysis_gdf.iloc[0].geometry.area < 710


def test_combine_features_with_empty_list():
    """_combine_analysis_features([]) deve retornar GeoDataFrame vazio (linha 118)."""
    from spatial_audit import _combine_analysis_features
    result = _combine_analysis_features([], crs=None)
    assert result.empty
    assert 'geometry' in result.columns


def test_combine_features_concat_exception_returns_first():
    """_combine_analysis_features com concat lançando exceção: retorna o primeiro item (linhas 124-126)."""
    import geopandas as gpd
    from shapely.geometry import Point
    from unittest.mock import patch
    from spatial_audit import _combine_analysis_features

    gdf1 = gpd.GeoDataFrame({'geometry': [Point(0, 0)], 'analysis_type': ['buffer']})
    gdf2 = gpd.GeoDataFrame({'geometry': [Point(1, 1)], 'analysis_type': ['coverage']})

    with patch('spatial_audit.gpd.pd.concat', side_effect=Exception("concat falhou")):
        result = _combine_analysis_features([gdf1, gdf2], crs=None)

    assert not result.empty
    # Deve retornar o primeiro item como fallback
    assert len(result) == 1


def test_audit_power_line_proximity_exception_returns_empty():
    """_audit_power_line_proximity com operação que lança exceção retorna 0, [], None (linhas 110-112)."""
    import geopandas as gpd
    from shapely.geometry import LineString, Polygon
    from unittest.mock import patch
    from spatial_audit import _audit_power_line_proximity

    power_lines = gpd.GeoDataFrame(
        {'geometry': [LineString([(0, 0), (10, 0)])], 'power': ['line']},
        crs='EPSG:3857'
    )
    buildings = gpd.GeoDataFrame(
        {'geometry': [Polygon([(5, 1), (6, 1), (6, 2), (5, 2)])], 'building': [True]},
        crs='EPSG:3857'
    )

    # Patching gpd.GeoSeries no módulo spatial_audit faz o to_crs() lançar exceção
    # durante a criação do ponto de reporte (linha 99), após violations_count ser incrementado
    with patch('spatial_audit.gpd.GeoSeries', side_effect=Exception("GeoSeries falhou")):
        count, vlist, buffers = _audit_power_line_proximity(power_lines, buildings, 'EPSG:3857')

    # O except (linhas 110-112) deve retornar 0, [], None
    assert count == 0
    assert vlist == []
    assert buffers is None


def test_calculate_lighting_score_zero_length_road():
    """Road com geometria Point (comprimento=0): _calculate_lighting_score retorna 0 (linha 136)."""
    import geopandas as gpd
    from shapely.geometry import Point
    from spatial_audit import _calculate_lighting_score

    # Road como ponto tem length=0
    roads = gpd.GeoDataFrame(
        {'geometry': [Point(0, 0)], 'feature_type': ['highway']}
    )
    lamps = gpd.GeoDataFrame(columns=['geometry'])

    score = _calculate_lighting_score(roads, lamps)
    assert score == 0
