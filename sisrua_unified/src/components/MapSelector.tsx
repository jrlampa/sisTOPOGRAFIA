import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { GeoJsonObject } from "geojson";
import SelectionManager from "./MapSelectorSelectionManager";
import MapSelectorEdgesLayer from "./MapSelectorEdgesLayer";
import MapSelectorPolesLayer from "./MapLayers/MapSelectorPolesLayer";
import MapSelectorTransformersLayer from "./MapLayers/MapSelectorTransformersLayer";
import MapSelectorMtEdgesLayer from "./MapLayers/MapSelectorMtEdgesLayer";
import MapSelectorMtPolesLayer from "./MapLayers/MapSelectorMtPolesLayer";
import {
  BtEditorMode,
  BtRamalEntry,
  MtEditorMode,
  SelectionMode,
  GeoLocation,
} from "../types";
import type { MapBtTopology, MapMtTopology } from "../types.map";
import type { BtPoleAccumulatedDemand } from "../utils/btTopologyFlow";
import { DefaultIcon } from "./MapSelectorStyles";

// Initialize Leaflet Default Icon fix
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
    action: "mt-add-pole" | "mt-add-edge",
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
  onMtContextAction: _onMtContextAction,
  onMtDeletePole,
  onMtDeleteEdge,
  onMtRenamePole,
  onMtSetPoleVerified,
  onMtDragPole,
  onMtSetPoleChangeFlag,
  onMtSetEdgeChangeFlag,
}) => {
  const topology = btMarkerTopology ?? {
    poles: [],
    transformers: [],
    edges: [],
  };
  const popupTopology = btPopupTopology ?? topology;
  const paneIdSuffix = React.useId().replace(/:/g, "-");
  const btEdgesPaneName = `bt-edges-pane-${paneIdSuffix}`;
  const btPolesPaneName = `bt-poles-pane-${paneIdSuffix}`;
  const btTransformersPaneName = `bt-transformers-pane-${paneIdSuffix}`;
  const mtEdgesPaneName = `mt-edges-pane-${paneIdSuffix}`;
  const mtPolesPaneName = `mt-poles-pane-${paneIdSuffix}`;

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
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
      >
        <TileLayer
          key={tileConfig.key}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          maxZoom={24}
          maxNativeZoom={tileConfig.maxNativeZoom}
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
          onBtMapClick={onBtMapClick}
          onBtDragPole={onBtDragPole}
          onBtRenamePole={onBtRenamePole}
          onBtSetPoleChangeFlag={onBtSetPoleChangeFlag}
          onBtTogglePoleCircuitBreak={onBtTogglePoleCircuitBreak}
          onBtDeletePole={onBtDeletePole}
          onBtToggleTransformerOnPole={onBtToggleTransformerOnPole}
          onBtQuickAddPoleRamal={onBtQuickAddPoleRamal}
          onBtQuickRemovePoleRamal={onBtQuickRemovePoleRamal}
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
            />
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default MapSelector;
