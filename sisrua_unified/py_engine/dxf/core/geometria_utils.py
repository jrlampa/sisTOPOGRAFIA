"""
Submódulo: GeometriaUtils
Responsabilidade Única: Utilitários matemáticos/geométricos e helpers de texto/pontos.
Parte do decomposition do dxf_generator.py (Item 1 do Roadmap T1).
"""
import math

try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from utils.logger import Logger

from ezdxf.enums import TextEntityAlignment


class GeometriaUtilsMixin:
    """Mixin com utilitários de geometria, validação de pontos e desenho de texto."""

    def _distance(self, p1, p2):
        return math.sqrt(((p1[0] - p2[0]) ** 2) + ((p1[1] - p2[1]) ** 2))

    def _find_clear_label_point(self, base_point, preferred_offsets=None, min_distance=7.0):
        if preferred_offsets is None:
            preferred_offsets = [
                (0.0, 0.0),
                (0.0, 4.0),
                (0.0, -4.0),
                (4.0, 0.0),
                (-4.0, 0.0),
                (6.0, 3.0),
                (6.0, -3.0),
                (-6.0, 3.0),
                (-6.0, -3.0),
            ]

        for dx, dy in preferred_offsets:
            candidate = (base_point[0] + dx, base_point[1] + dy)
            if all(
                self._distance(candidate, used) >= min_distance
                for used in self._used_label_points
            ):
                self._used_label_points.append(candidate)
                return candidate

        fallback = (base_point[0] + 8.0, base_point[1] + 8.0)
        self._used_label_points.append(fallback)
        return fallback

    def _should_draw_street_label(self, name, anchor, length_m):
        if not name or name.lower() == "nan":
            return False

        if length_m < 35.0:
            return False

        entries = self._street_label_registry.setdefault(name, [])
        if len(entries) >= 2:
            return False

        if any(self._distance(anchor, existing) < 45.0 for existing in entries):
            return False

        entries.append(anchor)
        return True

    def _add_text(
        self,
        text,
        point,
        layer="TEXTO",
        height=2.2,
        color=None,
        rotation=0.0,
        align=TextEntityAlignment.LEFT,
    ):
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

    def _sanitize_attribs(self, attribs):
        """Garante que nenhum valor 'nan' seja enviado como atributo."""
        sanitized = {}
        for k, v in attribs.items():
            val = str(v)
            if val.lower() == "nan" or not val.strip():
                sanitized[k] = "N/A"
            else:
                sanitized[k] = val
        return sanitized

    def _safe_v(self, v, fallback_val=None):
        """Guarda absoluta para valores float. Retorna fallback_val se inválido."""
        try:
            val = float(v)
            if math.isnan(val) or math.isinf(val) or abs(val) > 1e11:
                return fallback_val if fallback_val is not None else 0.0
            return val
        except (ValueError, TypeError) as e:
            Logger.error(f"Valor float inválido '{v}': {e}")
            return fallback_val if fallback_val is not None else 0.0

    def _safe_p(self, p):
        """Guarda absoluta para tuplas de ponto. Usa centróides como fallback."""
        try:
            cx = self.bounds[0] + (self.bounds[2] - self.bounds[0]) / 2
            cy = self.bounds[1] + (self.bounds[3] - self.bounds[1]) / 2
            return (
                self._safe_v(p[0], fallback_val=cx),
                self._safe_v(p[1], fallback_val=cy),
            )
        except (IndexError, TypeError) as e:
            Logger.error(f"Dados de ponto inválidos '{p}': {e}")
            return (0.0, 0.0)

    def _validate_points(self, points, min_points=2, is_3d=False):
        """Valida lista de pontos para entidades DXF e previne erros de leitura."""
        if not points or len(points) < min_points:
            return None

        valid_points = []
        last_p = None
        for p in points:
            try:
                vals = [self._safe_v(v, fallback_val=None) for v in p]
                if None in vals:
                    continue
                curr_p = tuple(vals)
                if curr_p != last_p:
                    valid_points.append(curr_p)
                    last_p = curr_p
            except (ValueError, TypeError, IndexError) as e:
                Logger.error(f"Ponto inválido ignorado na validação: {e}")
                continue

        if len(valid_points) < min_points:
            return None

        return valid_points

    def _simplify_line(self, line, tolerance=0.1):
        """Usa simplificação nativa do Shapely para resultados robustos."""
        return line.simplify(tolerance, preserve_topology=True)

    def _merge_contiguous_lines(self, lines_with_tags):
        """
        Tenta mesclar LineStrings que compartilham endpoints e têm tags idênticas.
        Usa limite de distância pequeno para lidar com ruído em coordenadas.
        """
        if not lines_with_tags:
            return []

        merged_results = []
        processed = set()
        dist_threshold = 0.5

        for i, (line, tags) in enumerate(lines_with_tags):
            if i in processed:
                continue

            curr_line = line
            processed.add(i)

            changed = True
            while changed:
                changed = False
                for j, (other_line, other_tags) in enumerate(lines_with_tags):
                    if j in processed:
                        continue

                    if tags.get("name") != other_tags.get("name") or tags.get(
                        "highway"
                    ) != other_tags.get("highway"):
                        continue

                    p1_start, p1_end = curr_line.coords[0], curr_line.coords[-1]
                    p2_start, p2_end = other_line.coords[0], other_line.coords[-1]

                    def get_dist(pa, pb):
                        return math.sqrt((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2)

                    new_coords = None
                    if get_dist(p1_end, p2_start) < dist_threshold:
                        new_coords = list(curr_line.coords) + list(other_line.coords)[1:]
                    elif get_dist(p1_start, p2_end) < dist_threshold:
                        new_coords = list(other_line.coords) + list(curr_line.coords)[1:]
                    elif get_dist(p1_start, p2_start) < dist_threshold:
                        new_coords = list(reversed(other_line.coords)) + list(curr_line.coords)[1:]
                    elif get_dist(p1_end, p2_end) < dist_threshold:
                        new_coords = list(curr_line.coords) + list(reversed(other_line.coords))[1:]

                    if new_coords:
                        from shapely.geometry import LineString
                        curr_line = LineString(new_coords)
                        processed.add(j)
                        changed = True
                        break

            merged_results.append((curr_line, tags))

        Logger.info(
            f"Mesclagem de geometria: {len(lines_with_tags)} segmentos → {len(merged_results)} polylines."
        )
        return merged_results
