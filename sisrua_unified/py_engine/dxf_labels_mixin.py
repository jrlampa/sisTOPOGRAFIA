import math

from ezdxf.enums import TextEntityAlignment


class DXFLabelsMixin:
    """Mixin providing label/text utility methods for DXFGenerator."""

    def _distance(self, p1, p2):
        return math.sqrt(((p1[0] - p2[0]) ** 2) + ((p1[1] - p2[1]) ** 2))

    def _find_clear_label_point(
        self, base_point, preferred_offsets=None, min_distance=7.0
    ):
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

    def _format_conductor_label(self, conductors):
        if not isinstance(conductors, list) or not conductors:
            return ""

        labels = []
        for entry in conductors:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("conductorName", "") or "").strip()
            quantity = int(entry.get("quantity", 0) or 0)
            if not name:
                continue
            labels.append(f"{quantity}-{name}" if quantity > 1 else name)
        return " + ".join(labels)

    def _draw_boxed_text(
        self, text, point, layer, color=6, height=2.0, padding_x=1.2, padding_y=0.8
    ):
        self._add_text(text, point, layer=layer, height=height, color=color)
        text_width = max(8.0, len(str(text)) * (height * 0.75))
        rect_left = point[0] - padding_x
        rect_bottom = point[1] - padding_y
        rect_right = rect_left + text_width + (padding_x * 2)
        rect_top = rect_bottom + height + (padding_y * 2)
        self.msp.add_lwpolyline(
            [
                (rect_left, rect_bottom),
                (rect_right, rect_bottom),
                (rect_right, rect_top),
                (rect_left, rect_top),
            ],
            close=True,
            dxfattribs={"layer": layer, "color": color},
        )

    def _draw_crossed_text(self, text, point, layer, color=6, height=2.0):
        self._add_text(text, point, layer=layer, height=height, color=color)
        text_width = max(8.0, len(str(text)) * (height * 0.75))
        left = point[0] - 0.6
        right = left + text_width + 1.2
        base = point[1] + (height * 0.2)
        top = base + (height * 1.4)

        self.msp.add_line(
            (left, base), (right, top), dxfattribs={"layer": layer, "color": color}
        )
        self.msp.add_line(
            (left, top), (right, base), dxfattribs={"layer": layer, "color": color}
        )

    def _format_ramal_summary(self, ramais):
        if not isinstance(ramais, list) or not ramais:
            return []
        total = 0
        entries = []
        for entry in ramais:
            if not isinstance(entry, dict):
                continue
            quantity = int(entry.get("quantity", 0) or 0)
            if quantity <= 0:
                continue
            ramal_type = str(entry.get("ramalType", "") or "").strip() or "SEM TIPO"
            notes = str(entry.get("notes", "") or "").strip()
            total += quantity
            label = f"{quantity}-{ramal_type}"
            if notes:
                label += f" ({notes.upper()})"
            entries.append(label)
        if total == 0:
            return []
        return [f"TOTAL: {total}"] + entries
