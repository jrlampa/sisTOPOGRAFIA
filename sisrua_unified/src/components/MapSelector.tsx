import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Pane,
  Circle,
  CircleMarker,
  useMapEvents,
  GeoJSON,
  Polygon,
  Polyline,
  Popup,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { GeoJsonObject, FeatureCollection } from "geojson";
import SelectionManager from "./MapSelectorSelectionManager";
import MapSelectorEdgesLayer from "./MapSelectorEdgesLayer";
import {
  BtEditorMode,
  BtPoleNode,
  BtRamalEntry,
  BtTopology,
  BtTransformer,
  SelectionMode,
  GeoLocation,
} from "../types";
import type { BtPoleAccumulatedDemand } from "../services/btDerivedService";
import { Minus, Plus, Trash2, Triangle } from "lucide-react";
import {
  LEGACY_ID_ENTROPY,
  ENTITY_ID_PREFIXES,
} from "../constants/magicNumbers";

const LEAFLET_ICON_BASE_URL = import.meta.env.BASE_URL;
const POPUP_TOOLBAR_CLASS = "mt-1.5 flex items-center gap-2";
const POPUP_FLAG_GRID_CLASS = "mt-1.5 grid grid-cols-2 gap-1.5";

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

// Fix for default marker icon in React Leaflet
// We need to set the marker icon paths because Leaflet doesn't handle them well in bundled apps.
// Using public/ static resources to avoid external CDN dependency and improve CSP compliance.
const DefaultIcon = L.icon({
  iconRetinaUrl: `${LEAFLET_ICON_BASE_URL}marker-icon-2x.png`,
  iconUrl: `${LEAFLET_ICON_BASE_URL}marker-icon.png`,
  shadowUrl: `${LEAFLET_ICON_BASE_URL}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
  center: { lat: number; lng: number; label?: string };
  flyToEdgeTarget?: { lat: number; lng: number; token: number } | null;
  flyToPoleTarget?: { lat: number; lng: number; token: number } | null;
  flyToTransformerTarget?: { lat: number; lng: number; token: number } | null;
  radius: number;
  selectionMode: SelectionMode;
  polygonPoints: [number, number][];
  onLocationChange: (newCenter: {
    lat: number;
    lng: number;
    label?: string;
  }) => void;
  onPolygonChange: (points: [number, number][]) => void;
  measurePath?: [number, number][]; // optional for now
  onMeasurePathChange?: (path: [number, number][]) => void;
  btTopology?: BtTopology;
  btEditorMode?: BtEditorMode;
  pendingBtEdgeStartPoleId?: string | null;
  onBtMapClick?: (location: {
    lat: number;
    lng: number;
    label?: string;
  }) => void;
  onBtContextAction?: (
    action: "add-edge" | "add-transformer" | "add-pole",
    location: GeoLocation,
  ) => void;
  onBtDeletePole?: (id: string) => void;
  onBtDeleteEdge?: (id: string) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtDeleteTransformer?: (id: string) => void;
  onBtToggleTransformerOnPole?: (poleId: string) => void;
  onBtQuickAddPoleRamal?: (poleId: string) => void;
  onBtQuickRemovePoleRamal?: (poleId: string) => void;
  onBtQuickAddEdgeConductor?: (edgeId: string, conductorName: string) => void;
  onBtQuickRemoveEdgeConductor?: (
    edgeId: string,
    conductorName: string,
  ) => void;
  onBtSetEdgeLengthMeters?: (edgeId: string, lengthMeters: number) => void;
  onBtSetEdgeReplacementFromConductors?: (
    edgeId: string,
    conductors: BtRamalEntry[],
  ) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onBtSetPoleVerified?: (poleId: string, verified: boolean) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    nodeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (
    poleId: string,
    circuitBreakPoint: boolean,
  ) => void;
  onBtSetTransformerChangeFlag?: (
    transformerId: string,
    transformerChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtDragPole?: (poleId: string, lat: number, lng: number) => void;
  onBtDragTransformer?: (
    transformerId: string,
    lat: number,
    lng: number,
  ) => void;
  criticalPoleId?: string | null;
  accumulatedByPole?: BtPoleAccumulatedDemand[];
  onKmlDrop?: (file: File) => void;
  mapStyle?: string;
  onMapStyleChange?: (style: string) => void;
  showAnalysis?: boolean;
  geojson?: GeoJsonObject | null;
  keyboardPanEnabled?: boolean;
}

type BtPoleChangeFlag = NonNullable<BtPoleNode["nodeChangeFlag"]>;
type BtTransformerChangeFlag = NonNullable<
  BtTransformer["transformerChangeFlag"]
>;

const getPoleChangeFlag = (pole: BtPoleNode): BtPoleChangeFlag =>
  pole.nodeChangeFlag ?? "existing";
const getTransformerChangeFlag = (
  transformer: BtTransformer,
): BtTransformerChangeFlag => transformer.transformerChangeFlag ?? "existing";

const getFlagColor = (
  flag: "existing" | "new" | "remove" | "replace",
  fallback: string,
) => {
  if (flag === "new") return "#22c55e";
  if (flag === "remove") return "#ef4444";
  if (flag === "replace") return "#facc15";
  return fallback;
};

const MapSelector: React.FC<MapSelectorProps> = ({
  center,
  flyToEdgeTarget,
  flyToPoleTarget,
  flyToTransformerTarget,
  radius,
  selectionMode,
  polygonPoints,
  onLocationChange,
  onPolygonChange,
  measurePath,
  onMeasurePathChange,
  btTopology,
  btEditorMode = "none",
  pendingBtEdgeStartPoleId,
  onBtMapClick,
  onBtContextAction,
  onBtDeletePole,
  onBtDeleteEdge,
  onBtSetEdgeChangeFlag,
  onBtDeleteTransformer,
  onBtToggleTransformerOnPole,
  onBtQuickAddPoleRamal,
  onBtQuickRemovePoleRamal,
  onBtQuickAddEdgeConductor,
  onBtQuickRemoveEdgeConductor,
  onBtSetEdgeLengthMeters,
  onBtSetEdgeReplacementFromConductors,
  onBtRenamePole,
  onBtRenameTransformer,
  onBtSetPoleVerified,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  onBtSetTransformerChangeFlag,
  onBtDragPole,
  onBtDragTransformer,
  criticalPoleId,
  accumulatedByPole = [],
  onKmlDrop,
  mapStyle = "dark",
  onMapStyleChange,
  showAnalysis = false,
  geojson,
  keyboardPanEnabled = false,
}) => {
  const topology = btTopology ?? { poles: [], transformers: [], edges: [] };
  const paneIdSuffix = React.useId().replace(/:/g, "-");
  const btEdgesPaneName = `bt-edges-pane-${paneIdSuffix}`;
  const btPolesPaneName = `bt-poles-pane-${paneIdSuffix}`;
  const btTransformersPaneName = `bt-transformers-pane-${paneIdSuffix}`;

  const polesById = React.useMemo(() => {
    return new Map(topology.poles.map((pole) => [pole.id, pole]));
  }, [topology.poles]);

  const accumulatedByPoleMap = React.useMemo(() => {
    return new Map(accumulatedByPole.map((entry) => [entry.poleId, entry]));
  }, [accumulatedByPole]);

  const poleHasTransformer = React.useMemo(() => {
    const byPole = new Map<string, boolean>();
    const distanceThresholdMeters = 6;

    for (const pole of topology.poles || []) {
      const hasTransformer = (topology.transformers || []).some(
        (transformer) => {
          if (transformer.poleId) {
            return transformer.poleId === pole.id;
          }
          const polePoint = L.latLng(pole.lat, pole.lng);
          const transformerPoint = L.latLng(transformer.lat, transformer.lng);
          return (
            polePoint.distanceTo(transformerPoint) <= distanceThresholdMeters
          );
        },
      );
      byPole.set(pole.id, hasTransformer);
    }

    return byPole;
  }, [topology.poles, topology.transformers]);

  const makePoleIcon = (poleId: string, verified: boolean) => {
    const hasTransformer = !!poleHasTransformer.get(poleId);
    const isCritical = poleId === criticalPoleId;
    const isPending = poleId === pendingBtEdgeStartPoleId;
    const pole = topology.poles.find((item) => item.id === poleId);
    const poleFlag = pole ? getPoleChangeFlag(pole) : "existing";

    if (hasTransformer) {
      const bg = getFlagColor(poleFlag, verified ? "#15803d" : "#7c3aed");
      const size = isCritical ? 22 : isPending ? 20 : 18;
      return L.divIcon({
        className: "bt-pole-transformer-icon",
        html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 2px rgba(15, 23, 42, 0.45));"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    }

    let bg = "#2563eb";
    let size = 16;
    if (isCritical) {
      bg = "#ef4444";
      size = 20;
    } else if (isPending) {
      bg = "#f59e0b";
      size = 18;
    } else {
      bg = getFlagColor(poleFlag, verified ? "#16a34a" : "#2563eb");
    }
    return L.divIcon({
      className: "bt-pole-icon",
      html: `<div style="background:${bg};border:2px solid #ffffff;width:${size}px;height:${size}px;border-radius:9999px;box-shadow:0 0 0 2px ${bg}50, 0 1px 4px rgba(15, 23, 42, 0.45);"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  const makeTransformerIcon = (
    verified: boolean,
    transformerFlag: BtTransformerChangeFlag,
  ) => {
    const bg = getFlagColor(transformerFlag, verified ? "#15803d" : "#7c3aed");
    return L.divIcon({
      className: "bt-transformer-icon",
      html: `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onKmlDrop && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onKmlDrop(e.dataTransfer.files[0]);
    }
  };

  const tileConfig = React.useMemo(() => {
    if (mapStyle === "satellite") {
      return {
        key: "satellite",
        attribution:
          "&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxNativeZoom: 19,
      };
    }

    return {
      key: "vector",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxNativeZoom: 19,
    };
  }, [mapStyle]);

  return (
    <div
      className="relative z-0 h-full min-h-[400px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-100 shadow-2xl"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        scrollWheelZoom={true}
        maxZoom={24}
        className="h-full min-h-[400px] w-full"
        whenReady={() => {
          // Map ready
        }}
      >
        <TileLayer
          key={tileConfig.key}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          maxZoom={24}
          maxNativeZoom={tileConfig.maxNativeZoom}
          eventHandlers={{
            tileerror: ((error: L.TileErrorEvent) => {
              // Tile load error (expected for some tiles)
            }) as L.TileErrorEventHandlerFn,
            tileload: () => {
              // Tile loaded successfully
            },
          }}
        />

        <SelectionManager
          center={center}
          flyToEdgeTarget={flyToEdgeTarget}
          flyToPoleTarget={flyToPoleTarget}
          flyToTransformerTarget={flyToTransformerTarget}
          radius={radius}
          selectionMode={selectionMode}
          polygonPoints={polygonPoints}
          onLocationChange={onLocationChange}
          onPolygonChange={onPolygonChange}
          measurePath={measurePath}
          onMeasurePathChange={onMeasurePathChange}
          btEditorMode={btEditorMode}
          onBtMapClick={onBtMapClick}
          onBtContextAction={onBtContextAction}
          keyboardPanEnabled={keyboardPanEnabled}
        />

        <MapSelectorEdgesLayer
          paneName={btEdgesPaneName}
          topology={topology}
          polesById={polesById}
          onBtDeleteEdge={onBtDeleteEdge}
          onBtSetEdgeChangeFlag={onBtSetEdgeChangeFlag}
          onBtQuickAddEdgeConductor={onBtQuickAddEdgeConductor}
          onBtQuickRemoveEdgeConductor={onBtQuickRemoveEdgeConductor}
          onBtSetEdgeLengthMeters={onBtSetEdgeLengthMeters}
          onBtSetEdgeReplacementFromConductors={
            onBtSetEdgeReplacementFromConductors
          }
        />

        <Pane name={btPolesPaneName} style={{ zIndex: 470 }}>
          {(topology.poles || []).map((pole) => (
            <React.Fragment
              key={`${pole.id}-${pole.verified ? "v" : "u"}-${pole.id === criticalPoleId ? "c" : "n"}-${pole.id === pendingBtEdgeStartPoleId ? "p" : "x"}-${poleHasTransformer.get(pole.id) ? "t" : "nt"}`}
            >
              <CircleMarker
                center={[pole.lat, pole.lng]}
                radius={
                  pole.id === criticalPoleId
                    ? 9
                    : pole.id === pendingBtEdgeStartPoleId
                      ? 8
                      : 7
                }
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  opacity: 1,
                  fillColor: getFlagColor(
                    getPoleChangeFlag(pole),
                    pole.verified ? "#16a34a" : "#2563eb",
                  ),
                  fillOpacity: 0.95,
                }}
                interactive={false}
              />
              <Marker
                position={[pole.lat, pole.lng]}
                icon={makePoleIcon(pole.id, !!pole.verified)}
                zIndexOffset={1200}
                draggable={
                  btEditorMode !== "add-edge" &&
                  btEditorMode !== "add-transformer"
                }
                eventHandlers={{
                  click: () => {
                    if (
                      (btEditorMode === "add-edge" ||
                        btEditorMode === "add-transformer") &&
                      onBtMapClick
                    ) {
                      onBtMapClick({
                        lat: pole.lat,
                        lng: pole.lng,
                        label: pole.title,
                      });
                    }
                  },
                  dragend: (e) => {
                    const { lat, lng } = (e.target as L.Marker).getLatLng();
                    onBtDragPole?.(pole.id, lat, lng);
                  },
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -8]}
                  opacity={0.85}
                >
                  <span className="text-[10px] font-semibold">
                    {pole.title}
                  </span>
                </Tooltip>
                <Popup>
                  <div className="text-xs">
                    {(() => {
                      const poleAccumulated = accumulatedByPoleMap.get(pole.id);
                      const cqtClass =
                        poleAccumulated?.cqtStatus === "CRÍTICO"
                          ? "text-red-600"
                          : poleAccumulated?.cqtStatus === "ATENÇÃO"
                            ? "text-amber-600"
                            : "text-emerald-700";

                      return (
                        <>
                          <strong>{pole.title}</strong>
                          <div>{pole.id}</div>
                          {onBtRenamePole && (
                            <input
                              type="text"
                              value={pole.title}
                              title={`Nome do poste ${pole.id}`}
                              placeholder="Nome do poste"
                              onChange={(e) =>
                                onBtRenamePole(pole.id, e.target.value)
                              }
                              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                            />
                          )}
                          {pole.id === criticalPoleId && (
                            <div className="mt-0.5 font-bold text-red-500">
                              ⚠ Ponto crítico
                            </div>
                          )}
                          {poleAccumulated && (
                            <div className="mt-1 text-slate-700">
                              <div>
                                CLT acum.: {poleAccumulated.accumulatedClients}
                              </div>
                              <div>
                                Demanda acum.:{" "}
                                {poleAccumulated.accumulatedDemandKva.toFixed(
                                  2,
                                )}{" "}
                                kVA
                              </div>
                              {(typeof poleAccumulated.voltageV === "number" ||
                                typeof poleAccumulated.dvAccumPercent ===
                                  "number") && (
                                <div
                                  className={`mt-0.5 font-semibold ${cqtClass}`}
                                >
                                  Tensão:{" "}
                                  {typeof poleAccumulated.voltageV === "number"
                                    ? poleAccumulated.voltageV.toFixed(2)
                                    : "-"}{" "}
                                  V{" | "}
                                  dV:{" "}
                                  {typeof poleAccumulated.dvAccumPercent ===
                                  "number"
                                    ? poleAccumulated.dvAccumPercent.toFixed(2)
                                    : "-"}
                                  %
                                  {poleAccumulated.cqtStatus
                                    ? ` | ${poleAccumulated.cqtStatus}`
                                    : ""}
                                </div>
                              )}
                              {(typeof poleAccumulated.worstRamalVoltageV ===
                                "number" ||
                                typeof poleAccumulated.worstRamalDvPercent ===
                                  "number") && (
                                <div
                                  className={`mt-0.5 font-semibold ${cqtClass}`}
                                >
                                  Ramal:{" "}
                                  {typeof poleAccumulated.worstRamalVoltageV ===
                                  "number"
                                    ? poleAccumulated.worstRamalVoltageV.toFixed(
                                        2,
                                      )
                                    : "-"}{" "}
                                  V{" | "}
                                  dV:{" "}
                                  {typeof poleAccumulated.worstRamalDvPercent ===
                                  "number"
                                    ? poleAccumulated.worstRamalDvPercent.toFixed(
                                        2,
                                      )
                                    : "-"}
                                  %
                                  {poleAccumulated.worstRamalStatus
                                    ? ` | ${poleAccumulated.worstRamalStatus}`
                                    : ""}
                                </div>
                              )}
                            </div>
                          )}
                          <div
                            className={`mt-0.5 font-semibold ${pole.verified ? "text-green-600" : "text-amber-600"}`}
                          >
                            {pole.verified
                              ? "✓ Verificado"
                              : "○ Não verificado"}
                          </div>
                          <div className="mt-0.5 text-slate-700">
                            Flag:{" "}
                            <strong>
                              {getPoleChangeFlag(pole) === "new"
                                ? "Novo"
                                : getPoleChangeFlag(pole) === "remove"
                                  ? "Remoção"
                                  : getPoleChangeFlag(pole) === "replace"
                                    ? "Substituição"
                                    : "Existente"}
                            </strong>
                          </div>
                          {(pole.circuitBreakPoint ?? false) && (
                            <div className="mt-0.5 font-bold text-sky-700">
                              Separação física ativa: circuito interrompido
                              neste poste.
                            </div>
                          )}
                          {onBtSetPoleChangeFlag && (
                            <div className={POPUP_FLAG_GRID_CLASS}>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onBtSetPoleChangeFlag(pole.id, "existing");
                                }}
                                className={getFlagButtonClass(
                                  getPoleChangeFlag(pole) === "existing",
                                  "existing",
                                )}
                              >
                                Existente
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onBtSetPoleChangeFlag(pole.id, "new");
                                }}
                                className={getFlagButtonClass(
                                  getPoleChangeFlag(pole) === "new",
                                  "new",
                                )}
                              >
                                Novo
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onBtSetPoleChangeFlag(pole.id, "replace");
                                }}
                                className={getFlagButtonClass(
                                  getPoleChangeFlag(pole) === "replace",
                                  "replace",
                                )}
                              >
                                Substituição
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onBtSetPoleChangeFlag(pole.id, "remove");
                                }}
                                className={getFlagButtonClass(
                                  getPoleChangeFlag(pole) === "remove",
                                  "remove",
                                )}
                              >
                                Remoção
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onBtTogglePoleCircuitBreak?.(
                                    pole.id,
                                    !(pole.circuitBreakPoint ?? false),
                                  );
                                }}
                                title="Separa fisicamente o circuito neste poste"
                                className={`h-6 rounded border text-[10px] font-bold tracking-[-0.2px] ${pole.circuitBreakPoint ? "border-sky-400 bg-sky-100 font-mono text-sky-700" : "border-slate-400 bg-white font-mono text-slate-600 hover:bg-slate-50"}`}
                              >
                                -| |-
                              </button>
                            </div>
                          )}
                          <div className={POPUP_TOOLBAR_CLASS}>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onBtDeletePole?.(pole.id);
                              }}
                              className={getIconActionButtonClass("danger")}
                              title="Deletar poste"
                              aria-label="Deletar poste"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onBtToggleTransformerOnPole?.(pole.id);
                              }}
                              title={
                                poleHasTransformer.get(pole.id)
                                  ? "Remover transformador do poste"
                                  : "Adicionar transformador ao poste"
                              }
                              aria-label={
                                poleHasTransformer.get(pole.id)
                                  ? "Remover transformador do poste"
                                  : "Adicionar transformador ao poste"
                              }
                              className={getIconActionButtonClass(
                                "violet",
                                poleHasTransformer.get(pole.id) ?? false,
                              )}
                            >
                              <Triangle
                                size={12}
                                className="rotate-180 fill-current"
                              />
                            </button>
                            {onBtQuickAddPoleRamal && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onBtQuickAddPoleRamal(pole.id);
                                }}
                                title="Informar ramais"
                                aria-label="Informar ramais"
                                className={getIconActionButtonClass("sky")}
                              >
                                <Plus size={12} />
                              </button>
                            )}
                            {onBtQuickRemovePoleRamal && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onBtQuickRemovePoleRamal(pole.id);
                                }}
                                title="Reduzir ramais"
                                aria-label="Reduzir ramais"
                                className={getIconActionButtonClass("slate")}
                              >
                                <Minus size={12} />
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </Pane>

        <Pane name={btTransformersPaneName} style={{ zIndex: 480 }}>
          {(topology.transformers || []).map((transformer) => (
            <Marker
              key={`${transformer.id}-${transformer.verified ? "v" : "u"}`}
              position={[transformer.lat, transformer.lng]}
              icon={makeTransformerIcon(
                !!transformer.verified,
                getTransformerChangeFlag(transformer),
              )}
              zIndexOffset={1400}
              draggable={false}
              eventHandlers={{
                click: () => {
                  if (
                    (btEditorMode === "add-edge" ||
                      btEditorMode === "add-transformer") &&
                    onBtMapClick
                  ) {
                    const linkedPole = transformer.poleId
                      ? polesById.get(transformer.poleId)
                      : null;
                    if (linkedPole) {
                      onBtMapClick({
                        lat: linkedPole.lat,
                        lng: linkedPole.lng,
                        label: linkedPole.title,
                      });
                      return;
                    }

                    onBtMapClick({
                      lat: transformer.lat,
                      lng: transformer.lng,
                      label: transformer.title,
                    });
                  }
                },
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  onBtDragTransformer?.(transformer.id, lat, lng);
                },
              }}
            >
              <Tooltip
                permanent
                direction="bottom"
                offset={[0, 8]}
                opacity={0.85}
              >
                <span className="text-[10px] font-semibold">
                  {transformer.title}
                </span>
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <strong>{transformer.title}</strong>
                  <div>{transformer.id}</div>
                  {onBtRenameTransformer && (
                    <input
                      type="text"
                      value={transformer.title}
                      onChange={(e) =>
                        onBtRenameTransformer(transformer.id, e.target.value)
                      }
                      title="Nome do transformador"
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                    />
                  )}
                  <div>
                    Demanda: {(transformer.demandKva ?? transformer.demandKw ?? 0).toFixed(2)} kVA
                  </div>
                  <div
                    className={`mt-0.5 font-semibold ${transformer.verified ? "text-green-600" : "text-amber-600"}`}
                  >
                    {transformer.verified ? "✓ Verificado" : "○ Não verificado"}
                  </div>
                  <div className="mt-0.5 text-slate-700">
                    Flag:{" "}
                    <strong>
                      {getTransformerChangeFlag(transformer) === "new"
                        ? "Novo"
                        : getTransformerChangeFlag(transformer) === "remove"
                          ? "Remoção"
                          : getTransformerChangeFlag(transformer) === "replace"
                            ? "Substituição"
                            : "Existente"}
                    </strong>
                  </div>
                  {onBtSetTransformerChangeFlag && (
                    <div className={POPUP_FLAG_GRID_CLASS}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBtSetTransformerChangeFlag(
                            transformer.id,
                            "existing",
                          );
                        }}
                        className={getFlagButtonClass(
                          getTransformerChangeFlag(transformer) === "existing",
                          "existing",
                        )}
                      >
                        Existente
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBtSetTransformerChangeFlag(transformer.id, "new");
                        }}
                        className={getFlagButtonClass(
                          getTransformerChangeFlag(transformer) === "new",
                          "new",
                        )}
                      >
                        Novo
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBtSetTransformerChangeFlag(
                            transformer.id,
                            "replace",
                          );
                        }}
                        className={getFlagButtonClass(
                          getTransformerChangeFlag(transformer) === "replace",
                          "replace",
                        )}
                      >
                        Substituição
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBtSetTransformerChangeFlag(
                            transformer.id,
                            "remove",
                          );
                        }}
                        className={getFlagButtonClass(
                          getTransformerChangeFlag(transformer) === "remove",
                          "remove",
                        )}
                      >
                        Remoção
                      </button>
                    </div>
                  )}
                  {onBtDeleteTransformer && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onBtDeleteTransformer(transformer.id);
                      }}
                      className="mt-1 inline-flex h-6 items-center rounded border border-red-500 bg-red-500/10 px-2 text-[11px] text-red-500 transition-colors hover:bg-red-100"
                    >
                      Deletar trafo
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </Pane>

        {geojson && <GeoJSON data={geojson} />}
      </MapContainer>

      {/* Overlay Controls could go here */}
      <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/80 backdrop-blur text-xs p-2 rounded text-slate-400 border border-slate-700">
        {btEditorMode !== "none"
          ? btEditorMode === "add-pole"
            ? "Editor BT: clique para inserir poste"
            : btEditorMode === "add-transformer"
              ? "Editor BT: clique para inserir transformador"
              : pendingBtEdgeStartPoleId
                ? `Editor BT: selecione destino (origem ${pendingBtEdgeStartPoleId})`
                : "Editor BT: selecione poste de origem"
          : selectionMode === "circle"
            ? "Clique para definir o centro"
            : selectionMode === "measure"
              ? "Clique em dois pontos para o perfil"
              : "Clique para adicionar pontos ao polígono"}
      </div>
    </div>
  );
};

export default MapSelector;
