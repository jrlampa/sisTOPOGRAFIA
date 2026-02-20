import ezdxf
from ezdxf.enums import TextEntityAlignment

class DXFStyleManager:
    """Manages CAD layers, blocks, and styles to decouple logic from DXFGenerator."""
    
    @staticmethod
    def setup_all(doc, layers_config=None):
        """Initialize all document styles and standards."""
        DXFStyleManager.setup_linetypes(doc)
        DXFStyleManager.setup_text_styles(doc)
        DXFStyleManager.setup_layers(doc, layers_config)
        DXFStyleManager.setup_blocks(doc)
        DXFStyleManager.setup_logo(doc)

    @staticmethod
    def setup_linetypes(doc):
        """Define professional CAD linetypes."""
        if 'DASHED' not in doc.linetypes:
            doc.linetypes.new('DASHED', dxfattribs={'description': 'Dashed', 'pattern': [1.0, -0.5]})
        if 'HIDDEN' not in doc.linetypes:
            doc.linetypes.new('HIDDEN', dxfattribs={'description': 'Hidden', 'pattern': [0.5, -0.25]})

    @staticmethod
    def setup_text_styles(doc):
        """Setup professional typography."""
        if 'PRO_STYLE' not in doc.styles:
            doc.styles.new('PRO_STYLE', dxfattribs={'font': 'arial.ttf'})

    @staticmethod
    def setup_layers(doc, layers_config=None):
        """Define standard engineering layers, filtered by layers_config."""
        # Mapping layers to layers_config keys
        # If layers_config is None, all layers are created (backward compatibility)
        conf = layers_config if layers_config is not None else {}
        is_all = layers_config is None

        layers_map = [
            ('sisTOPO_EDIFICACAO', 7, 0.30, 'buildings'),
            ('sisTOPO_VIAS', 8, 0.15, 'roads'),
            ('sisTOPO_VIAS_MEIO_FIO', 251, 0.09, 'roads'),
            ('sisTOPO_VEGETACAO', 3, 0.13, 'nature'),
            ('sisTOPO_MOBILIARIO_URBANO', 40, 0.15, 'furniture'),
            ('sisTOPO_EQUIPAMENTOS', 4, 0.15, 'equipment'),
            ('sisTOPO_INFRA_POWER_HV', 1, 0.35, 'infrastructure'),
            ('sisTOPO_INFRA_POWER_LV', 30, 0.20, 'infrastructure'),
            ('sisTOPO_INFRA_TELECOM', 94, 0.15, 'infrastructure'),
            ('sisTOPO_TOPOGRAFIA_CURVAS', 252, 0.09, 'terrain'),
            ('sisTOPO_MALHA_COORD', 253, 0.05, 'cartography'),
            ('sisTOPO_ANNOT_AREA', 2, 0.13, 'labels'),
            ('sisTOPO_ANNOT_LENGTH', 2, 0.13, 'labels'),
            ('sisTOPO_LEGENDA', 7, 0.15, 'cartography'),
            ('sisTOPO_TEXTO', 7, 0.15, 'labels'),
            ('sisTOPO_CURVAS_NIVEL_MESTRA', 251, 0.25, 'contours'),
            ('sisTOPO_CURVAS_NIVEL_INTERM', 252, 0.09, 'contours'),
            ('sisTOPO_QUADRO', 7, 0.50, 'cartography'),
            ('sisTOPO_RESTRICAO_APP_30M', 1, 0.35, 'app'),
            ('sisTOPO_USO_RESIDENCIAL', 5, 0.15, 'landuse'),
            ('sisTOPO_USO_COMERCIAL', 6, 0.15, 'landuse'),
            ('sisTOPO_USO_INDUSTRIAL', 8, 0.15, 'landuse'),
            ('sisTOPO_USO_VEGETACAO', 3, 0.15, 'landuse'),
            ('sisTOPO_UC_FEDERAL', 5, 0.50, 'uc'),
            ('sisTOPO_UC_ESTADUAL', 4, 0.50, 'uc'),
            ('sisTOPO_UC_MUNICIPAL', 6, 0.50, 'uc'),
            ('sisTOPO_HIDROGRAFIA', 140, 0.35, 'hydrology'),
            ('sisTOPO_TERRENO_TIN', 251, 0.09, 'generate_tin'),
        ]
        
        # Standard CAD lineweights mapped (mm to internal int)
        def map_weight(w):
            val = int(w * 100)
            weights = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 100, 120, 140, 200, 211]
            return min(weights, key=lambda x:abs(x-val))

        for name, color, lineweight, key in layers_map:
            # Create layer if all mode, OR if key is enabled in config
            # Also support 'vegetation' as alias for 'nature'
            enabled = is_all or conf.get(key, False) or (key == 'nature' and conf.get('vegetation', False))
            
            if enabled and name not in doc.layers:
                doc.layers.new(name, dxfattribs={
                    'color': color,
                    'lineweight': map_weight(lineweight)
                })

    @staticmethod
    def setup_blocks(doc):
        """Define standard engineering blocks/symbols."""
        # ARVORE (Tree)
        if 'ARVORE' not in doc.blocks:
            blk = doc.blocks.new(name='ARVORE')
            blk.add_circle((0, 0), radius=2, dxfattribs={'layer': 'sisTOPO_VEGETACAO', 'color': 3})
            blk.add_line((-1.5, 0), (1.5, 0), dxfattribs={'layer': 'sisTOPO_VEGETACAO'})
            blk.add_line((0, -1.5), (0, 1.5), dxfattribs={'layer': 'sisTOPO_VEGETACAO'})

        # POSTE (Utility Pole)
        if 'POSTE' not in doc.blocks:
            blk = doc.blocks.new(name='POSTE')
            blk.add_circle((0, 0), radius=0.4, dxfattribs={'color': 7})
            blk.add_line((-0.3, -0.3), (0.3, 0.3))
            blk.add_line((-0.3, 0.3), (0.3, -0.3))
            # Attributes must have a tag AND a default value for stability
            blk.add_attdef('ID', (0.5, 0.5), dxfattribs={'height': 0.3, 'color': 2}).dxf.text = "000"
            blk.add_attdef('TYPE', (0.5, 0.1), dxfattribs={'height': 0.2, 'color': 8}).dxf.text = "POLE"
            blk.add_attdef('V_LEVEL', (0.5, -0.3), dxfattribs={'height': 0.2, 'color': 1}).dxf.text = "0V"

        # BANCO (Bench)
        if 'BANCO' not in doc.blocks:
            blk = doc.blocks.new(name='BANCO')
            blk.add_lwpolyline([( -0.8, -0.4), (0.8, -0.4), (0.8, 0.4), (-0.8, 0.4)], close=True)
            blk.add_line((-0.8, 0), (0.8, 0))

        # LIXEIRA (Waste Basket)
        if 'LIXEIRA' not in doc.blocks:
            blk = doc.blocks.new(name='LIXEIRA')
            blk.add_circle((0, 0), radius=0.3)
            blk.add_circle((0, 0), radius=0.1)

        # POSTE_LUZ (Street Lamp)
        if 'POSTE_LUZ' not in doc.blocks:
            blk = doc.blocks.new(name='POSTE_LUZ')
            blk.add_circle((0, 0), radius=0.2, dxfattribs={'color': 2}) # Yellow bulb
            blk.add_circle((0, 0), radius=0.4)

        # TORRE (Power Tower)
        if 'TORRE' not in doc.blocks:
            blk = doc.blocks.new(name='TORRE')
            blk.add_lwpolyline([(-1, -1), (1, -1), (1, 1), (-1, 1)], close=True)
            blk.add_line((-1, -1), (1, 1))
            blk.add_line((-1, 1), (1, -1))
            blk.add_attdef('ID', (1.2, 1.2), dxfattribs={'height': 0.5, 'color': 2})

        # NORTH ARROW
        if 'NORTE' not in doc.blocks:
            blk = doc.blocks.new(name='NORTE')
            blk.add_lwpolyline([(0, 0), (-1, -3), (0, 1), (1, -3)], close=True, dxfattribs={'color': 7})
            blk.add_text("N", dxfattribs={'height': 1.5, 'color': 7}).set_placement((0, 1.5), align=TextEntityAlignment.CENTER)

        # SCALE BAR
        if 'ESCALA' not in doc.blocks:
            blk = doc.blocks.new(name='ESCALA')
            blk.add_lwpolyline([(0, 0), (10, 0), (10, 1), (0, 1)], close=True)
            blk.add_line((5, 0), (5, 1))
            blk.add_text("0", dxfattribs={'height': 1}).set_placement((0, -1.5), align=TextEntityAlignment.CENTER)
            blk.add_text("5m", dxfattribs={'height': 1}).set_placement((5, -1.5), align=TextEntityAlignment.CENTER)
            blk.add_text("10m", dxfattribs={'height': 1}).set_placement((10, -1.5), align=TextEntityAlignment.CENTER)

    @staticmethod
    def setup_logo(doc):
        """Unified system logo block."""
        if 'LOGO' not in doc.blocks:
            blk = doc.blocks.new(name='LOGO')
            blk.add_lwpolyline([(0, 5), (5, 0), (0, -5), (-5, 0)], close=True, dxfattribs={'color': 7})
            blk.add_circle((0, 0), radius=1, dxfattribs={'color': 2})
            blk.add_text("RUAS", dxfattribs={'height': 1.5, 'color': 7}).set_placement((0, -7), align=TextEntityAlignment.CENTER)

    @staticmethod
    def get_street_width(highway_tag):
        """Returns the authoritative half-width for a given highway type."""
        # Cleaned up and centralized for geometric accuracy
        widths = {
            'motorway': 10.0,
            'trunk': 9.0,
            'primary': 7.0,
            'secondary': 6.0,
            'tertiary': 5.0,
            'residential': 4.0,
            'service': 3.0,
            'living_street': 3.0,
            'pedestrian': 3.0,
            'track': 3.0
        }
        return widths.get(highway_tag, 5.0)
