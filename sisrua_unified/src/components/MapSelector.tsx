import React, { useState, useMemo, useId, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  Polyline,
  Marker,
  Circle,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { GeoJsonObject } from "geojson";
import SelectionManager from "./MapSelectorSelectionManager";
import MapSelectorEdgesLayer from "./MapSelectorEdgesLayer";
import MapSelectorPolesLayer from "./MapLayers/MapSelectorPolesLayer";
import MapSelectorTransformersLayer from "./MapLayers/MapSelectorTransformersLayer";
import MapSelectorMtEdgesLayer from "./MapLayers/MapSelectorMtEdgesLayer";
import MapSelectorMtPolesLayer from "./MapLayers/MapSelectorMtPolesLayer";
import MapSelectorDgOverlay from "./MapLayers/MapSelectorDgOverlay";
import {
  BtEditorMode,
  BtRamalEntry,
  MtEditorMode,
  SelectionMode,
  GeoLocation,
  AppLocale,
  LayerConfig,
  OsmElement,
  AppTheme,
} from "../types";
import {
  MapBtPole,
  MapBtTopology,
  MapMtTopology,
} from "../types.map";
import { BtPoleAccumulatedDemand } from "../utils/btTopologyFlow";
import { DgScenario } from "../hooks/useDgOptimization";
import { DefaultIcon } from "./MapSelectorStyles";
import { applyOrthoSnap, applyRoadSnap } from "../utils/smartSnapping";

// Initialize Leaflet Default Icon fix
L.Marker.prototype.options.icon = DefaultIcon;

// ─── Subcomponentes Internos para UX Dinâmica ─────────────────────────────────

/**
 * Rastreador de mouse para capturar coordenadas em tempo real no mapa.
 */
function MapMouseTracker({
  onMouseMove,
}: {
  onMouseMove: (pos: L.LatLng) => void;
}) {
  useMapEvents({
    mousemove(e) {
      onMouseMove(e.latlng);
    },
  });
  return null;
}

/**
 * Renderiza um "Vão Fantasma" (Ghost Edge) ao iniciar uma nova conexão.
 */
function GhostEdge({
  startPole,
  mousePos,
}: {
  startPole: MapBtPole;
  mousePos: L.LatLng;
}) {
  const distance = L.latLng(startPole.lat, startPole.lng).distanceTo(mousePos);
  const color =
    distance > 40 ? "#ef4444" : distance > 30 ? "#f59e0b" : "#3b82f6";

  return (
    <>
      <Polyline
        positions={[
          [startPole.lat, startPole.lng],
          [mousePos.lat, mousePos.lng],
        ]}
        pathOptions={{ color, weight: 2, dashArray: "5 10", opacity: 0.6 }}
      />
      <Marker
        position={[
          (startPole.lat + mousePos.lat) / 2,
          (startPole.lng + mousePos.lng) / 2,
        ]}
        icon={L.divIcon({
          className: "ghost-edge-label",
          html: `<div class="px-2 py-0.5 rounded-full bg-white/90 border border-slate-200 shadow-md text-[10px] font-black whitespace-nowrap" style="color: ${color}; transform: translateY(-10px);">${distance.toFixed(1)}m</div>`,
          iconSize: [0, 0],
        })}
        interactive={false}
      />
      <Circle
        center={[startPole.lat, startPole.lng]}
        radius={30}
        pathOptions={{
          color: "#3b82f6",
          weight: 1,
          fillOpacity: 0.02,
          interactive: false,
        }}
      />
      <Circle
        center={[startPole.lat, startPole.lng]}
        radius={40}
        pathOptions={{
          color: "#f59e0b",
          weight: 1,
          fillOpacity: 0.01,
          dashArray: "5 5",
          interactive: false,
        }}
      />
    </>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

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
  measurePath?: [number, number][];
  onMeasurePathChange?: (path: [number, number][]) => void;
  btMarkerTopology?: MapBtTopology;
  btPopupTopology?: MapBtTopology;
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
  onBtSelectPole?: (poleId: string, isShiftSelect?: boolean) => void;
  criticalPoleId?: string | null;
  accumulatedByPole?: BtPoleAccumulatedDemand[];
  loadCenterPoleId?: string | null;
  onKmlDrop?: (file: File) => void;
  mapStyle?: string;
  onMapStyleChange?: (style: string) => void;
  showAnalysis?: boolean;
  geojson?: GeoJsonObject | null;
  keyboardPanEnabled?: boolean;
  mtMarkerTopology?: MapMtTopology;
  mtPopupTopology?: MapMtTopology;
  mtEditorMode?: MtEditorMode;
  onMtMapClick?: (location: GeoLocation) => void;
  onMtContextAction?: (
    action: "add-pole" | "add-edge",
    location: GeoLocation,
  ) => void;
  onMtDeletePole?: (id: string) => void;
  onMtDeleteEdge?: (id: string) => void;
  onMtRenamePole?: (poleId: string, title: string) => void;
  onMtSetPoleVerified?: (poleId: string, verified: boolean) => void;
  onMtDragPole?: (poleId: string, lat: number, lng: number) => void;
  onMtSetPoleChangeFlag?: (
    poleId: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onMtSetEdgeChangeFlag?: (
    edgeId: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
  /** Cenário DG ativo para sobreposição visual no mapa. */
  dgScenario?: DgScenario | null;
  /** Ativa o Ghost Mode (esmaece a rede original) para contraste visual do cenário DG. */
  dgGhostMode?: boolean;
  onBoxSelect?: (bounds: L.LatLngBounds) => void;
  osmData?: OsmElement[] | null;
  locale: AppLocale;
  layerConfig?: LayerConfig;
  theme?: AppTheme;
}

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
  btMarkerTopology,
  btPopupTopology,
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
  onBtSetPoleVerified: _onBtSetPoleVerified,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  onBtSetTransformerChangeFlag,
  onBtDragPole,
  onBtDragTransformer,
  onBtSelectPole,
  criticalPoleId,
  accumulatedByPole = [],
  loadCenterPoleId,
  onKmlDrop,
  mapStyle = "dark",
  onMapStyleChange: _onMapStyleChange,
  showAnalysis: _showAnalysis = false,
  keyboardPanEnabled = false,
  mtMarkerTopology,
  mtPopupTopology,
  mtEditorMode = "none",
  onMtMapClick,
  onMtContextAction,
  onMtDeletePole,
  onMtDeleteEdge,
  onMtRenamePole,
  onMtSetPoleVerified,
  onMtDragPole,
  onMtSetPoleChangeFlag,
  onMtSetEdgeChangeFlag,
  dgScenario,
  dgGhostMode = false,
  onBoxSelect,
  osmData,
  locale,
  layerConfig,
  theme,
}) => {
  const [draggedPole, setDraggedPole] = useState<{
    id: string;
    lat: number;
    lng: number;
    snapId?: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState<L.LatLng | null>(null);
  const [isXRayMode, setIsXRayMode] = useState(false);

  // UX: Atalho de teclado para X-Ray Mode (X ou Shift)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "shift" || k === "x") setIsXRayMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "shift" || k === "x") setIsXRayMode(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const topology = btMarkerTopology ?? {
    poles: [],
    transformers: [],
    edges: [],
  };
  const popupTopology = btPopupTopology ?? topology;
  const paneIdSuffix = useId().replace(/:/g, "-");
  const btEdgesPaneName = `bt-edges-pane-${paneIdSuffix}`;
  const btPolesPaneName = `bt-poles-pane-${paneIdSuffix}`;
  const btTransformersPaneName = `bt-transformers-pane-${paneIdSuffix}`;
  const mtEdgesPaneName = `mt-edges-pane-${paneIdSuffix}`;
  const mtPolesPaneName = `mt-poles-pane-${paneIdSuffix}`;
  const dgOverlayPaneName = `dg-overlay-pane-${paneIdSuffix}`;

  const polesById = useMemo(() => {
    return new Map(topology.poles.map((pole) => [pole.id, pole]));
  }, [topology.poles]);

  const accumulatedByPoleMap = useMemo(() => {
    return new Map(accumulatedByPole.map((entry) => [entry.poleId, entry]));
  }, [accumulatedByPole]);

  const poleHasTransformer = useMemo(() => {
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onKmlDrop && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onKmlDrop(e.dataTransfer.files[0]);
    }
  };

  const tileConfig = useMemo(() => {
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

  const isEditing = btEditorMode !== "none" || mtEditorMode !== "none";
  const isBtEditing = btEditorMode !== "none";
  const cursorClass = isEditing ? "map-cursor-active" : "";
  const dimClass = isBtEditing ? "map-bt-editing" : "";
  const ghostClass = dgGhostMode ? "map-dg-ghost-mode" : "";
  const xrayClass = isXRayMode ? "map-xray-mode" : "";
  const themeClass = `map-theme-${theme || "dark"}`;

  const handleBtDragRealtime = (id: string, lat: number, lng: number) => {
    if (lat === 0) {
      setDraggedPole(null);
      return;
    }

    // 1. Tenta Snap para o eixo da rua (OSM)
    let snapResult = applyRoadSnap(lat, lng, osmData || []);

    // 2. Se não deu snap na rua, tenta snap ortogonal nos vizinhos
    if (!snapResult.type) {
      const pole = polesById.get(id);
      if (pole) {
        const neighbors = topology.edges
          .filter((e) => e.fromPoleId === id || e.toPoleId === id)
          .map((e) => {
            const neighborId = e.fromPoleId === id ? e.toPoleId : e.fromPoleId;
            const p = polesById.get(neighborId);
            return p ? { id: p.id, lat: p.lat, lng: p.lng } : null;
          })
          .filter((p): p is NonNullable<typeof p> => !!p);

        snapResult = applyOrthoSnap(lat, lng, neighbors);
      }
    }

    setDraggedPole({
      id,
      lat: snapResult.lat,
      lng: snapResult.lng,
      snapId: snapResult.snapId,
    });
  };

  return (
    <div
      className={`relative z-0 h-full min-h-[400px] w-full overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-100/5 shadow-2xl glass-premium ${cursorClass} ${dimClass} ${ghostClass} ${xrayClass} ${themeClass}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <style>{`
        .map-cursor-active .leaflet-container {
          cursor: crosshair !important;
        }

        /* Sunlight Mode: High Contrast for field use */
        .map-theme-sunlight .leaflet-tile-pane {
          filter: contrast(1.5) brightness(1.2) grayscale(100%) !important;
          opacity: 1 !important;
        }
        .map-theme-sunlight .leaflet-overlay-pane svg path {
          stroke-width: 3.5 !important;
          filter: none !important;
          opacity: 1 !important;
        }
        .map-theme-sunlight .leaflet-marker-pane .leaflet-marker-icon {
          filter: none !important;
          opacity: 1 !important;
        }
        .map-theme-sunlight.map-bt-editing .leaflet-tile-pane {
          filter: contrast(2) brightness(1.5) grayscale(100%) !important;
          opacity: 0.4 !important;
        }
        .map-theme-sunlight .bim-pop-in-tooltip > div {
          background: #ffff00 !important;
          color: #000000 !important;
          border: 2px solid #000000 !important;
          backdrop-filter: none !important;
        }
        .map-theme-sunlight .bim-pop-in-tooltip span {
          color: #000000 !important;
        }

        /* Auto-dimming: quando em modo edição BT, camadas base perdem saturação
           para que a rede BT (postes/vãos) seja o foco visual dominante. */
        .map-bt-editing .leaflet-tile-pane {
          filter: saturate(0.25) brightness(1.1) contrast(0.9);
          transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .map-bt-editing .leaflet-overlay-pane svg path:not([data-layer="bt"]) {
          opacity: 0.2;
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Indicador visual de modo ativo */
        .map-bt-editing::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 1rem;
          border: 3px solid rgba(56, 189, 248, 0.4);
          pointer-events: none;
          z-index: 500;
          box-shadow: 
            inset 0 0 30px rgba(56, 189, 248, 0.1),
            0 0 15px rgba(56, 189, 248, 0.2);
          transition: all 0.6s ease;
          animation: map-active-glow 3s infinite alternate;
        }

        @keyframes map-active-glow {
          from { border-color: rgba(56, 189, 248, 0.3); box-shadow: inset 0 0 20px rgba(56, 189, 248, 0.05); }
          to { border-color: rgba(56, 189, 248, 0.6); box-shadow: inset 0 0 40px rgba(56, 189, 248, 0.2); }
        }

        /* Ghost Mode: Esmaece camadas BT/MT para dar destaque visual ao DG (Frente 3) */
        .map-dg-ghost-mode .leaflet-tile-pane {
          filter: grayscale(80%) opacity(0.5) contrast(0.8);
          transition: filter 0.6s ease;
        }
        .map-dg-ghost-mode .leaflet-overlay-pane svg path:not(.dg-overlay-path) {
          opacity: 0.15;
          filter: grayscale(100%);
          transition: all 0.6s ease;
        }
        .map-dg-ghost-mode .leaflet-marker-pane .leaflet-marker-icon:not(.dg-marker) {
          opacity: 0.3;
          filter: grayscale(100%);
          transition: all 0.6s ease;
        }

        /* X-Ray Mode: Focus Mode 2.0 */
        .map-xray-mode .leaflet-tile-pane {
          filter: grayscale(100%) brightness(0.2) contrast(1.2) blur(1px);
          opacity: 0.1;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .map-xray-mode .leaflet-overlay-pane svg path:not([data-violation="true"]) {
          opacity: 0.05;
          filter: grayscale(100%);
          transition: all 0.5s ease;
        }
        .map-xray-mode .leaflet-marker-pane .leaflet-marker-icon:not([data-violation="true"]) {
          opacity: 0.1;
          filter: grayscale(100%) blur(2px);
          transition: all 0.5s ease;
        }
        .map-xray-mode [data-violation="true"] {
          filter: 
            drop-shadow(0 0 10px #ef4444) 
            drop-shadow(0 0 20px #ef4444)
            brightness(1.5);
          opacity: 1 !important;
          z-index: 1000 !important;
          animation: violation-neon-pulse 1.5s infinite alternate;
        }
        @keyframes violation-neon-pulse {
          from { filter: drop-shadow(0 0 10px #ef4444) brightness(1.2); }
          to { filter: drop-shadow(0 0 25px #ef4444) drop-shadow(0 0 40px #ef4444) brightness(1.8); }
        }

        /* Snapping Guides */
        .snapping-guide-line {
          filter: drop-shadow(0 0 3px rgba(34, 211, 238, 0.8));
          stroke-dasharray: 4, 8;
          animation: guide-pulse 2s infinite ease-in-out;
        }
        @keyframes guide-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .leaflet-container {
          background: transparent !important;
          transition: filter 0.5s ease;
        }
        
        /* High-fidelity 2.5D Elevation shadow simulation */
        .leaflet-marker-pane .bt-pole-icon {
          filter: drop-shadow(2px 4px 3px rgba(0,0,0,0.3));
          transition: filter 0.3s ease;
        }
        .leaflet-marker-pane .bt-pole-icon:hover {
          filter: drop-shadow(3px 6px 5px rgba(0,0,0,0.4)) brightness(1.1);
        }
      `}</style>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        scrollWheelZoom={true}
        maxZoom={24}
        className="h-full min-h-[400px] w-full"
        preferCanvas={true}
      >
        <MapMouseTracker onMouseMove={setMousePos} />

        {/* Vão Fantasma (Ghost Edge) em modo de adição de trecho */}
        {pendingBtEdgeStartPoleId &&
          mousePos &&
          polesById.has(pendingBtEdgeStartPoleId) && (
            <GhostEdge
              startPole={polesById.get(pendingBtEdgeStartPoleId)!}
              mousePos={mousePos}
            />
          )}

        {/* Snapping Guides Visual Confirmation */}
        {draggedPole?.snapId && polesById.has(draggedPole.snapId) && (
          <Polyline
            positions={[
              [draggedPole.lat, draggedPole.lng],
              [
                polesById.get(draggedPole.snapId)!.lat,
                polesById.get(draggedPole.snapId)!.lng,
              ],
            ]}
            pathOptions={{
              color: "#22d3ee",
              weight: 2,
              className: "snapping-guide-line",
            }}
          />
        )}

        <TileLayer
          key={tileConfig.key}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          referrerPolicy="strict-origin-when-cross-origin"
          maxZoom={24}
          maxNativeZoom={tileConfig.maxNativeZoom}
        />

        <SelectionManager
          locale={locale}
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
          mtEditorMode={mtEditorMode}
          onMtMapClick={onMtMapClick}
          onMtContextAction={onMtContextAction}
          keyboardPanEnabled={keyboardPanEnabled}
          onBoxSelect={onBoxSelect}
        />

        <MapSelectorEdgesLayer
          paneName={btEdgesPaneName}
          topology={topology}
          popupTopology={popupTopology}
          polesById={polesById}
          onBtDeleteEdge={onBtDeleteEdge}
          onBtSetEdgeChangeFlag={onBtSetEdgeChangeFlag}
          onBtQuickAddEdgeConductor={onBtQuickAddEdgeConductor}
          onBtQuickRemoveEdgeConductor={onBtQuickRemoveEdgeConductor}
          onBtSetEdgeLengthMeters={onBtSetEdgeLengthMeters}
          onBtSetEdgeReplacementFromConductors={
            onBtSetEdgeReplacementFromConductors
          }
          accumulatedByPoleMap={accumulatedByPoleMap}
          locale={locale}
          layerConfig={layerConfig}
          draggedPole={draggedPole}
        />

        <MapSelectorPolesLayer
          paneName={btPolesPaneName}
          poles={topology.poles}
          popupPoles={popupTopology.poles}
          btEditorMode={btEditorMode}
          criticalPoleId={criticalPoleId ?? null}
          pendingBtEdgeStartPoleId={pendingBtEdgeStartPoleId ?? null}
          loadCenterPoleId={loadCenterPoleId ?? null}
          poleHasTransformer={poleHasTransformer}
          accumulatedByPoleMap={accumulatedByPoleMap}
          leafPoleIds={(() => {
            const parentPoleIds = new Set<string>();
            topology.edges.forEach((edge) => {
              const edgeFlag =
                edge.edgeChangeFlag ??
                (edge.removeOnExecution ? "remove" : "existing");
              if (edgeFlag !== "remove") parentPoleIds.add(edge.fromPoleId);
            });
            const leaves = new Set<string>();
            topology.poles.forEach((p) => {
              if (!parentPoleIds.has(p.id)) leaves.add(p.id);
            });
            return leaves;
          })()}
          onBtMapClick={onBtMapClick}
          onBtDragPole={onBtDragPole}
          onBtDragPoleRealtime={handleBtDragRealtime}
          onBtRenamePole={onBtRenamePole}
          onBtSetPoleChangeFlag={onBtSetPoleChangeFlag}
          onBtTogglePoleCircuitBreak={onBtTogglePoleCircuitBreak}
          onBtDeletePole={onBtDeletePole}
          onBtToggleTransformerOnPole={onBtToggleTransformerOnPole}
          onBtQuickAddPoleRamal={onBtQuickAddPoleRamal}
          onBtQuickRemovePoleRamal={onBtQuickRemovePoleRamal}
          onBtSelectPole={onBtSelectPole}
          draggedPole={draggedPole}
          locale={locale}
          layerConfig={layerConfig}
        />

        <MapSelectorTransformersLayer
          paneName={btTransformersPaneName}
          transformers={topology.transformers}
          btEditorMode={btEditorMode}
          polesById={polesById}
          onBtMapClick={onBtMapClick}
          onBtDragTransformer={onBtDragTransformer}
          onBtRenameTransformer={onBtRenameTransformer}
          onBtSetTransformerChangeFlag={onBtSetTransformerChangeFlag}
          onBtDeleteTransformer={onBtDeleteTransformer}
          locale={locale}
          layerConfig={layerConfig}
        />

        {mtMarkerTopology && (
          <>
            <MapSelectorMtEdgesLayer
              paneName={mtEdgesPaneName}
              topology={mtMarkerTopology}
              popupTopology={mtPopupTopology ?? mtMarkerTopology}
              polesById={new Map(mtMarkerTopology.poles.map((p) => [p.id, p]))}
              onMtDeleteEdge={onMtDeleteEdge}
              onMtSetEdgeChangeFlag={onMtSetEdgeChangeFlag}
              locale={locale}
            />
            <MapSelectorMtPolesLayer
              paneName={mtPolesPaneName}
              poles={mtMarkerTopology.poles}
              popupPoles={(mtPopupTopology ?? mtMarkerTopology).poles}
              mtEditorMode={mtEditorMode}
              onMtMapClick={onMtMapClick}
              onMtDragPole={onMtDragPole}
              onMtRenamePole={onMtRenamePole}
              onMtSetPoleChangeFlag={onMtSetPoleChangeFlag}
              onMtDeletePole={onMtDeletePole}
              onMtSetPoleVerified={onMtSetPoleVerified}
              locale={locale}
              layerConfig={layerConfig}
            />
          </>
        )}

        {/* Sobreposição DG – exibida quando há cenário ativo */}
        {dgScenario && (
          <MapSelectorDgOverlay
            paneName={dgOverlayPaneName}
            scenario={dgScenario}
            polesById={polesById}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapSelector;
