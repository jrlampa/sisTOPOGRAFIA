import json
import os
try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class CADStylesManager:
    """Manages custom CAD styles (Layer colors, linetypes, etc.) from JSON templates."""
    
    DEFAULT_STYLES = {
        "layers": {
            "TOPO_INFRA_POWER_HV": {"color": 1, "linetype": "CONTINUOUS"},
            "TOPO_INFRA_POWER_LV": {"color": 30, "linetype": "HIDDEN"},
            "TOPO_EDIFICACAO": {"color": 7, "linetype": "CONTINUOUS"},
            "TOPO_VIAS": {"color": 7, "linetype": "CONTINUOUS"},
            "TOPO_TERRENO_PONTOS": {"color": 252, "linetype": "CONTINUOUS"},
            "TOPO_CURVAS_NIVEL_MESTRA": {"color": 7, "linetype": "CONTINUOUS"},
            "TOPO_CURVAS_NIVEL_INTERM": {"color": 8, "linetype": "CONTINUOUS"}
        }
    }

    def __init__(self, template_path=None):
        self.styles = self.DEFAULT_STYLES.copy()
        if template_path and os.path.exists(template_path):
            self.load_template(template_path)

    def load_template(self, template_path):
        """Loads a JSON style template."""
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                custom_styles = json.load(f)
                # Deep merge or update
                if "layers" in custom_styles:
                    self.styles["layers"].update(custom_styles["layers"])
                Logger.info(f"Custom CAD styles loaded from {template_path}")
        except Exception as e:
            Logger.error(f"Failed to load CAD style template: {e}")

    def apply_to_generator(self, dxf_gen):
        """Applies styles to an ezdxf Document generator."""
        layers = self.styles.get("layers", {})
        for layer_name, config in layers.items():
            if layer_name not in dxf_gen.doc.layers:
                dxf_gen.doc.layers.new(name=layer_name, dxfattribs={
                    'color': config.get('color', 7),
                    'linetype': config.get('linetype', 'CONTINUOUS')
                })
            else:
                # Update existing layer
                layer = dxf_gen.doc.layers.get(layer_name)
                layer.color = config.get('color', 7)
                layer.linetype = config.get('linetype', 'CONTINUOUS')
