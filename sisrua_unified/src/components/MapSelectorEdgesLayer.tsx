import React from "react";
import { Pane, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Minus, Plus, Trash2 } from "lucide-react";
import { BtEdge, BtPoleNode, BtTopology } from "../types";
import {
  ENTITY_ID_PREFIXES,
  LEGACY_ID_ENTROPY,
} from "../constants/magicNumbers";

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

const EDGE_HIT_AREA_WEIGHT = 28;
const POPUP_SELECT_CLASS =
  "w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-700";
const POPUP_TOOLBAR_CLASS = "mt-1.5 flex items-center gap-2";
const POPUP_FLAG_GRID_CLASS = "mt-1.5 grid grid-cols-2 gap-1.5";

type BtEdgeChangeFlag = NonNullable<BtEdge["edgeChangeFlag"]>;

const getEdgeChangeFlag = (edge: BtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }

  return edge.removeOnExecution ? "remove" : "existing";
};

const getEdgeVisualConfig = (edge: BtEdge) => {
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
    "h-6 rounded border bg-white text-[10px] font-bold transition-colors";

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
  topology: BtTopology;
  polesById: Map<string, BtPoleNode>;
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
}

const MapSelectorEdgesLayer: React.FC<MapSelectorEdgesLayerProps> = ({
  paneName,
  topology,
  polesById,
  onBtDeleteEdge,
  onBtSetEdgeChangeFlag,
  onBtQuickAddEdgeConductor,
  onBtQuickRemoveEdgeConductor,
  onBtSetEdgeLengthMeters,
  onBtSetEdgeReplacementFromConductors,
}) => {
  const [edgeConductorSelection, setEdgeConductorSelection] = React.useState<
    Record<string, string>
  >({});
  const [edgeReplacementFromSelection, setEdgeReplacementFromSelection] =
    React.useState<Record<string, string>>({});

  return (
    <Pane name={paneName} style={{ zIndex: 420 }}>
      {(topology.edges || []).map((edge) => {
        const from = polesById.get(edge.fromPoleId);
        const to = polesById.get(edge.toPoleId);
        if (!from || !to) {
          return null;
        }

        const edgeChangeFlag = getEdgeChangeFlag(edge);
        const edgeVisual = getEdgeVisualConfig(edge);
        const edgeFlagLabel =
          edgeChangeFlag === "remove"
            ? "Remoção"
            : edgeChangeFlag === "new"
              ? "Novo"
              : edgeChangeFlag === "replace"
                ? "Substituição"
                : "Existente";

        const selectedConductor =
          edgeConductorSelection[edge.id] ??
          edge.conductors[edge.conductors.length - 1]?.conductorName ??
          CONDUCTOR_OPTIONS[0];
        const selectedReplacementFromConductor =
          edgeReplacementFromSelection[edge.id] ??
          edge.replacementFromConductors?.[
            edge.replacementFromConductors.length - 1
          ]?.conductorName ??
          CONDUCTOR_OPTIONS[0];

        const edgePopup = (
          <Popup>
            <div className="text-xs">
              <div>
                <strong>{edge.id}</strong>
              </div>
              <div className="mt-0.5 text-slate-700">
                {from.title} {"<->"} {to.title}
              </div>
              <div className="mt-1 text-slate-700">
                Flag: <strong>{edgeFlagLabel}</strong>
              </div>
              <div className="mt-1 text-slate-700">Condutor</div>
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
              <div className="mt-1.5 text-slate-700">
                Metragem:{" "}
                {typeof (edge.cqtLengthMeters ?? edge.lengthMeters) === "number"
                  ? `${edge.cqtLengthMeters ?? edge.lengthMeters} m`
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
                      typeof (edge.cqtLengthMeters ?? edge.lengthMeters) ===
                      "number"
                        ? Number(edge.cqtLengthMeters ?? edge.lengthMeters)
                        : 0
                    }
                    onBlur={(e) => {
                      const parsed = Number(e.target.value);
                      if (!Number.isFinite(parsed) || parsed < 0) {
                        e.target.value = String(
                          Number(
                            edge.cqtLengthMeters ?? edge.lengthMeters ?? 0,
                          ),
                        );
                        return;
                      }
                      onBtSetEdgeLengthMeters(edge.id, parsed);
                    }}
                    className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-700"
                    title={`Metragem CQT do trecho ${edge.id}`}
                  />
                </div>
              )}
              {edgeChangeFlag === "replace" && (
                <>
                  <div className="mt-1.5 text-slate-700">Condutor que sai</div>
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
                      className="mt-1.5 h-6 w-full rounded border border-amber-500 bg-amber-50 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      Definir condutor que sai
                    </button>
                  )}
                </>
              )}
              {edge.conductors.length > 0 ? (
                <div className="mt-0.5 text-slate-700">
                  {edge.conductors.map((entry) => (
                    <div key={entry.id}>
                      {entry.quantity} x {entry.conductorName}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-0.5 text-slate-500">
                  Sem condutor informado
                </div>
              )}
              {edgeChangeFlag === "replace" && (
                <div className="mt-0.5 text-amber-900">
                  {(edge.replacementFromConductors ?? []).length > 0 ? (
                    (edge.replacementFromConductors ?? []).map((entry) => (
                      <div key={entry.id}>
                        Sai: {entry.quantity} x {entry.conductorName}
                      </div>
                    ))
                  ) : (
                    <div>Sem condutor de saída definido</div>
                  )}
                </div>
              )}
              <div
                className={`mt-0.5 font-semibold ${edge.verified ? "text-green-600" : "text-amber-600"}`}
              >
                {edge.verified ? "✓ Verificado" : "○ Não verificado"}
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
                      edgeChangeFlag === "existing",
                      "existing",
                    )}
                  >
                    Existente
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtSetEdgeChangeFlag(edge.id, "new");
                    }}
                    className={getFlagButtonClass(
                      edgeChangeFlag === "new",
                      "new",
                    )}
                  >
                    Novo
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtSetEdgeChangeFlag(edge.id, "replace");
                    }}
                    className={getFlagButtonClass(
                      edgeChangeFlag === "replace",
                      "replace",
                    )}
                  >
                    Substituição
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onBtSetEdgeChangeFlag(edge.id, "remove");
                    }}
                    className={getFlagButtonClass(
                      edgeChangeFlag === "remove",
                      "remove",
                    )}
                  >
                    Remoção
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
