import React from "react";
import { Pane, Polyline, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { MapBtEdge, MapBtPole, MapBtTopology } from "../types.map";
import {
  ENTITY_ID_PREFIXES,
  LEGACY_ID_ENTROPY,
} from "../constants/magicNumbers";
import { getBtTopologyPanelText } from "../i18n/btTopologyPanelText";
import { AppLocale, LayerConfig } from "../types";
import type { BtPoleAccumulatedDemand } from "../utils/btTopologyFlow";

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
const POPUP_SELECT_CLASS =
  "w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm text-slate-700";
const POPUP_TOOLBAR_CLASS = "mt-1.5 flex items-center gap-2";
const POPUP_FLAG_GRID_CLASS = "mt-1.5 grid grid-cols-2 gap-1.5";

type BtEdgeChangeFlag = NonNullable<MapBtEdge["edgeChangeFlag"]>;

const getEdgeChangeFlag = (edge: MapBtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }

  return edge.removeOnExecution ? "remove" : "existing";
};

const getEdgeVisualConfig = (edge: MapBtEdge) => {
  const flag = getEdgeChangeFlag(edge);

  if (flag === "new") {
    return { color: "#22c55e", dashArray: "8 6", weight: 3 };
  }

  if (flag === "remove") {
    return { color: "#ef4444", dashArray: "8 6", weight: 3 };
  }

  if (flag === "replace") {
    return {
      color: "#facc15",
      dashArray: undefined as string | undefined,
      weight: 3,
    };
  }

  return {
    color: "#d946ef",
    dashArray: undefined as string | undefined,
    weight: 3,
  };
};

const getFlagButtonClass = (
  isActive: boolean,
  variant: "existing" | "new" | "replace" | "remove",
) => {
  const baseClass =
    "h-6 rounded border bg-white text-xs font-bold transition-colors";

  if (variant === "new") {
    return `${baseClass} border-green-500 text-green-700 ${isActive ? "bg-green-100" : "hover:bg-green-50"}`;
  }

  if (variant === "replace") {
    return `${baseClass} border-yellow-400 text-yellow-700 ${isActive ? "bg-yellow-100" : "hover:bg-yellow-50"}`;
  }

  if (variant === "remove") {
    return `${baseClass} border-red-500 text-red-700 ${isActive ? "bg-red-100" : "hover:bg-red-50"}`;
  }

  return `${baseClass} border-fuchsia-500 text-fuchsia-700 ${isActive ? "bg-fuchsia-100" : "hover:bg-fuchsia-50"}`;
};

const getIconActionButtonClass = (
  variant: "danger" | "sky" | "slate" | "violet",
  active = false,
) => {
  const baseClass =
    "inline-flex h-6 w-7 items-center justify-center rounded border transition-colors";

  if (variant === "danger") {
    return `${baseClass} border-red-500 text-red-500 ${active ? "bg-red-100" : "bg-red-500/10 hover:bg-red-100"}`;
  }

  if (variant === "sky") {
    return `${baseClass} border-sky-500 text-sky-600 bg-sky-500/10 hover:bg-sky-100`;
  }

  if (variant === "violet") {
    return `${baseClass} ${active ? "border-violet-700 text-violet-700 bg-violet-100" : "border-slate-500 text-slate-600 bg-slate-100 hover:bg-slate-200"}`;
  }

  return `${baseClass} border-slate-500 text-slate-700 bg-slate-100 hover:bg-slate-200`;
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
}

const MapSelectorEdgesLayer: React.FC<MapSelectorEdgesLayerProps> = ({
  paneName,
  topology,
  popupTopology,
  polesById,
  onBtDeleteEdge,
  onBtSetEdgeChangeFlag,
  onBtQuickAddEdgeConductor,
  onBtQuickRemoveEdgeConductor,
  onBtSetEdgeLengthMeters,
  onBtSetEdgeReplacementFromConductors,
  accumulatedByPoleMap,
  locale,
  layerConfig,
  draggedPole,
  isGhostMode = false,
}) => {
  const t = getBtTopologyPanelText(locale);
  const { poleVerification: tp, transformerEdge: te } = t;
  const [edgeConductorSelection, setEdgeConductorSelection] = React.useState<
    Record<string, string>
  >({});
  const [edgeReplacementFromSelection, setEdgeReplacementFromSelection] =
    React.useState<Record<string, string>>({});
  const popupEdgesById = React.useMemo(
    () =>
      new Map((popupTopology ?? topology).edges.map((edge) => [edge.id, edge])),
    [popupTopology, topology],
  );
  const popupPolesById = React.useMemo(
    () =>
      new Map((popupTopology ?? topology).poles.map((pole) => [pole.id, pole])),
    [popupTopology, topology],
  );
  const popupEventHandlers = React.useMemo(
    () => ({
      add: (event: any) => {
        const popupEl = event?.popup?.getElement?.() as HTMLElement | null;
        const contentEl = popupEl?.querySelector(
          ".leaflet-popup-content",
        ) as HTMLElement | null;
        if (!contentEl) {
          return;
        }
        L.DomEvent.disableClickPropagation(contentEl);
        L.DomEvent.disableScrollPropagation(contentEl);
      },
    }),
    [],
  );

  return (
    <Pane name={paneName} style={{ zIndex: 420 }}>
      {(topology.edges || []).map((edge) => {
        let from = polesById.get(edge.fromPoleId);
        let to = polesById.get(edge.toPoleId);
        if (!from || !to) {
          return null;
        }

        // Real-time drag support (UX: Dynamic Spans)
        const isDraggingFrom = draggedPole?.id === edge.fromPoleId;
        const isDraggingTo = draggedPole?.id === edge.toPoleId;
        const isCurrentlyDragging = isDraggingFrom || isDraggingTo;
        const poleAccumulated = accumulatedByPoleMap?.get(isDraggingFrom ? edge.fromPoleId : edge.toPoleId);
        
        const oldDistance = L.latLng(polesById.get(edge.fromPoleId)!.lat, polesById.get(edge.fromPoleId)!.lng)
          .distanceTo(L.latLng(polesById.get(edge.toPoleId)!.lat, polesById.get(edge.toPoleId)!.lng));
        const currentDistance = L.latLng(from.lat, from.lng).distanceTo(L.latLng(to.lat, to.lng));
        
        // Ghost CQT Estimation
        let estimatedCqtStr = "";
        if (isCurrentlyDragging && poleAccumulated?.dvAccumPercent) {
          const ratio = currentDistance / (oldDistance || 1);
          const estimatedCqt = poleAccumulated.dvAccumPercent * ratio;
          estimatedCqtStr = `${poleAccumulated.dvAccumPercent.toFixed(1)}% → ${estimatedCqt.toFixed(1)}%`;
        }

        const isViolation = (poleAccumulated?.dvAccumPercent ?? 0) > 7;

        const distColorClass = currentDistance > 40 ? "text-red-600" : currentDistance > 30 ? "text-amber-600" : "text-emerald-600";

        return (
          <React.Fragment key={edge.id}>
            {/* Rótulo Dinâmico de Distância + Ghost CQT (UX: Ghost Edits) */}
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

            {/* Área de clique estendida */}
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
                    {hasBt ? (
                      edge.conductors.map((c) => (
                        <div key={c.id} className="text-[8px] font-bold text-slate-800 leading-tight">
                          {c.quantity}x{c.conductorName} (BT)
                        </div>
                      ))
                    ) : null}
                    {hasMt && (edge.mtConductors ?? []).map((c) => (
                      <div key={c.id} className="text-[8px] font-bold text-orange-700 leading-tight">
                        {c.quantity}x{c.conductorName} (MT)
                      </div>
                    ))}
                    {!hasBt && !hasMt && (
                      <div className="text-[8px] italic text-slate-400">Sem cabo</div>
                    )}
                  </div>
                </Tooltip>
              )}
            </Polyline>
            
            {/* Linha de fundo (glow/border) */}
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

            {/* Linha Principal (BT ou Mista) */}
            <Polyline
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: edgeVisual.color,
                weight: edgeVisual.weight,
                opacity: 0.98,
                dashArray: edgeVisual.dashArray,
                interactive: false,
                lineCap: "round",
                lineJoin: "round",
              }}
            />

            {/* Linha de Offset para MT (Representação Multi-Cabo) */}
            {hasMt && (
              <Polyline
                positions={(() => {
                  // Simples offset lateral de ~2 metros em graus (aproximado)
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
                  color: "#f97316", // Cor de MT (Laranja)
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
