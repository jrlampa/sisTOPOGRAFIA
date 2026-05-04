import React from "react";
import { Pane, Polyline, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { Plus, Trash2 } from "lucide-react";
import type { MapBtEdge, MapBtPole, MapBtTopology } from "../types.map";
import { AppLocale, LayerConfig } from "../types";
import type { BtPoleAccumulatedDemand } from "../utils/btTopologyFlow";
import {
  getFlagButtonClass,
  getIconActionButtonClass,
  getCqtHeatmapColor,
  POPUP_FLAG_GRID_CLASS,
  POPUP_SELECT_CLASS,
} from "./MapSelectorStyles";

const CONDUCTOR_OPTIONS = [
  "70 Al - MX",
  "185 Al - MX",
  "240 Al - MX",
  "25 Al - Arm",
  "50 Al - Arm",
  "95 Al - Arm",
  "150 Al - Arm",
  "240 Al - Arm",
  "25 Al",
  "35 Cu",
  "70 Cu",
  "95 Al",
  "120 Cu",
  "240 Al",
  "240 Cu",
  "500 Cu",
  "10 Cu_CONC_bi",
  "10 Cu_CONC_Tri",
  "16 Al_CONC_bi",
  "16 Al_CONC_Tri",
  "13 Al - DX",
  "13 Al - TX",
  "13 Al - QX",
  "21 Al - QX",
  "53 Al - QX",
  "6 AWG",
  "2 AWG",
  "1/0 AWG",
  "3/0 AWG",
  "4/0 AWG",
];

const EDGE_HIT_AREA_WEIGHT = 44;

type BtEdgeChangeFlag = NonNullable<MapBtEdge["edgeChangeFlag"]>;

const getEdgeChangeFlag = (edge: MapBtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }
  return edge.removeOnExecution ? "remove" : "existing";
};

const getEdgeVisualConfig = (edge: MapBtEdge) => {
  const flag = getEdgeChangeFlag(edge);
  if (flag === "new")
    return { color: "#22c55e", dashArray: "8 6", weight: 3, opacity: 0.8 };
  if (flag === "remove")
    return { color: "#ef4444", dashArray: "8 6", weight: 3, opacity: 0.8 };
  if (flag === "replace")
    return { color: "#facc15", dashArray: undefined, weight: 3, opacity: 0.9 };
  return { color: "#d946ef", dashArray: undefined, weight: 3, opacity: 0.9 };
};

const getRemovalMarkersForEdge = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) => {
  const start = L.latLng(from.lat, from.lng);
  const end = L.latLng(to.lat, to.lng);
  const distanceMeters = Math.max(start.distanceTo(end), 1);
  const markerCount = Math.max(3, Math.min(12, Math.floor(distanceMeters / 6)));
  const points: Array<[number, number]> = [];
  for (let index = 1; index <= markerCount; index += 1) {
    const t = index / (markerCount + 1);
    points.push([
      from.lat + (to.lat - from.lat) * t,
      from.lng + (to.lng - from.lng) * t,
    ]);
  }
  return points;
};

interface MapSelectorEdgesLayerProps {
  paneName: string;
  topology: MapBtTopology;
  popupTopology?: MapBtTopology;
  polesById: Map<string, MapBtPole>;
  onBtDeleteEdge?: (id: string) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtQuickAddEdgeConductor?: (edgeId: string, conductorName: string) => void;
  onBtQuickRemoveEdgeConductor?: (
    edgeId: string,
    conductorName: string,
  ) => void;
  onBtSetEdgeLengthMeters?: (edgeId: string, lengthMeters: number) => void;
  onBtSetEdgeReplacementFromConductors?: (
    edgeId: string,
    conductors: Array<{ id: string; quantity: number; conductorName: string }>,
  ) => void;
  accumulatedByPoleMap?: Map<string, BtPoleAccumulatedDemand>;
  locale: AppLocale;
  layerConfig?: LayerConfig;
  draggedPole?: { id: string; lat: number; lng: number } | null;
  isGhostMode?: boolean;
  isXRayMode?: boolean;
}

const MapSelectorEdgesLayer: React.FC<MapSelectorEdgesLayerProps> = ({
  paneName,
  topology,
  popupTopology: _popupTopology,
  polesById,
  onBtDeleteEdge,
  onBtSetEdgeChangeFlag,
  onBtQuickAddEdgeConductor,
  onBtQuickRemoveEdgeConductor,
  accumulatedByPoleMap,
  locale: _locale,
  layerConfig,
  draggedPole,
  isXRayMode = false,
}) => {
  const [edgeConductorSelection, setEdgeConductorSelection] = React.useState<
    Record<string, string>
  >({});

  const popupEventHandlers = React.useMemo(
    () => ({
      add: (event: any) => {
        const popupEl = event?.popup?.getElement?.() as HTMLElement | null;
        const contentEl = popupEl?.querySelector(
          ".leaflet-popup-content",
        ) as HTMLElement | null;
        if (!contentEl) return;
        L.DomEvent.disableClickPropagation(contentEl);
        L.DomEvent.disableScrollPropagation(contentEl);
      },
    }),
    [],
  );

  return (
    <Pane name={paneName} style={{ zIndex: 420 }}>
      {(topology.edges || []).map((edge) => {
        const from = polesById.get(edge.fromPoleId);
        const to = polesById.get(edge.toPoleId);
        if (!from || !to) return null;

        const edgeChangeFlag = getEdgeChangeFlag(edge);
        const hasBt = edge.conductors.length > 0;
        const hasMt = (edge.mtConductors ?? []).length > 0;
        const edgeVisual = getEdgeVisualConfig(edge);

        const isDraggingFrom = draggedPole?.id === edge.fromPoleId;
        const isDraggingTo = draggedPole?.id === edge.toPoleId;
        const isCurrentlyDragging = isDraggingFrom || isDraggingTo;
        const poleAccumulated = accumulatedByPoleMap?.get(
          isDraggingFrom ? edge.fromPoleId : edge.toPoleId,
        );
        const accumulatedData = accumulatedByPoleMap?.get(edge.toPoleId);

        const oldDistance = L.latLng(
          polesById.get(edge.fromPoleId)!.lat,
          polesById.get(edge.fromPoleId)!.lng,
        ).distanceTo(
          L.latLng(
            polesById.get(edge.toPoleId)!.lat,
            polesById.get(edge.toPoleId)!.lng,
          ),
        );
        const currentDistance = L.latLng(from.lat, from.lng).distanceTo(
          L.latLng(to.lat, to.lng),
        );

        let heatmapColor: string | null = null;
        if (layerConfig?.cqtHeatmap && accumulatedData) {
          heatmapColor = getCqtHeatmapColor(
            accumulatedData.dvAccumPercent ?? 0,
          );
        }

        let estimatedCqtStr = "";
        if (isCurrentlyDragging && poleAccumulated?.dvAccumPercent) {
          const ratio = currentDistance / (oldDistance || 1);
          const estimatedCqt = poleAccumulated.dvAccumPercent * ratio;
          estimatedCqtStr = `${poleAccumulated.dvAccumPercent.toFixed(1)}% → ${estimatedCqt.toFixed(1)}%`;
        }

        const isViolation = (poleAccumulated?.dvAccumPercent ?? 0) > 7;
        const distColorClass =
          currentDistance > 40
            ? "text-red-600"
            : currentDistance > 30
              ? "text-amber-600"
              : "text-emerald-600";

        const edgePopup = (
          <Popup
            position={[(from.lat + to.lat) / 2, (from.lng + to.lng) / 2]}
            eventHandlers={popupEventHandlers}
          >
            <div className="min-w-[200px] space-y-3 p-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Vão {edge.id}
                </span>
                <button
                  onClick={() => onBtDeleteEdge?.(edge.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className={POPUP_FLAG_GRID_CLASS}>
                {(
                  ["existing", "new", "replace", "remove"] as BtEdgeChangeFlag[]
                ).map((f) => (
                  <button
                    key={f}
                    className={getFlagButtonClass(edgeChangeFlag === f, f)}
                    onClick={() => onBtSetEdgeChangeFlag?.(edge.id, f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400">
                  Cabos BT
                </label>
                <div className="flex gap-1.5">
                  <select
                    className={POPUP_SELECT_CLASS}
                    value={
                      edgeConductorSelection[edge.id] || CONDUCTOR_OPTIONS[0]
                    }
                    onChange={(e) =>
                      setEdgeConductorSelection((prev) => ({
                        ...prev,
                        [edge.id]: e.target.value,
                      }))
                    }
                  >
                    {CONDUCTOR_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      onBtQuickAddEdgeConductor?.(
                        edge.id,
                        edgeConductorSelection[edge.id] || CONDUCTOR_OPTIONS[0],
                      )
                    }
                    className={getIconActionButtonClass("violet")}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {edge.conductors.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 bg-violet-50 border border-violet-100 rounded-md text-[10px] font-bold text-violet-700"
                    >
                      {c.quantity}x {c.conductorName}
                      <button
                        onClick={() =>
                          onBtQuickRemoveEdgeConductor?.(
                            edge.id,
                            c.conductorName,
                          )
                        }
                        className="text-violet-400 hover:text-violet-600"
                      >
                        <Plus size={10} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Popup>
        );

        return (
          <React.Fragment key={edge.id}>
            {isCurrentlyDragging && (
              <Marker
                position={[(from.lat + to.lat) / 2, (from.lng + to.lng) / 2]}
                icon={L.divIcon({
                  className: "dynamic-span-badge",
                  html: `
                    <div class="flex flex-col items-center gap-1 animate-pulse" style="transform: translateY(-20px);">
                      <div class="px-2 py-0.5 rounded-full bg-white/90 border-2 border-white shadow-xl text-[11px] font-black whitespace-nowrap ${distColorClass}">${currentDistance.toFixed(1)}m</div>
                      ${estimatedCqtStr ? `<div class="px-2 py-0.5 rounded-lg bg-slate-900/80 text-white text-[9px] font-black border border-white/20 backdrop-blur-sm">CQT Est: ${estimatedCqtStr}</div>` : ""}
                    </div>
                  `,
                  iconSize: [0, 0],
                })}
                interactive={false}
              />
            )}
            <Polyline
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: "#000000",
                weight: EDGE_HIT_AREA_WEIGHT,
                opacity: 0.01,
                lineCap: "round",
                lineJoin: "round",
              }}
              data-violation={isViolation ? "true" : undefined}
            >
              {edgePopup}
              {layerConfig?.labels && (
                <Tooltip
                  permanent
                  direction="center"
                  opacity={0.8}
                  className="bt-edge-tooltip"
                >
                  <div className="flex flex-col items-center bg-white/90 px-1 py-0.5 rounded border border-slate-200 shadow-sm pointer-events-none">
                    {hasBt
                      ? edge.conductors.map((c) => (
                          <div
                            key={c.id}
                            className="text-[8px] font-bold text-slate-800 leading-tight"
                          >
                            {c.quantity}x{c.conductorName} (BT)
                          </div>
                        ))
                      : null}
                    {hasMt &&
                      (edge.mtConductors ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="text-[8px] font-bold text-orange-700 leading-tight"
                        >
                          {c.quantity}x{c.conductorName} (MT)
                        </div>
                      ))}
                    {!hasBt && !hasMt && (
                      <div className="text-[8px] italic text-slate-400">
                        Sem cabo
                      </div>
                    )}
                  </div>
                </Tooltip>
              )}
            </Polyline>
            <Polyline
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: "#ffffff",
                weight: edgeVisual.weight + 3,
                opacity: 0.72,
                dashArray: edgeVisual.dashArray,
                interactive: false,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: heatmapColor || edgeVisual.color,
                weight: heatmapColor ? 4 : edgeVisual.weight,
                dashArray: edgeVisual.dashArray,
                opacity: isXRayMode
                  ? heatmapColor
                    ? 1.0
                    : 0.05
                  : edgeVisual.opacity,
                interactive: false,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {hasMt && (
              <Polyline
                positions={(() => {
                  const offset = 0.00002;
                  const dx = to.lng - from.lng;
                  const dy = to.lat - from.lat;
                  const len = Math.sqrt(dx * dx + dy * dy) || 1;
                  const nx = -dy / len;
                  const ny = dx / len;
                  return [
                    [from.lat + nx * offset, from.lng + ny * offset],
                    [to.lat + nx * offset, to.lng + ny * offset],
                  ];
                })()}
                pathOptions={{
                  color: "#f97316",
                  weight: 2.5,
                  opacity: 0.9,
                  dashArray: "4 4",
                  interactive: false,
                }}
              />
            )}
            {edgeChangeFlag === "remove" && (
              <>
                {getRemovalMarkersForEdge(from, to).map(
                  (position, markerIndex) => (
                    <Marker
                      key={`${edge.id}-removal-x-${markerIndex}`}
                      position={position}
                      icon={L.divIcon({
                        className: "bt-edge-remove-label",
                        html: '<div class="bt-edge-remove-glyph">X</div>',
                        iconSize: [12, 12],
                        iconAnchor: [6, 6],
                      })}
                      interactive={false}
                    />
                  ),
                )}
              </>
            )}
          </React.Fragment>
        );
      })}
    </Pane>
  );
};

export default MapSelectorEdgesLayer;
