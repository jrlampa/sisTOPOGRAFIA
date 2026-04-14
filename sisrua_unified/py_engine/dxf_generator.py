import ezdxf

try:
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager

try:
    from .dxf_labels_mixin import DXFLabelsMixin
except (ImportError, ValueError):
    from dxf_labels_mixin import DXFLabelsMixin

try:
    from .dxf_bt_mixin import DXFBtMixin
except (ImportError, ValueError):
    from dxf_bt_mixin import DXFBtMixin

try:
    from .dxf_geometry_mixin import DXFGeometryMixin
except (ImportError, ValueError):
    from dxf_geometry_mixin import DXFGeometryMixin

try:
    from .dxf_layout_mixin import DXFLayoutMixin
except (ImportError, ValueError):
    from dxf_layout_mixin import DXFLayoutMixin


class DXFGenerator(DXFLabelsMixin, DXFBtMixin, DXFGeometryMixin, DXFLayoutMixin):
    def __init__(self, filename):
        self.filename = filename
        self.doc = ezdxf.new("R2013")
        self.diff_x = 0.0
        self.diff_y = 0.0
        self.bounds = [0.0, 0.0, 0.0, 0.0]  # Standard bounding box

        # Setup CAD standards via StyleManager (SRP Refactor)
        DXFStyleManager.setup_all(self.doc)

        self.msp = self.doc.modelspace()
        self.project_info = {}  # Store metadata for title block
        self.bt_context = {}
        self._offset_initialized = False
        self._street_label_registry = {}
        self._used_label_points = []
