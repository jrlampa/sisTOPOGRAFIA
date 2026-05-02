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
        const from = polesById.get(edge.fromPoleId);
        const to = polesById.get(edge.toPoleId);
        if (!from || !to) {
          return null;
        }

        const edgeChangeFlag = getEdgeChangeFlag(edge);
        const popupEdge = popupEdgesById.get(edge.id) ?? edge;
        const popupFrom = popupPolesById.get(edge.fromPoleId) ?? from;
        const popupTo = popupPolesById.get(edge.toPoleId) ?? to;
        const popupEdgeChangeFlag = getEdgeChangeFlag(popupEdge);
        let edgeVisual = getEdgeVisualConfig(edge);

        if (layerConfig?.cqtHeatmap && accumulatedByPoleMap) {
          const accFrom = accumulatedByPoleMap.get(from.id)?.dvAccumPercent ?? 0;
          const accTo = accumulatedByPoleMap.get(to.id)?.dvAccumPercent ?? 0;
          const maxCqt = Math.max(accFrom, accTo);

          let heatmapColor = edgeVisual.color; // default
          if (maxCqt > 7) heatmapColor = "#ef4444"; // Vermelho
          else if (maxCqt > 5) heatmapColor = "#f97316"; // Laranja
          else if (maxCqt > 3) heatmapColor = "#eab308"; // Amarelo
          else heatmapColor = "#22c55e"; // Verde

          edgeVisual = { ...edgeVisual, color: heatmapColor };
        }

        const edgeFlagLabel =
          popupEdgeChangeFlag === "remove"
            ? tp.flagRemove
            : popupEdgeChangeFlag === "new"
              ? tp.flagNew
              : popupEdgeChangeFlag === "replace"
                ? tp.flagReplace
                : tp.flagExisting;

        const selectedConductor =
          edgeConductorSelection[edge.id] ??
          popupEdge.conductors[popupEdge.conductors.length - 1]
            ?.conductorName ??
          CONDUCTOR_OPTIONS[0];
        const selectedReplacementFromConductor =
          edgeReplacementFromSelection[edge.id] ??
          popupEdge.replacementFromConductors?.[
            popupEdge.replacementFromConductors.length - 1
          ]?.conductorName ??
          CONDUCTOR_OPTIONS[0];

        const edgePopup = (
          <Popup eventHandlers={popupEventHandlers}>
            <div
              className="text-xs"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
            >
              <div>
                <strong>{edge.id}</strong>
              </div>
              <div className="mt-0.5 text-slate-700">
                {popupFrom.title} {"<->"} {popupTo.title}
              </div>
              <div className="mt-1 text-slate-700">
                Flag: <strong>{edgeFlagLabel}</strong>
              </div>
              <div className="mt-1 text-slate-700">{te.conductorPhase}</div>
              <div className="mt-0.5">
                <select
                  value={selectedConductor}
                  aria-label={`Condutor do trecho ${edge.id}`}
                  title={`Condutor do trecho ${edge.id}`}
                  onChange={(e) => {
                    const conductorName = e.target.value;
                    setEdgeConductorSelection((current) => ({
                      ...current,
                      [edge.id]: conductorName,
                    }));
                  }}
                  className={POPUP_SELECT_CLASS}
                >
                  {CONDUCTOR_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1 text-slate-700">
                {t.stats.networkLengthMeters.replace("m de rede", "Metragem")}:{" "}
                {typeof (
                  popupEdge.cqtLengthMeters ?? popupEdge.lengthMeters
                ) === "number"
                  ? `${popupEdge.cqtLengthMeters ?? popupEdge.lengthMeters} m`
                  : "-"}
              </div>
              {onBtSetEdgeLengthMeters && (
                <div className="mt-1">
                  <label className="mb-0.5 block text-slate-700">
                    Ajustar metragem CQT (m)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={
                      typeof (
                        popupEdge.cqtLengthMeters ?? popupEdge.lengthMeters
                      ) === "number"
                        ? Number(
                            popupEdge.cqtLengthMeters ?? popupEdge.lengthMeters,
                          )
                        : 0
                    }
                    onBlur={(e) => {
                      const parsed = Number(e.target.value);
                      if (!Number.isFinite(parsed) || parsed < 0) {
                        e.target.value = String(
                          Number(
                            popupEdge.cqtLengthMeters ??
                              popupEdge.lengthMeters ??
                              0,
                          ),
                        );
                        return;
                      }
                      onBtSetEdgeLengthMeters(edge.id, parsed);
                    }}
                    className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm text-slate-700"
                    title={`Metragem CQT do trecho ${edge.id}`}
                  />
                </div>
              )}
              {popupEdgeChangeFlag === "replace" && (
                <>
                  <div className="mt-1.5 text-slate-700">{te.replaceConductor.replace("Substituir condutores de", "Condutor que sai")}</div>
                  <div className="mt-0.5">
                    <select
                      value={selectedReplacementFromConductor}
                      aria-label={`Condutor de saída do trecho ${edge.id}`}
                      title={`Condutor de saída do trecho ${edge.id}`}
                      onChange={(e) => {
                        const conductorName = e.target.value;
                        setEdgeReplacementFromSelection((current) => ({
                          ...current,
                          [edge.id]: conductorName,
                        }));
                      }}
                      className={POPUP_SELECT_CLASS}
                    >
                      {CONDUCTOR_OPTIONS.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {onBtSetEdgeReplacementFromConductors && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onBtSetEdgeReplacementFromConductors(edge.id, [
                          {
                            id: `${ENTITY_ID_PREFIXES.CONDUCTOR_REPLACEMENT}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`,
                            quantity: 1,
                            conductorName: selectedReplacementFromConductor,
                          },
                        ]);
                      }}
                      className="mt-1.5 h-6 w-full rounded border border-amber-500 bg-amber-50 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      Definir condutor que sai
                    </button>
                  )}
                </>
              )}

              {popupEdge.conductors.length > 0 ? (
                <div className="mt-0.5 text-slate-700">
                  {popupEdge.conductors.map((entry) => (
                    <div key={entry.id}>
                      {entry.quantity} x {entry.conductorName}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-0.5 text-slate-500">
                  {t.popup.noConductor}
                </div>
              )}
              {(popupEdge.mtConductors ?? []).length > 0 && (
                <div className="mt-1 rounded border border-orange-200 bg-orange-50 px-1.5 py-1 text-xs text-orange-900">
                  <div className="font-bold uppercase tracking-wide">
                    {t.popup.linkedMtConductor}
                  </div>
                  {(popupEdge.mtConductors ?? []).map((entry) => (
                    <div key={entry.id}>
                      {entry.quantity} x {entry.conductorName}
                    </div>
                  ))}
                </div>
              )}
              {popupEdgeChangeFlag === "replace" && (
                <div className="mt-0.5 text-amber-900">
                  {(popupEdge.replacementFromConductors ?? []).length > 0 ? (
                    (popupEdge.replacementFromConductors ?? []).map((entry) => (
                      <div key={entry.id}>
                        {t.popup.leaving}: {entry.quantity} x {entry.conductorName}
                      </div>
                    ))
                  ) : (
                    <div>{t.popup.noLeavingConductor}</div>
                  )}
                </div>
              )}
              <div
                className={`mt-0.5 font-semibold ${popupEdge.verified ? "text-green-600" : "text-amber-600"}`}
              >
                {popupEdge.verified ? `✓ ${t.popup.verified}` : `○ ${t.popup.notVerified}`}
              </div>
              {onBtSetEdgeChangeFlag && (
                <div className={POPUP_FLAG_GRID_CLASS}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtSetEdgeChangeFlag(edge.id, "existing");
                    }}
                    className={getFlagButtonClass(
                      popupEdgeChangeFlag === "existing",
                      "existing",
                    )}
                  >
                    {tp.flagExisting}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtSetEdgeChangeFlag(edge.id, "new");
                    }}
                    className={getFlagButtonClass(
                      popupEdgeChangeFlag === "new",
                      "new",
                    )}
                  >
                    {tp.flagNew}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtSetEdgeChangeFlag(edge.id, "replace");
                    }}
                    className={getFlagButtonClass(
                      popupEdgeChangeFlag === "replace",
                      "replace",
                    )}
                  >
                    {tp.flagReplace}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtSetEdgeChangeFlag(edge.id, "remove");
                    }}
                    className={getFlagButtonClass(
                      popupEdgeChangeFlag === "remove",
                      "remove",
                    )}
                  >
                    {tp.flagRemove}
                  </button>
                </div>
              )}
              <div className={POPUP_TOOLBAR_CLASS}>
                {onBtDeleteEdge && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtDeleteEdge(edge.id);
                    }}
                    title="Deletar trecho"
                    aria-label="Deletar trecho"
                    className={getIconActionButtonClass("danger")}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                {onBtQuickAddEdgeConductor && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtQuickAddEdgeConductor(edge.id, selectedConductor);
                    }}
                    title="Informar condutor"
                    aria-label="Informar condutor"
                    className={getIconActionButtonClass("sky")}
                  >
                    <Plus size={12} />
                  </button>
                )}
                {onBtQuickRemoveEdgeConductor && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtQuickRemoveEdgeConductor(edge.id, selectedConductor);
                    }}
                    title="Retirar condutor"
                    aria-label="Retirar condutor"
                    className={getIconActionButtonClass("slate")}
                  >
                    <Minus size={12} />
                  </button>
                )}
              </div>
            </div>
          </Popup>
        );

        return (
          <React.Fragment key={edge.id}>
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
                    {edge.conductors.length > 0 ? (
                      edge.conductors.map((c) => (
                        <div key={c.id} className="text-[8px] font-bold text-slate-800 leading-tight">
                          {c.quantity}x{c.conductorName}
                        </div>
                      ))
                    ) : (
                      <div className="text-[8px] italic text-slate-400">Sem cabo</div>
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
                color: edgeVisual.color,
                weight: edgeVisual.weight,
                opacity: 0.98,
                dashArray: edgeVisual.dashArray,
                interactive: false,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
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
