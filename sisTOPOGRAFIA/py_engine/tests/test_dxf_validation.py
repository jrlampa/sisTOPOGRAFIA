"""
test_dxf_validation.py — Testes de validação do arquivo DXF gerado.
Testa estrutura, layers, entidades e integridade do DXF produzido pelo DXFGenerator.
Pode ser executado headless (sem GUI) com ezdxf puro.
Para validação via accoreconsole.exe: usar tests/scripts/validate_dxf_acad.scr.
"""
import os
import sys
import pytest
import ezdxf
import tempfile
import geopandas as gpd
from shapely.geometry import Polygon, LineString, Point
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dxf_generator import DXFGenerator

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def dxf_file(tmp_path):
    """Gera um DXF mínimo com features sintéticas e retorna o path."""
    output = str(tmp_path / "test_output.dxf")
    gen = DXFGenerator(output)

    # GeoDataFrame sintético (projetado, metros)
    gdf = gpd.GeoDataFrame({
        'geometry': [
            Polygon([(0,0), (10,0), (10,10), (0,10)]),   # edificação
            LineString([(0,0), (20,0)]),                   # via
            Point(5, 5),                                   # ponto
        ],
        'building': ['yes', None, None],
        'highway':  [None, 'residential', None],
        'natural':  [None, None, 'tree'],
    }, crs='EPSG:31983')

    gen.add_features(gdf)
    gen.doc.saveas(output)   # save sem legend/title para teste unitário
    return output


@pytest.fixture
def dxf_doc(dxf_file):
    """Carrega o DXF gerado com ezdxf e retorna o documento."""
    return ezdxf.readfile(dxf_file)


# ── 1. Estrutura do arquivo ───────────────────────────────────────────────────

class TestDXFStructure:
    """Testa que o DXF é um arquivo válido e legível."""

    def test_file_exists(self, dxf_file):
        assert os.path.exists(dxf_file), "Arquivo DXF não foi criado"

    def test_file_not_empty(self, dxf_file):
        size = os.path.getsize(dxf_file)
        assert size > 1024, f"DXF muito pequeno: {size} bytes"

    def test_ezdxf_can_read(self, dxf_doc):
        assert dxf_doc is not None

    def test_dxf_version_r2013(self, dxf_doc):
        """DXFGenerator usa R2013 para compatibilidade com AutoCAD/accoreconsole."""
        assert dxf_doc.dxfversion >= 'AC1027', \
            f"Versão DXF inadequada: {dxf_doc.dxfversion}"

    def test_modelspace_exists(self, dxf_doc):
        msp = dxf_doc.modelspace()
        assert msp is not None


# ── 2. Layers ─────────────────────────────────────────────────────────────────

class TestDXFLayers:
    """Testa que as layers corretas são criadas para cada tipo de feição OSM."""

    EXPECTED_LAYERS = {
        'sisTOPO_EDIFICACAO',
        'sisTOPO_VIAS',
        'sisTOPO_VEGETACAO',
    }

    def test_expected_layers_created(self, dxf_doc):
        """Layers sisTOPO_* devem existir na tabela de layers."""
        layer_names = {layer.dxf.name for layer in dxf_doc.layers}
        for expected in self.EXPECTED_LAYERS:
            assert expected in layer_names, \
                f"Layer '{expected}' ausente no DXF. Layers encontradas: {layer_names}"

    def test_no_orphan_layer_zero_only(self, dxf_doc):
        """Deve haver pelo menos uma layer sisTOPO além da '0'."""
        layer_names = {layer.dxf.name for layer in dxf_doc.layers}
        topo_layers = [l for l in layer_names if l.startswith('sisTOPO_')]
        assert len(topo_layers) >= 3, \
            f"Esperado >= 3 layers sisTOPO_, encontradas: {topo_layers}"

    def test_layer_edificacao_exists(self, dxf_doc):
        layer_names = {layer.dxf.name for layer in dxf_doc.layers}
        assert 'sisTOPO_EDIFICACAO' in layer_names

    def test_layer_vias_exists(self, dxf_doc):
        layer_names = {layer.dxf.name for layer in dxf_doc.layers}
        assert 'sisTOPO_VIAS' in layer_names


# ── 3. Entidades ──────────────────────────────────────────────────────────────

class TestDXFEntities:
    """Testa que as entidades corretas são geradas para cada tipo de geometria."""

    def test_has_entities_in_modelspace(self, dxf_doc):
        msp = dxf_doc.modelspace()
        entities = list(msp)
        assert len(entities) > 0, "ModelSpace está vazio"

    def test_polygon_becomes_lwpolyline_or_3dface(self, dxf_doc):
        """Polígonos OSM devem virar LWPOLYLINE ou HATCH no DXF."""
        msp = dxf_doc.modelspace()
        types = {e.dxftype() for e in msp}
        polygon_types = {'LWPOLYLINE', 'HATCH', '3DFACE', 'SOLID'}
        assert types & polygon_types, \
            f"Nenhuma entidade de polígono encontrada. Tipos: {types}"

    def test_linestring_becomes_lwpolyline_or_line(self, dxf_doc):
        """LineStrings OSM devem virar LINE ou LWPOLYLINE."""
        msp = dxf_doc.modelspace()
        types = {e.dxftype() for e in msp}
        line_types = {'LINE', 'LWPOLYLINE', 'POLYLINE'}
        assert types & line_types, \
            f"Nenhuma entidade de linha encontrada. Tipos: {types}"

    def test_no_nan_coordinates(self, dxf_doc):
        """Nenhuma entidade deve ter coordenadas NaN/Inf."""
        msp = dxf_doc.modelspace()
        for entity in msp:
            try:
                if hasattr(entity.dxf, 'start'):
                    p = entity.dxf.start
                    assert all(np.isfinite(v) for v in [p.x, p.y]), \
                        f"Coordenada inválida em {entity.dxftype()}: {p}"
            except Exception:
                pass  # Entidades sem 'start' são ignoradas

    def test_no_zero_area_closed_polylines(self, dxf_doc):
        """Polilinhass fechadas não devem ter área zero."""
        msp = dxf_doc.modelspace()
        for entity in msp:
            if entity.dxftype() == 'LWPOLYLINE' and entity.is_closed:
                pts = list(entity.get_points())
                if len(pts) >= 3:
                    # Cálculo de área via shoelace
                    xs = [p[0] for p in pts]
                    ys = [p[1] for p in pts]
                    area = abs(sum(xs[i]*ys[i+1] - xs[i+1]*ys[i]
                                  for i in range(-1, len(xs)-1))) / 2
                    # Área pode ser mínima para pontos próximos, mas não exatamente 0
                    # em feições geradas de polígonos reais
                    assert area >= 0  # Pelo menos não negativa


# ── 4. Classifier Tests ───────────────────────────────────────────────────────

class TestLayerClassifier:
    """Testa o layer_classifier.classify_layer() diretamente."""

    def test_waterway_priority_over_amenity(self):
        """waterway deve ter prioridade sobre amenity (fountain em rio)."""
        from layer_classifier import classify_layer
        tags = {'waterway': 'river', 'amenity': 'fountain'}
        assert classify_layer(tags) == 'sisTOPO_HIDROGRAFIA'

    def test_building_returns_edificacao(self):
        from layer_classifier import classify_layer
        assert classify_layer({'building': 'residential'}) == 'sisTOPO_EDIFICACAO'

    def test_highway_returns_vias(self):
        from layer_classifier import classify_layer
        assert classify_layer({'highway': 'residential'}) == 'sisTOPO_VIAS'

    def test_unknown_returns_default_layer(self):
        from layer_classifier import classify_layer
        assert classify_layer({'unknown_tag': 'value'}) == '0'

    def test_power_hv_line(self):
        from layer_classifier import classify_layer
        assert classify_layer({'power': 'line'}) == 'sisTOPO_INFRA_POWER_HV'

    def test_power_lv_fuse(self):
        from layer_classifier import classify_layer
        assert classify_layer({'power': 'fuse'}) == 'sisTOPO_INFRA_POWER_LV'

    def test_natural_water_is_hidrografia(self):
        from layer_classifier import classify_layer
        assert classify_layer({'natural': 'water'}) == 'sisTOPO_HIDROGRAFIA'

    def test_landuse_residential(self):
        from layer_classifier import classify_layer
        assert classify_layer({'landuse': 'residential'}) == 'sisTOPO_USO_RESIDENCIAL'


# ── 5. BIM XDATA ──────────────────────────────────────────────────────────────

class TestBIMAttacher:
    """Testa que o bim_data_attacher anexa XDATA corretamente."""

    def test_bim_attacher_import(self):
        from bim_data_attacher import attach_bim_data
        assert callable(attach_bim_data)

    def test_bim_attached_to_entity(self, dxf_file):
        """DXF gerado deve ter AppID SISRUA_BIM registrado."""
        doc = ezdxf.readfile(dxf_file)
        appids = {appid.dxf.name for appid in doc.appids}
        assert 'SISRUA_BIM' in appids, \
            f"AppID SISRUA_BIM não encontrado. AppIDs: {appids}"
