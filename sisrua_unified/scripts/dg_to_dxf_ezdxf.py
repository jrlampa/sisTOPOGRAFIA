#!/usr/bin/env python3
"""
Convert DG optimization JSON output to a strict AutoCAD 2018 DXF using ezdxf.
"""

from __future__ import annotations

import argparse
import json
import time
from math import cos, pi
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import ezdxf
from ezdxf import units

try:
    import requests as _requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from shapely.geometry import LineString as _LineString, MultiLineString as _MultiLineString
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False


R_EARTH = 6378137.0


def latlon_to_xy(lat: float, lon: float, lat0: float, lon0: float) -> Tuple[float, float]:
    lat_rad = lat0 * pi / 180.0
    x = R_EARTH * (lon - lon0) * (pi / 180.0) * cos(lat_rad)
    y = R_EARTH * (lat - lat0) * (pi / 180.0)
    return x, y


def ensure_layer(doc, name: str, color: int) -> None:
    if name not in doc.layers:
        doc.layers.add(name, color=color)


# OSM highway types mapped to DXF layer suffix, color, and half-width (meters)
# half-width = half the road width drawn as offset from centerline
HIGHWAY_LAYERS = {
    "motorway":      ("sisRUA_VIAS_PRINCIPAIS",  1,  7.5),
    "trunk":         ("sisRUA_VIAS_PRINCIPAIS",  1,  7.0),
    "primary":       ("sisRUA_VIAS_PRINCIPAIS",  1,  6.0),
    "secondary":     ("sisRUA_VIAS_SECUNDARIAS", 253, 5.5),
    "tertiary":      ("sisRUA_VIAS_SECUNDARIAS", 253, 5.0),
    "unclassified":  ("sisRUA_RUAS",             8,   3.5),
    "residential":   ("sisRUA_RUAS",             8,   4.0),
    "service":       ("sisRUA_RUAS",             9,   3.0),
    "living_street": ("sisRUA_RUAS",             9,   3.0),
    "pedestrian":    ("sisRUA_CALCADAS",         9,   0.0),
    "footway":       ("sisRUA_CALCADAS",         9,   0.0),
    "path":          ("sisRUA_CALCADAS",         9,   0.0),
    "cycleway":      ("sisRUA_CALCADAS",         9,   0.0),
}

DEFAULT_HIGHWAY_LAYER = ("sisRUA_RUAS", 8, 3.0)

OSM_MEIO_FIO_LAYER = "sisRUA_MEIO_FIO"  # Curb/edge lines, color 253 (light gray)
OSM_MEIO_FIO_COLOR = 253


def fetch_osm_streets(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float,
    margin: float = 0.003, timeout: int = 30
) -> Optional[dict]:
    """Fetch OSM way geometries via Overpass API."""
    if not HAS_REQUESTS:
        print("WARNING: 'requests' not installed — skipping OSM street fetch")
        return None

    bbox = f"{min_lat - margin},{min_lon - margin},{max_lat + margin},{max_lon + margin}"
    query = f"""[out:json][timeout:{timeout}];
way["highway"]({bbox});
(._;>;);
out geom;"""
    overpass_url = "https://overpass-api.de/api/interpreter"
    try:
        print(f"Fetching OSM streets for bbox {bbox} ...")
        headers = {"User-Agent": "sisTOPOGRAFIA/1.0 (DG DXF exporter; educational use)"}
        resp = _requests.post(overpass_url, data={"data": query}, timeout=timeout + 10, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        n_ways = sum(1 for e in data.get("elements", []) if e["type"] == "way")
        print(f"OSM: {n_ways} ways received")
        return data
    except Exception as exc:
        print(f"WARNING: OSM fetch failed ({exc}) — streets will be omitted")
        return None


def _draw_offset_curbs(msp, pts: list, half_width: float, layer: str, color: int) -> None:
    """Draw parallel offset lines (curb lines) on both sides of a centerline."""
    if not HAS_SHAPELY or half_width <= 0:
        return
    try:
        line = _LineString(pts)
        if line.is_empty or line.length < 0.5:
            return
        for side in (half_width, -half_width):
            if hasattr(line, "offset_curve"):
                offset = line.offset_curve(side, join_style=2)
            else:
                offset = line.parallel_offset(abs(side), "left" if side > 0 else "right", join_style=2)
            if offset is None or offset.is_empty:
                continue
            geoms = offset.geoms if isinstance(offset, _MultiLineString) else [offset]
            for g in geoms:
                coords = list(g.coords)
                if len(coords) >= 2:
                    msp.add_lwpolyline(
                        coords,
                        dxfattribs={"layer": layer, "color": color},
                    )
    except Exception:
        pass  # silently skip bad geometries


def add_osm_streets_to_dxf(
    doc, msp,
    osm_data: dict,
    lat0: float, lon0: float,
) -> None:
    """Draw OSM ways as centerlines + offset curb lines in the DXF."""
    osm_layers_created: set = set()
    meio_fio_created = False

    for element in osm_data.get("elements", []):
        if element["type"] != "way":
            continue
        tags = element.get("tags", {})
        hw = tags.get("highway", "")
        layer_name, color, half_width = HIGHWAY_LAYERS.get(hw, DEFAULT_HIGHWAY_LAYER)

        # Ensure layers exist
        if layer_name not in osm_layers_created:
            ensure_layer(doc, layer_name, color)
            osm_layers_created.add(layer_name)
        if not meio_fio_created:
            ensure_layer(doc, OSM_MEIO_FIO_LAYER, OSM_MEIO_FIO_COLOR)
            meio_fio_created = True

        geometry = element.get("geometry", [])
        if len(geometry) < 2:
            continue

        pts = [latlon_to_xy(g["lat"], g["lon"], lat0, lon0) for g in geometry]

        # Draw centerline
        msp.add_lwpolyline(
            pts,
            dxfattribs={"layer": layer_name, "color": color},
        )

        # Draw curb offset lines (meio-fio)
        _draw_offset_curbs(msp, pts, half_width, OSM_MEIO_FIO_LAYER, OSM_MEIO_FIO_COLOR)


def build_dxf(data: dict, out_path: Path, with_osm: bool = True) -> None:
    doc = ezdxf.new("R2018", setup=True)
    doc.units = units.M
    doc.header["$ACADVER"] = "AC1032"
    doc.header["$INSUNITS"] = 6
    msp = doc.modelspace()

    ensure_layer(doc, "DG_POSTES", 7)
    ensure_layer(doc, "DG_REDE_BT", 5)
    ensure_layer(doc, "DG_TRAFOS", 1)
    ensure_layer(doc, "DG_PARTICOES", 3)
    ensure_layer(doc, "DG_REDE_SINGLE", 4)
    ensure_layer(doc, "DG_TRAFO_SINGLE", 2)
    ensure_layer(doc, "DG_TEXTO", 7)

    part_result = data.get("partitionedResult") or {}
    partitions = part_result.get("partitions") or []

    poles_by_id: Dict[str, Tuple[float, float]] = {}
    for part in partitions:
        for pole in part.get("poles", []):
            pid = pole.get("id")
            pos = pole.get("position") or {}
            if pid and "lat" in pos and "lon" in pos:
                poles_by_id[pid] = (float(pos["lat"]), float(pos["lon"]))

    if not poles_by_id:
        raise RuntimeError("No poles found in partitionedResult JSON")

    all_lats = [p[0] for p in poles_by_id.values()]
    all_lons = [p[1] for p in poles_by_id.values()]
    avg_lat = sum(all_lats) / len(all_lats)
    avg_lon = sum(all_lons) / len(all_lons)
    min_lat, max_lat = min(all_lats), max(all_lats)
    min_lon, max_lon = min(all_lons), max(all_lons)

    # Fetch and draw OSM streets FIRST so DG data sits on top
    if with_osm:
        osm_data = fetch_osm_streets(min_lat, min_lon, max_lat, max_lon)
        if osm_data:
            add_osm_streets_to_dxf(doc, msp, osm_data, avg_lat, avg_lon)

    pole_xy: Dict[str, Tuple[float, float]] = {
        pid: latlon_to_xy(lat, lon, avg_lat, avg_lon)
        for pid, (lat, lon) in poles_by_id.items()
    }

    for pid, (x, y) in pole_xy.items():
        msp.add_circle((x, y), radius=1.5, dxfattribs={"layer": "DG_POSTES"})
        msp.add_text(
            pid,
            dxfattribs={"layer": "DG_TEXTO", "height": 1.5},
        ).set_placement((x + 1.6, y + 1.6))

    part_colors = [1, 2, 3, 4, 5, 6, 7, 14, 30, 40]

    for i, part in enumerate(partitions):
        color = part_colors[i % len(part_colors)]
        trafo = part.get("trafoPositionLatLon") or {}
        tlat = float(trafo.get("lat", 0.0))
        tlon = float(trafo.get("lon", 0.0))
        tx, ty = latlon_to_xy(tlat, tlon, avg_lat, avg_lon)

        for edge in part.get("edges", []):
            a = edge.get("fromPoleId")
            b = edge.get("toPoleId")

            if a in pole_xy:
                x1, y1 = pole_xy[a]
            else:
                x1, y1 = tx, ty

            if b in pole_xy:
                x2, y2 = pole_xy[b]
            else:
                x2, y2 = tx, ty

            msp.add_line(
                (x1, y1),
                (x2, y2),
                dxfattribs={"layer": "DG_REDE_BT", "color": color},
            )

        sz = 4.0
        msp.add_line((tx - sz, ty), (tx + sz, ty), dxfattribs={"layer": "DG_TRAFOS", "color": 1})
        msp.add_line((tx, ty - sz), (tx, ty + sz), dxfattribs={"layer": "DG_TRAFOS", "color": 1})
        msp.add_circle((tx, ty), radius=sz * 1.2, dxfattribs={"layer": "DG_TRAFOS", "color": 1})

        cqt = float((part.get("electricalResult") or {}).get("cqtMaxFraction", 0.0)) * 100.0
        kva = part.get("selectedKva", "?")
        feasible = bool((part.get("electricalResult") or {}).get("feasible", False))
        tag = "OK" if feasible else "FALHA"
        label = f"T{i+1}:{kva}kVA CQT={cqt:.1f}% [{tag}]"
        msp.add_text(
            label,
            dxfattribs={"layer": "DG_PARTICOES", "height": 2.0},
        ).set_placement((tx + sz + 1.0, ty + 2.0))

    rec = data.get("recommendation") or {}
    best = rec.get("bestScenario")
    if best:
        trafo = best.get("trafoPositionLatLon") or {}
        tlat = float(trafo.get("lat", 0.0))
        tlon = float(trafo.get("lon", 0.0))
        tx, ty = latlon_to_xy(tlat, tlon, avg_lat, avg_lon)
        msp.add_circle((tx, ty), radius=5.0, dxfattribs={"layer": "DG_TRAFO_SINGLE", "color": 2})

        for edge in best.get("edges", []):
            a = edge.get("fromPoleId")
            b = edge.get("toPoleId")

            if a in pole_xy:
                x1, y1 = pole_xy[a]
            else:
                x1, y1 = tx, ty

            if b in pole_xy:
                x2, y2 = pole_xy[b]
            else:
                x2, y2 = tx, ty

            msp.add_line(
                (x1, y1),
                (x2, y2),
                dxfattribs={"layer": "DG_REDE_SINGLE", "color": 4},
            )

    doc.saveas(str(out_path))
    auditor = doc.audit()
    if auditor.has_errors:
        raise RuntimeError(f"DXF audit found {len(auditor.errors)} errors")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate AutoCAD 2018 DXF from DG JSON")
    parser.add_argument(
        "--input",
        default="download/dg_padre_decaminada_result.json",
        help="Path to DG JSON result",
    )
    parser.add_argument(
        "--output",
        default="download/dg_padre_decaminada_autocad2018.dxf",
        help="Output DXF path",
    )
    parser.add_argument(
        "--no-osm",
        action="store_true",
        help="Skip OSM street fetch (faster, no internet required)",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    data = json.loads(input_path.read_text(encoding="utf-8"))
    output_path.parent.mkdir(parents=True, exist_ok=True)

    build_dxf(data, output_path, with_osm=not args.no_osm)
    print(f"DXF saved: {output_path}")


if __name__ == "__main__":
    main()
