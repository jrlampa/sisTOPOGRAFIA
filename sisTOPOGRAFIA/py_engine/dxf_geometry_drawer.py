"""
dxf_geometry_drawer.py — Responsabilidade única: desenhar geometrias no DXF.
Extrai toda a lógica de renderização de geometrias do DXFGenerator (SRP).
"""
import math
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point

try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

try:
    from .dxf_styles import DXFStyleManager
except (ImportError, ValueError):
    from dxf_styles import DXFStyleManager

try:
    from .bim_data_attacher import attach_bim_data
except (ImportError, ValueError):
    from bim_data_attacher import attach_bim_data


class DXFGeometryDrawer:
    """
    Responsabilidade única: renderizar geometrias Shapely no ModelSpace ezdxf.
    Recebe as dependências necessárias via construtor (injeção de dependência).
    """

    def __init__(self, msp, doc, safe_v_fn, safe_p_fn, validate_points_fn):
        self.msp = msp
        self.doc = doc
        self._safe_v = safe_v_fn
        self._safe_p = safe_p_fn
        self._validate_points = validate_points_fn

    def _add_bim_data(self, entity, tags):
        attach_bim_data(entity, tags)

    def draw(self, geom, layer, diff_x, diff_y, tags):
        """Ponto de entrada: despacha geometria para o método correto."""
        if geom.is_empty:
            return
        if layer not in self.doc.layers:
            layer = '0'

        self._draw_street_label(geom, layer, diff_x, diff_y, tags)

        if isinstance(geom, Polygon):
            self._draw_polygon(geom, layer, diff_x, diff_y, tags)
        elif isinstance(geom, MultiPolygon):
            for poly in geom.geoms:
                self._draw_polygon(poly, layer, diff_x, diff_y, tags)

        if isinstance(geom, LineString):
            self._draw_linestring(geom, layer, diff_x, diff_y, tags)
            if layer == 'sisTOPO_VIAS' and 'highway' in tags:
                self._draw_street_offsets(geom, tags, diff_x, diff_y)
        elif isinstance(geom, MultiLineString):
            for line in geom.geoms:
                self._draw_linestring(line, layer, diff_x, diff_y, tags)
                if layer == 'sisTOPO_VIAS' and 'highway' in tags:
                    self._draw_street_offsets(line, tags, diff_x, diff_y)
        elif isinstance(geom, Point):
            self._draw_point(geom, layer, diff_x, diff_y, tags)

    def _draw_street_label(self, geom, layer, diff_x, diff_y, tags):
        """Adiciona rótulo de nome para vias."""
        if (layer not in ('sisTOPO_VIAS', '0')) or 'name' not in tags:
            return
        name = str(tags['name'])
        if name.lower() == 'nan' or not name.strip():
            return
        rotation = 0.0
        centroid = geom.centroid
        if centroid.is_empty or math.isnan(centroid.x) or math.isnan(centroid.y):
            return
        if isinstance(geom, LineString) and geom.length > 0.1:
            try:
                p1 = geom.interpolate(0.45, normalized=True)
                p2 = geom.interpolate(0.55, normalized=True)
                dx, dy = p2.x - p1.x, p2.y - p1.y
                if abs(dx) > 1e-5 or abs(dy) > 1e-5:
                    angle = np.degrees(np.arctan2(dy, dx))
                    rotation = angle if -90 <= angle <= 90 else angle + 180
            except Exception:
                pass
        try:
            safe_align = (
                self._safe_v(centroid.x - diff_x),
                self._safe_v(centroid.y - diff_y),
            )
            text = self.msp.add_text(
                name,
                dxfattribs={
                    'layer': 'sisTOPO_TEXTO',
                    'height': 2.5,
                    'rotation': self._safe_v(rotation),
                    'style': 'PRO_STYLE',
                },
            )
            text.dxf.halign = 1
            text.dxf.valign = 2
            text.dxf.insert = safe_align
            text.dxf.align_point = safe_align
        except Exception as te:
            Logger.info(f"Label creation failed: {te}")

    def _draw_street_offsets(self, line, tags, diff_x, diff_y):
        """Desenha linhas paralelas (meio-fio) para vias."""
        highway = tags.get('highway', 'residential')
        if highway in ['footway', 'path', 'cycleway', 'steps']:
            return
        width = DXFStyleManager.get_street_width(highway)
        try:
            if hasattr(line, 'offset_curve'):
                left = line.offset_curve(width, join_style=2)
                right = line.offset_curve(-width, join_style=2)
            else:
                left = line.parallel_offset(width, 'left', join_style=2)
                right = line.parallel_offset(width, 'right', join_style=2)
            for side_geom in [left, right]:
                if side_geom.is_empty:
                    continue
                lines_to_draw = [side_geom] if isinstance(side_geom, LineString) else list(side_geom.geoms)
                for seg in lines_to_draw:
                    pts = self._validate_points(
                        [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in seg.coords],
                        min_points=2,
                    )
                    if pts:
                        self.msp.add_lwpolyline(
                            pts, dxfattribs={'layer': 'sisTOPO_VIAS_MEIO_FIO', 'color': 251}
                        )
            Logger.info(f"Offsets de meio-fio gerados para: {tags.get('name', 'S/N')}")
        except Exception as e:
            Logger.info(f"Street offset failed: {e}")

    @staticmethod
    def get_thickness(tags, layer) -> float:
        """Calcula a espessura (altura 2.5D) da edificação a partir de tags OSM."""
        if layer != 'sisTOPO_EDIFICACAO':
            return 0.0
        try:
            if 'height' in tags:
                h = str(tags['height']).split(' ')[0]
                return float(h)
            if 'building:levels' in tags:
                return float(tags['building:levels']) * 3.0
            if 'levels' in tags:
                return float(tags['levels']) * 3.0
            return 3.5
        except (ValueError, TypeError, KeyError) as e:
            Logger.error(f"Error calculating height: {e}")
            return 3.5

    def _draw_polygon(self, poly, layer, diff_x, diff_y, tags):
        thickness = self.get_thickness(tags, layer)
        dxf_attribs = {'layer': layer, 'thickness': thickness}
        points = self._validate_points(
            [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in poly.exterior.coords],
            min_points=3,
        )
        if not points:
            return
        entity = self.msp.add_lwpolyline(points, close=True, dxfattribs=dxf_attribs)
        self._add_bim_data(entity, tags)

        if layer == 'sisTOPO_EDIFICACAO':
            self._annotate_building_area(poly, diff_x, diff_y)
            self._hatch_building(points)

        for interior in poly.interiors:
            inner_pts = self._validate_points(
                [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in interior.coords],
                min_points=3,
            )
            if inner_pts:
                inner = self.msp.add_lwpolyline(inner_pts, close=True, dxfattribs=dxf_attribs)
                self._add_bim_data(inner, tags)

    def _annotate_building_area(self, poly, diff_x, diff_y):
        try:
            area = poly.area
            centroid = poly.centroid
            if math.isnan(area) or math.isinf(area) or math.isnan(centroid.x) or math.isnan(centroid.y):
                return
            safe_p = (self._safe_v(centroid.x - diff_x), self._safe_v(centroid.y - diff_y))
            txt = self.msp.add_text(
                f"{area:.1f} m2",
                dxfattribs={'layer': 'sisTOPO_ANNOT_AREA', 'height': 1.5, 'color': 7},
            )
            txt.dxf.halign = 1
            txt.dxf.valign = 2
            txt.dxf.insert = safe_p
            txt.dxf.align_point = safe_p
        except Exception as e:
            Logger.info(f"Area annotation failed: {e}")

    def _hatch_building(self, points):
        try:
            def dedup(pts, eps=0.001):
                res = [pts[0]]
                for i in range(1, len(pts)):
                    if math.dist(pts[i], res[-1]) > eps:
                        res.append(pts[i])
                return res

            clean = dedup(points)
            if len(clean) >= 3:
                hatch = self.msp.add_hatch(color=8, dxfattribs={'layer': 'sisTOPO_EDIFICACAO_HATCH'})
                hatch.set_pattern_fill('ANSI31', scale=0.5, angle=45.0)
                hatch.paths.add_polyline_path(clean, is_closed=True)
        except Exception as he:
            Logger.info(f"Hatch failed: {he}")

    def _draw_linestring(self, line, layer, diff_x, diff_y, tags):
        points = self._validate_points(
            [self._safe_p((p[0] - diff_x, p[1] - diff_y)) for p in line.coords],
            min_points=2,
        )
        if not points:
            return
        entity = self.msp.add_lwpolyline(points, close=False, dxfattribs={'layer': layer})
        self._add_bim_data(entity, tags)
        if layer == 'sisTOPO_VIAS':
            self._annotate_road_length(line, diff_x, diff_y)

    def _annotate_road_length(self, line, diff_x, diff_y):
        try:
            length = line.length
            if math.isnan(length) or math.isinf(length):
                return
            mid = line.interpolate(0.5, normalized=True)
            if math.isnan(mid.x) or math.isnan(mid.y):
                return
            safe_mid = (self._safe_v(mid.x - diff_x), self._safe_v(mid.y - diff_y))
            ltxt = self.msp.add_text(
                f"{length:.1f}m",
                dxfattribs={'layer': 'sisTOPO_ANNOT_LENGTH', 'height': 2.0, 'color': 7, 'rotation': 0.0},
            )
            ltxt.dxf.halign = 1
            ltxt.dxf.valign = 2
            ltxt.dxf.insert = safe_mid
            ltxt.dxf.align_point = safe_mid
        except Exception as e:
            Logger.info(f"Length annotation failed: {e}")

    @staticmethod
    def _sanitize_attribs(attribs: dict) -> dict:
        return {k: ("N/A" if str(v).lower() == 'nan' or not str(v).strip() else str(v)) for k, v in attribs.items()}

    def _draw_point(self, point, layer, diff_x, diff_y, tags):
        if math.isnan(point.x) or math.isnan(point.y):
            return
        x = self._safe_v(point.x - diff_x)
        y = self._safe_v(point.y - diff_y)
        attribs = self._sanitize_attribs({
            'ID': tags.get('osmid', '999'),
            'TYPE': tags.get('power', tags.get('amenity', 'UNKNOWN')),
            'V_LEVEL': tags.get('voltage', '0V'),
        })
        if layer == 'sisTOPO_VEGETACAO':
            ent = self.msp.add_blockref('ARVORE', (x, y))
        elif layer == 'sisTOPO_MOBILIARIO_URBANO':
            amenity = tags.get('amenity')
            highway = tags.get('highway')
            if amenity == 'bench':
                ent = self.msp.add_blockref('BANCO', (x, y))
            elif amenity == 'waste_basket':
                ent = self.msp.add_blockref('LIXEIRA', (x, y))
            elif highway == 'street_lamp':
                ent = self.msp.add_blockref('POSTE_LUZ', (x, y))
            else:
                ent = self.msp.add_circle((x, y), radius=0.3, dxfattribs={'layer': layer, 'color': 40})
        elif layer == 'sisTOPO_EQUIPAMENTOS':
            ent = self.msp.add_blockref('POSTE', (x, y))
            ent.add_auto_attribs(attribs)
        elif 'INFRA_POWER' in layer:
            if layer == 'sisTOPO_INFRA_POWER_HV' or tags.get('power') == 'tower':
                ent = self.msp.add_blockref('TORRE', (x, y))
            else:
                ent = self.msp.add_blockref('POSTE', (x, y))
            ent.add_auto_attribs(attribs)
        elif layer == 'sisTOPO_INFRA_TELECOM':
            ent = self.msp.add_blockref('POSTE', (x, y), dxfattribs={'xscale': 0.8, 'yscale': 0.8})
            ent.add_auto_attribs(attribs)
        else:
            ent = self.msp.add_circle((x, y), radius=0.5, dxfattribs={'layer': layer})
        self._add_bim_data(ent, tags)
