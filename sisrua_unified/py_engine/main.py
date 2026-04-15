"""
main.py - Ponto de entrada da engine Python para geração de DXF.

Roadmap Item 4 (Pydantic input validation):
  Todos os parâmetros de entrada são validados por um schema Pydantic antes de
  qualquer processamento. Erros de validação encerram com código 2 (argparse
  convenção) e mensagem de erro estruturada em stderr.

Roadmap Item 99 (OOM Self-Healing):
  --memory-limit-mb configura um limite de RSS em MB.
  Uma thread de monitoramento verifica a memória periodicamente e encerra o
  processo com exit code 137 (convenção OOM) antes de ser morto pelo kernel.
  O orquestrador TypeScript detecta este código e trata como erro re-tentável.
"""
import sys
import argparse
import json
import os
import threading
import time
import traceback
from typing import Any, Dict, List, Literal, Optional

try:
    from pydantic import BaseModel, Field, field_validator, ValidationError
    _PYDANTIC_AVAILABLE = True
except ImportError:
    _PYDANTIC_AVAILABLE = False

from controller import OSMController
from utils.logger import Logger

# ─── Exit code OOM (convenção POSIX): permite ao orquestrador re-tentar ───────
EXIT_CODE_OOM = 137

# ─── Schema de validação (Item 4) ─────────────────────────────────────────────

if _PYDANTIC_AVAILABLE:
    class DxfInputModel(BaseModel):
        lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude WGS84")
        lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude WGS84")
        radius: float = Field(..., ge=1.0, le=10000.0, description="Raio em metros")
        output: str = Field(..., min_length=1, description="Caminho do arquivo DXF de saída")
        layers: Dict[str, bool] = Field(default_factory=dict)
        projection: Literal["local", "utm"] = "local"
        selection_mode: Literal["circle", "polygon"] = "circle"
        polygon: List[List[float]] = Field(default_factory=list)
        contour_style: Literal["spline", "polyline"] = "spline"
        bt_context: Dict[str, Any] = Field(default_factory=dict)
        memory_limit_mb: int = Field(default=0, ge=0)

        @field_validator("polygon")
        @classmethod
        def validate_polygon_points(cls, v: List[List[float]]) -> List[List[float]]:
            for point in v:
                if len(point) != 2:
                    raise ValueError(f"Cada ponto do polígono deve ter [lat, lon]: {point}")
                if not (-90 <= point[0] <= 90):
                    raise ValueError(f"Latitude inválida no polígono: {point[0]}")
                if not (-180 <= point[1] <= 180):
                    raise ValueError(f"Longitude inválida no polígono: {point[1]}")
            return v

    def validate_inputs(**kwargs: Any) -> "DxfInputModel":
        try:
            return DxfInputModel(**kwargs)
        except ValidationError as exc:
            sys.stderr.write(f"[Pydantic] Erro de validação de entrada:\n{exc}\n")
            sys.exit(2)
else:
    def validate_inputs(**kwargs: Any) -> Any:  # type: ignore[misc]
        """Fallback sem Pydantic: retorna namespace simples."""
        class _NS:
            pass
        ns = _NS()
        ns.__dict__.update(kwargs)
        return ns

# ─── Monitor de memória RSS (Item 99) ─────────────────────────────────────────

def _start_memory_monitor(limit_mb: int, check_interval: float = 2.0) -> None:
    """
    Inicia thread daemon que monitora o RSS do processo atual.
    Se o uso ultrapassar limit_mb, encerra com exit code 137 (OOM).

    Usa psutil quando disponível; fallback para /proc/self/status no Linux.
    """
    if limit_mb <= 0:
        return  # Monitoramento desativado

    def _get_rss_mb() -> float:
        try:
            import psutil  # type: ignore
            return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
        except ImportError:
            pass
        # Fallback Linux sem psutil
        try:
            with open("/proc/self/status") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        return int(line.split()[1]) / 1024  # kB → MB
        except OSError:
            pass
        return 0.0  # Não foi possível medir; não encerra

    def _monitor():
        while True:
            time.sleep(check_interval)
            rss_mb = _get_rss_mb()
            if rss_mb > 0 and rss_mb >= limit_mb:
                Logger.error(
                    f"[OOM Self-Healing] RSS {rss_mb:.0f}MB ≥ limite {limit_mb}MB. "
                    f"Encerrando com exit code {EXIT_CODE_OOM} para restart seguro."
                )
                os._exit(EXIT_CODE_OOM)

    thread = threading.Thread(target=_monitor, daemon=True, name="oom-watchdog")
    thread.start()
    Logger.info(f"[OOM Watchdog] Ativo. Limite RSS: {limit_mb}MB. Verificação a cada {check_interval}s.")


# ─── Ponto de entrada ─────────────────────────────────────────────────────────

def main():
    # Force UTF-8 encoding for stdout (Windows fix)
    sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Download OSM data and convert to DXF")
    parser.add_argument("--lat",            type=float, required=True,  help="Latitude")
    parser.add_argument("--lon",            type=float, required=True,  help="Longitude")
    parser.add_argument("--radius",         type=float, required=True,  help="Radius in meters")
    parser.add_argument("--output",         type=str,   required=True,  help="Output DXF filename")
    parser.add_argument("--layers",         type=str,   default="{}",   help="JSON string of layers to fetch")
    parser.add_argument("--crs",            type=str,   default="auto", help='EPSG code or "auto"')
    parser.add_argument("--projection",     type=str,   default="local",help="Projection type: local or utm")
    parser.add_argument("--format",         type=str,   default="dxf",  help="Output format (dxf, kml, geojson)")
    parser.add_argument("--selection_mode", type=str,   default="circle", help="Selection mode (circle, polygon)")
    parser.add_argument("--polygon",        type=str,   default="[]",   help="JSON string of polygon points [[lat, lon], ...]")
    parser.add_argument("--contour_style",  type=str,   default="spline", help="Contour render mode: spline or polyline")
    parser.add_argument("--client_name",    type=str,   default="CLIENTE PADRÃO", help="Client name for title block")
    parser.add_argument("--project_id",     type=str,   default="PROJETO URBANISTICO", help="Project ID for title block")
    parser.add_argument("--bt_context",     type=str,   default="{}",   help="JSON with BT topology summary for DXF annotation")
    parser.add_argument("--no-preview",     action="store_true",         help="Skip GeoJSON preview logs (prevents OOM in CLI)")
    # Item 99: limite de memória RSS para self-healing
    parser.add_argument("--memory-limit-mb", type=int, default=int(os.environ.get("PYTHON_MEMORY_LIMIT_MB", "0")),
                        help="RSS memory limit in MB. Exit code 137 if exceeded (0 = disabled).")

    args = parser.parse_args()

    # Inicia watchdog OOM antes de qualquer processamento pesado (Item 99)
    _start_memory_monitor(args.memory_limit_mb)

    try:
        layers_config = json.loads(args.layers)
        if not layers_config:
            layers_config = {"buildings": True, "roads": True, "trees": True, "amenities": True}

        if args.no_preview:
            Logger.SKIP_GEOJSON = True

        raw_polygon = json.loads(args.polygon)
        raw_bt_context = json.loads(args.bt_context)

        def _normalize_point(p):
            if isinstance(p, dict):
                return [p.get("lat", p.get("latitude", 0)), p.get("lng", p.get("lon", p.get("longitude", 0)))]
            return list(p)

        polygon = [_normalize_point(p) for p in raw_polygon] if raw_polygon else []
        bt_context = raw_bt_context if isinstance(raw_bt_context, dict) else {}

        # Item 4: Pydantic validation — rejects malformed/out-of-range inputs before heavy processing
        validated = validate_inputs(
            lat=args.lat,
            lon=args.lon,
            radius=args.radius,
            output=args.output,
            layers={k: bool(v) for k, v in layers_config.items()},
            projection=args.projection,
            selection_mode=args.selection_mode,
            polygon=polygon,
            contour_style=args.contour_style,
            bt_context=bt_context,
            memory_limit_mb=args.memory_limit_mb,
        )

        controller = OSMController(
            lat=validated.lat,
            lon=validated.lon,
            radius=validated.radius,
            output_file=validated.output,
            layers_config=validated.layers,
            crs=args.crs,
            export_format=args.format,
            selection_mode=validated.selection_mode,
            polygon=validated.polygon,
            contour_style=validated.contour_style,
        )
        controller.project_metadata = {
            "client": args.client_name,
            "project": args.project_id,
        }
        controller.bt_context = validated.bt_context
        controller.run()

    except Exception as e:
        sys.stderr.write(traceback.format_exc())
        Logger.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
