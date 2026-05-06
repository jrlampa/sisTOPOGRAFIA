"""
drawing_context.py - Estado compartilhado e utilitários primitivos de desenho DXF.

Todos os drawers recebem uma instância de DrawingContext via injeção de dependência,
garantindo separação de responsabilidades sem acoplar os módulos entre si.
"""
import math

try:
    from ..utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

from ezdxf.enums import TextEntityAlignment


class DrawingContext:
    """
    Contêiner de estado compartilhado entre os drawers especializados.

    Armazena referências ao documento DXF, modelspace e variáveis que mudam
    durante a geração (offset, bounds, registros de labels).
    """

    def __init__(self, doc, msp):
        self.doc = doc
        self.msp = msp
        self.diff_x: float = 0.0
        self.diff_y: float = 0.0
        self.bounds: list[float] = [0.0, 0.0, 0.0, 0.0]
        self._offset_initialized: bool = False
        self._street_label_registry: dict = {}
        self._used_label_points: list = []

    # -------------------------------------------------------------------------
    # Utilitários numéricos
    # -------------------------------------------------------------------------

    def safe_v(self, v, fallback_val=None) -> float:
        """Guarda absoluto para valores float. Retorna fallback se inválido."""
        try:
            val = float(v)
            if math.isnan(val) or math.isinf(val) or abs(val) > 1e11:
                return fallback_val if fallback_val is not None else 0.0
            return val
        except (ValueError, TypeError) as e:
            Logger.error(f"Valor float inválido '{v}': {e}")
            return fallback_val if fallback_val is not None else 0.0

    def safe_p(self, p) -> tuple:
        """Guarda absoluto para tuplas de ponto. Usa centróide como fallback."""
        try:
            cx = self.bounds[0] + (self.bounds[2] - self.bounds[0]) / 2
            cy = self.bounds[1] + (self.bounds[3] - self.bounds[1]) / 2
            return (
                self.safe_v(p[0], fallback_val=cx),
                self.safe_v(p[1], fallback_val=cy),
            )
        except (IndexError, TypeError) as e:
            Logger.error(f"Dado de ponto inválido '{p}': {e}")
            return (0.0, 0.0)

    def validate_points(self, points, min_points: int = 2, is_3d: bool = False):
        """Valida lista de pontos para entidades DXF; retorna None se inválida."""
        if not points or len(points) < min_points:
            return None

        valid_points = []
        last_p = None
        for p in points:
            try:
                vals = [self.safe_v(v, fallback_val=None) for v in p]
                if None in vals:
                    continue
                curr_p = tuple(vals)
                if curr_p != last_p:
                    valid_points.append(curr_p)
                    last_p = curr_p
            except (ValueError, TypeError, IndexError) as e:
                Logger.error(f"Ponto inválido ignorado: {e}")
                continue

        if len(valid_points) < min_points:
            return None
        return valid_points

    @staticmethod
    def distance(p1, p2) -> float:
        return math.sqrt(((p1[0] - p2[0]) ** 2) + ((p1[1] - p2[1]) ** 2))

    # -------------------------------------------------------------------------
    # Gerenciamento de labels
    # -------------------------------------------------------------------------

    def find_clear_label_point(self, base_point, preferred_offsets=None, min_distance: float = 7.0):
        """Encontra ponto livre para label, evitando sobreposição com labels existentes."""
        if preferred_offsets is None:
            preferred_offsets = [
                (0.0, 0.0), (0.0, 4.0), (0.0, -4.0),
                (4.0, 0.0), (-4.0, 0.0),
                (6.0, 3.0), (6.0, -3.0), (-6.0, 3.0), (-6.0, -3.0),
            ]

        for dx, dy in preferred_offsets:
            candidate = (base_point[0] + dx, base_point[1] + dy)
            if all(
                self.distance(candidate, used) >= min_distance
                for used in self._used_label_points
            ):
                self._used_label_points.append(candidate)
                return candidate

        fallback = (base_point[0] + 8.0, base_point[1] + 8.0)
        self._used_label_points.append(fallback)
        return fallback

    def should_draw_street_label(self, name: str, anchor, length_m: float) -> bool:
        """Decide se um label de via deve ser desenhado (máx. 2 por nome, dist. mínima)."""
        if not name or name.lower() == "nan":
            return False
        if length_m < 35.0:
            return False

        entries = self._street_label_registry.setdefault(name, [])
        if len(entries) >= 2:
            return False
        if any(self.distance(anchor, existing) < 45.0 for existing in entries):
            return False

        entries.append(anchor)
        return True

    # -------------------------------------------------------------------------
    # Primitivo de texto DXF
    # -------------------------------------------------------------------------

    def add_text(self, text, point, layer="TEXTO", height=2.2, color=None,
                 rotation=0.0, align=TextEntityAlignment.LEFT):
        """Adiciona entidade TEXT ao modelspace com atributos padrão."""
        attribs = {
            "layer": layer,
            "height": height,
            "rotation": rotation,
            "style": "PRO_STYLE",
        }
        if color is not None:
            attribs["color"] = color

        entity = self.msp.add_text(str(text), dxfattribs=attribs)
        entity.set_placement(point, align=align)
        return entity

    @staticmethod
    def sanitize_attribs(attribs: dict) -> dict:
        """Garante que nenhum valor 'nan' seja enviado como atributo DXF."""
        sanitized = {}
        for k, v in attribs.items():
            val = str(v)
            sanitized[k] = "N/A" if val.lower() == "nan" or not val.strip() else val
        return sanitized
