import pytest
import ezdxf
from shapely.geometry import Polygon, Point, LineString
import geopandas as gpd
import pandas as pd
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator


@pytest.fixture
def dxf_gen(tmp_path):
    output_file = tmp_path / "test.dxf"
    return DXFGenerator(str(output_file))


def test_layer_creation(dxf_gen):
    """Test if standard layers are created."""
    assert "EDIFICACAO" in dxf_gen.doc.layers
    assert "VIAS" in dxf_gen.doc.layers
    assert "VEGETACAO" in dxf_gen.doc.layers


def test_block_creation(dxf_gen):
    """Test if blocks are created."""
    assert "ARVORE" in dxf_gen.doc.blocks
    assert "POSTE" in dxf_gen.doc.blocks
    assert "BT_POSTE" in dxf_gen.doc.blocks
    assert "BT_TRAFO_INV" in dxf_gen.doc.blocks


def test_building_extrusion(dxf_gen):
    """Test if building height is correctly calculated from tags."""
    # Mock data
    poly = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])

    # Case 1: Specific height
    tags1 = {"building": "yes", "height": "15"}
    thickness1 = dxf_gen._get_thickness(tags1, "EDIFICACAO")
    assert thickness1 == 15.0

    # Case 2: Levels
    tags2 = {"building": "yes", "building:levels": "4"}
    thickness2 = dxf_gen._get_thickness(tags2, "EDIFICACAO")
    assert thickness2 == 12.0  # 4 * 3.0

    # Case 3: Default
    tags3 = {"building": "yes"}
    thickness3 = dxf_gen._get_thickness(tags3, "EDIFICACAO")
    assert thickness3 == 3.5


def test_add_features(dxf_gen):
    """Test adding features to DXF."""
    # Create valid GeoDataFrame
    data = {
        "geometry": [Point(0, 0), LineString([(0, 0), (10, 10)])],
        "building": [None, None],
        "highway": [None, "residential"],
        "natural": ["tree", None],
    }
    gdf = gpd.GeoDataFrame(data)

    dxf_gen.add_features(gdf)

    # Check if entities exist in modelspace
    # Note: ezdxf entities need to be queried
    msp = dxf_gen.msp
    assert len(msp) > 0


def test_legend_and_title_block(dxf_gen):
    """Test if Legend and Title Block are generated during save."""
    # Add some features to populate layers
    data = {"geometry": [Point(0, 0)], "building": [True]}
    gdf = gpd.GeoDataFrame(data)
    dxf_gen.add_features(gdf)

    dxf_gen.project_info = {"client": "TEST CLIENT", "project": "TEST PROJECT"}
    dxf_gen.save()

    # Check ModelSpace for Legend entities (TEXT or MTEXT)
    msp_text = [e.dxf.text for e in dxf_gen.msp if e.dxftype() in ("TEXT", "MTEXT")]
    assert any("LEGENDA" in t for t in msp_text)

    # Check PaperSpace (Layout1) for Title Block components
    layout = dxf_gen.doc.layout("Layout1")
    # Should have a viewport
    viewports = [e for e in layout if e.dxftype() == "VIEWPORT"]
    assert len(viewports) >= 1

    # Should have Title Block lines/text
    layout_text = [e.dxf.text for e in layout if e.dxftype() in ("TEXT", "MTEXT")]
    assert any("TEST CLIENT" in t for t in layout_text)
    assert any("TEST PROJECT" in t for t in layout_text)


def test_bt_summary_panel_is_generated(dxf_gen):
    """Test if BT summary data is rendered into model space when BT context is provided."""
    data = {"geometry": [Point(0, 0)], "building": [True]}
    gdf = gpd.GeoDataFrame(data)
    dxf_gen.add_features(gdf)

    dxf_gen.bt_context = {
        "projectType": "ramais",
        "btNetworkScenario": "asis",
        "totalPoles": 4,
        "totalEdges": 3,
        "totalTransformers": 1,
        "verifiedPoles": 2,
        "verifiedEdges": 1,
        "verifiedTransformers": 1,
        "criticalPole": {
            "poleId": "P3",
            "accumulatedClients": 12,
            "accumulatedDemandKva": 18.75,
        },
        "accumulatedByPole": [
            {
                "poleId": "P3",
                "accumulatedClients": 12,
                "accumulatedDemandKva": 18.75,
                "localClients": 3,
                "localTrechoDemandKva": 4.5,
            },
            {
                "poleId": "P1",
                "accumulatedClients": 8,
                "accumulatedDemandKva": 12.00,
                "localClients": 2,
                "localTrechoDemandKva": 3.0,
            },
            {
                "poleId": "P2",
                "accumulatedClients": 4,
                "accumulatedDemandKva": 6.25,
                "localClients": 4,
                "localTrechoDemandKva": 6.25,
            },
        ],
    }

    dxf_gen.save()

    msp_text = [e.dxf.text for e in dxf_gen.msp if e.dxftype() in ("TEXT", "MTEXT")]
    assert any("QUADRO BT" in t for t in msp_text)
    assert any("PONTO CRITICO: P3" in t for t in msp_text)
    assert any("POSTES: 2/4" in t for t in msp_text)
    assert any("LISTA COMPLETA POSTE | CLT | kVA" in t for t in msp_text)
    assert any("#1 P3" in t for t in msp_text)
    assert any("#2 P1" in t for t in msp_text)
    assert any("18.75" in t for t in msp_text)


def test_bt_topology_entities_are_drawn(dxf_gen):
    """Test if BT topology geometry is rendered as dedicated DXF entities."""
    data = {"geometry": [Point(0, 0)], "building": [True]}
    gdf = gpd.GeoDataFrame(data)
    dxf_gen.add_features(gdf)

    dxf_gen.bt_context = {
        "topologyProjected": {
            "poles": [
                {
                    "id": "P1",
                    "title": "P1",
                    "x": 10.0,
                    "y": 20.0,
                    "ramais": [
                        {"quantity": 7, "ramalType": "DX 6 AWG"},
                        {"quantity": 3, "ramalType": "QX 6 AWG"},
                    ],
                },
                {"id": "P2", "title": "P2", "x": 30.0, "y": 20.0, "ramais": []},
            ],
            "edges": [
                {
                    "id": "E1",
                    "fromX": 10.0,
                    "fromY": 20.0,
                    "toX": 30.0,
                    "toY": 20.0,
                    "conductors": [{"quantity": 1, "conductorName": "185 Al - MX"}],
                }
            ],
            "transformers": [
                {
                    "id": "T1",
                    "title": "ZNA-000001",
                    "x": 15.0,
                    "y": 10.0,
                    "projectPowerKva": 45.0,
                    "demandKw": 40.0,
                }
            ],
        }
    }

    dxf_gen.add_bt_topology()

    inserts = [entity for entity in dxf_gen.msp if entity.dxftype() == "INSERT"]
    polylines = [entity for entity in dxf_gen.msp if entity.dxftype() == "LWPOLYLINE"]
    texts = [
        entity.dxf.text
        for entity in dxf_gen.msp
        if entity.dxftype() in ("TEXT", "MTEXT")
    ]

    block_names = [entity.dxf.name for entity in inserts]
    polyline_layers = [entity.dxf.layer for entity in polylines]

    assert "BT_POSTE" in block_names
    assert "BT_TRAFO_INV" in block_names
    assert "BT_CONDUTORES" in polyline_layers
    assert any("P1" in text for text in texts)
    assert any("TOTAL: 10" in text for text in texts)
    assert any("7-DX 6 AWG" in text for text in texts)
    assert any("3-QX 6 AWG" in text for text in texts)
    assert any("185 Al - MX" in text for text in texts)
    assert any("ZNA-000001" in text for text in texts)
    assert any("45KVA" in text for text in texts)


def test_save_raises_for_empty_modelspace(dxf_gen):
    """Prevent silent success when no entities were generated."""
    with pytest.raises(RuntimeError, match="model space has no entities"):
        dxf_gen.save()
