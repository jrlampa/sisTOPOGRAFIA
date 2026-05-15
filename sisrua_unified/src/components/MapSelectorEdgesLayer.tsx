import React from 'react';
import { Pane, Polyline, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { MapBtEdge, MapBtPole, MapBtTopology } from '../types.map';
import { AppLocale, LayerConfig } from '../types';
import { FeatureFlags } from '../types/featureFlags';
import type { BtPoleAccumulatedDemand } from '../utils/btTopologyFlow';
import { SpatialJurisdictionService } from '../services/spatialJurisdictionService';
import {
  getFlagButtonClass,
  getIconActionButtonClass,
  getCqtHeatmapColor,
  POPUP_FLAG_GRID_CLASS,
  POPUP_SELECT_CLASS,
} from './MapSelectorStyles';
import { listConductorsByCategory } from '../services/conductorCatalogRepository';

const CONDUCTOR_OPTIONS_FALLBACK = [
  '70 Al - MX',
  '185 Al - MX',
  '240 Al - MX',
  '25 Al - Arm',
  '50 Al - Arm',
  '95 Al - Arm',
  '150 Al - Arm',
  '240 Al - Arm',
  '25 Al',
  '35 Cu',
  '70 Cu',
  '95 Al',
  '120 Cu',
  '240 Al',
  '240 Cu',
  '500 Cu',
  '10 Cu_CONC_bi',
  '10 Cu_CONC_Tri',
  '16 Al_CONC_bi',
  '16 Al_CONC_Tri',
  '13 Al - DX',
  '13 Al - TX',
  '13 Al - QX',
  '21 Al - QX',
  '53 Al - QX',
  '6 AWG',
  '2 AWG',
  '1/0 AWG',
  '3/0 AWG',
  '4/0 AWG',
];

const EDGE_HIT_AREA_WEIGHT = 44;

type BtEdgeChangeFlag = NonNullable<MapBtEdge['edgeChangeFlag']>;

const getEdgeChangeFlag = (edge: MapBtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }
  return edge.removeOnExecution ? 'remove' : 'existing';
};

const getEdgeVisualConfig = (edge: MapBtEdge) => {
  const flag = getEdgeChangeFlag(edge);
  if (flag === 'new') return { color: '#22c55e', dashArray: '8 6', weight: 3, opacity: 0.8 };
  if (flag === 'remove') return { color: '#ef4444', dashArray: '8 6', weight: 3, opacity: 0.8 };
  if (flag === 'replace')
    return { color: '#facc15', dashArray: undefined, weight: 3, opacity: 0.9 };
  return { color: '#d946ef', dashArray: undefined, weight: 3, opacity: 0.9 };
};

const getRemovalMarkersForEdge = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) => {
  const start = L.latLng(from.lat, from.lng);
  const end = L.latLng(to.lat, to.lng);
  const distanceMeters = Math.max(start.distanceTo(end), 1);
  const markerCount = Math.max(3, Math.min(12, Math.floor(distanceMeters / 6)));
  const points: Array<[number, number]> = [];
  for (let index = 1; index <= markerCount; index += 1) {
    const t = index / (markerCount + 1);
    points.push([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
  }
  return points;
};

// ─── Componente de Vão Individual (Memoizado) ───────────────────────────────

interface BtEdgeComponentProps {
  edge: MapBtEdge;
  from: MapBtPole;
  to: MapBtPole;
  edgeVisual: any;
  edgeChangeFlag: BtEdgeChangeFlag;
  isCurrentlyDragging: boolean;
  currentDistance: number;
  oldDistance: number;
  poleAccumulated?: BtPoleAccumulatedDemand;
  accumulatedData?: BtPoleAccumulatedDemand;
  heatmapColor: string | null;
  isViolation: boolean;
  isInterJurisdictional: boolean;
  distColorClass: string;
  isXRayMode: boolean;
  isGhostMode: boolean;
  flags?: FeatureFlags;
  layerConfig?: LayerConfig;
  onBtDeleteEdge?: (id: string) => void;
  onBtSetEdgeChangeFlag?: (edgeId: string, flag: BtEdgeChangeFlag) => void;
  onBtQuickAddEdgeConductor?: (edgeId: string, name: string) => void;
  onBtQuickRemoveEdgeConductor?: (edgeId: string, name: string) => void;
  popupEventHandlers: any;
  conductorOptions: string[];
}

const MapBtEdgeComponent = React.memo(
  ({
    edge,
    from,
    to,
    edgeVisual,
    edgeChangeFlag,
    isCurrentlyDragging,
    currentDistance,
    oldDistance,
    poleAccumulated,
    accumulatedData: _accumulatedData,
    heatmapColor,
    isViolation,
    isInterJurisdictional,
    distColorClass,
    isXRayMode,
    isGhostMode,
    flags,
    layerConfig,
    onBtDeleteEdge,
    onBtSetEdgeChangeFlag,
    onBtQuickAddEdgeConductor,
    onBtQuickRemoveEdgeConductor,
    popupEventHandlers,
    conductorOptions,
  }: BtEdgeComponentProps) => {
    const [edgeConductorSelection, setEdgeConductorSelection] = React.useState(
      conductorOptions[0] ?? CONDUCTOR_OPTIONS_FALLBACK[0]
    );

    React.useEffect(() => {
      if (!conductorOptions.length) return;
      setEdgeConductorSelection(current =>
        conductorOptions.includes(current) ? current : conductorOptions[0]
      );
    }, [conductorOptions]);

    const hasBt = edge.conductors.length > 0;
    const hasMt = (edge.mtConductors ?? []).length > 0;

    const estimatedCqtStr = React.useMemo(() => {
      if (isCurrentlyDragging && poleAccumulated?.dvAccumPercent) {
        const ratio = currentDistance / (oldDistance || 1);
        const estimatedCqt = poleAccumulated.dvAccumPercent * ratio;
        return `${poleAccumulated.dvAccumPercent.toFixed(1)}% → ${estimatedCqt.toFixed(1)}%`;
      }
      return '';
    }, [isCurrentlyDragging, poleAccumulated, currentDistance, oldDistance]);

    const removalMarkers = React.useMemo(() => {
      if (edgeChangeFlag === 'remove') {
        return getRemovalMarkersForEdge(from, to);
      }
      return [];
    }, [edgeChangeFlag, from, to]);

    const mtPolylinePositions = React.useMemo(() => {
      if (!hasMt) return [];
      const offset = 0.00002;
      const dx = to.lng - from.lng;
      const dy = to.lat - from.lat;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      return [
        [from.lat + nx * offset, from.lng + ny * offset] as [number, number],
        [to.lat + nx * offset, to.lng + ny * offset] as [number, number],
      ];
    }, [hasMt, from, to]);

    return (
      <>
        {isCurrentlyDragging && (
          <Marker
            position={[(from.lat + to.lat) / 2, (from.lng + to.lng) / 2]}
            icon={L.divIcon({
              className: 'dynamic-span-badge',
              html: `
              <div class="flex flex-col items-center gap-1 animate-pulse" style="transform: translateY(-20px);">
                <div class="px-2 py-0.5 rounded-full bg-white/90 border-2 border-white shadow-xl text-[11px] font-black whitespace-nowrap ${distColorClass}">${currentDistance.toFixed(1)}m</div>
                ${estimatedCqtStr ? `<div class="px-2 py-0.5 rounded-lg bg-slate-900/80 text-white text-[9px] font-black border border-white/20 backdrop-blur-sm">CQT Est: ${estimatedCqtStr}</div>` : ''}
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
            color: isInterJurisdictional ? '#f59e0b' : '#000000',
            weight: EDGE_HIT_AREA_WEIGHT,
            opacity: 0.01,
            lineCap: 'round',
            lineJoin: 'round',
          }}
          data-violation={isViolation ? 'true' : undefined}
        >
          {!isGhostMode && (
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
                    title="Excluir vão"
                    aria-label="Excluir vão"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {isInterJurisdictional && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] font-black text-amber-600 uppercase">
                      Fronteira Jurisdicional
                    </span>
                  </div>
                )}

                <div className={POPUP_FLAG_GRID_CLASS}>
                  {(['existing', 'new', 'replace', 'remove'] as BtEdgeChangeFlag[]).map(f => (
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
                  <label className="text-[9px] font-black uppercase text-slate-400">Cabos BT</label>
                  <div className="flex gap-1.5">
                    <select
                      className={POPUP_SELECT_CLASS}
                      value={edgeConductorSelection}
                      title="Selecionar cabo BT"
                      aria-label="Selecionar cabo BT"
                      onChange={e => setEdgeConductorSelection(e.target.value)}
                    >
                      {conductorOptions.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => onBtQuickAddEdgeConductor?.(edge.id, edgeConductorSelection)}
                      title="Adicionar cabo BT"
                      aria-label="Adicionar cabo BT"
                      className={getIconActionButtonClass('violet')}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {edge.conductors.map(c => (
                      <div
                        key={c.id}
                        className="flex items-center gap-1.5 px-2 py-0.5 bg-violet-50 border border-violet-100 rounded-md text-[10px] font-bold text-violet-700"
                      >
                        {c.quantity}x {c.conductorName}
                        <button
                          onClick={() => onBtQuickRemoveEdgeConductor?.(edge.id, c.conductorName)}
                          title="Remover cabo BT"
                          aria-label="Remover cabo BT"
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
          )}
          {layerConfig?.labels && !isGhostMode && (
            <Tooltip permanent direction="center" opacity={0.8} className="bt-edge-tooltip">
              <div className="flex flex-col items-center bg-white/90 px-1 py-0.5 rounded border border-slate-200 shadow-sm pointer-events-none">
                {isInterJurisdictional && (
                  <div className="text-[7px] font-black text-amber-600 uppercase border-b border-amber-100 w-full text-center mb-0.5">
                    Cruzamento
                  </div>
                )}
                {hasBt
                  ? edge.conductors.map(c => (
                      <div key={c.id} className="text-[8px] font-bold text-slate-800 leading-tight">
                        {c.quantity}x{c.conductorName} (BT)
                      </div>
                    ))
                  : null}
                {hasMt &&
                  (edge.mtConductors ?? []).map(c => (
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
        <Polyline
          positions={[
            [from.lat, from.lng],
            [to.lat, to.lng],
          ]}
          pathOptions={{
            color: isInterJurisdictional ? '#f59e0b' : '#ffffff',
            weight: edgeVisual.weight + 3,
            opacity: isGhostMode ? 0.05 : isInterJurisdictional ? 1.0 : 0.72,
            dashArray: isInterJurisdictional ? '4 4' : edgeVisual.dashArray,
            interactive: false,
            lineCap: 'round',
            lineJoin: 'round',
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
            opacity: isGhostMode
              ? 0.1
              : isXRayMode
                ? heatmapColor
                  ? 1.0
                  : 0.05
                : edgeVisual.opacity,
            interactive: false,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        {hasMt && (
          <Polyline
            positions={mtPolylinePositions}
            pathOptions={{
              color: '#f97316',
              weight: 2.5,
              opacity: isGhostMode ? 0.1 : 0.9,
              dashArray: '4 4',
              interactive: false,
            }}
          />
        )}
        {!isGhostMode &&
          removalMarkers.map((position, markerIndex) => (
            <Marker
              key={`${edge.id}-removal-x-${markerIndex}`}
              position={position}
              icon={L.divIcon({
                className: 'bt-edge-remove-label',
                html: '<div class="bt-edge-remove-glyph">X</div>',
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              })}
              interactive={false}
            />
          ))}
      </>
    );
  }
);

MapBtEdgeComponent.displayName = 'MapBtEdgeComponent';

// ─── Componente Principal ───────────────────────────────────────────────────

interface MapSelectorEdgesLayerProps {
  paneName: string;
  topology: MapBtTopology;
  popupTopology?: MapBtTopology;
  polesById: Map<string, MapBtPole>;
  onBtDeleteEdge?: (id: string) => void;
  onBtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: 'existing' | 'new' | 'remove' | 'replace'
  ) => void;
  onBtQuickAddEdgeConductor?: (edgeId: string, conductorName: string) => void;
  onBtQuickRemoveEdgeConductor?: (edgeId: string, conductorName: string) => void;
  onBtSetEdgeLengthMeters?: (edgeId: string, lengthMeters: number) => void;
  onBtSetEdgeReplacementFromConductors?: (
    edgeId: string,
    conductors: Array<{ id: string; quantity: number; conductorName: string }>
  ) => void;
  accumulatedByPoleMap?: Map<string, BtPoleAccumulatedDemand>;
  locale: AppLocale;
  layerConfig?: LayerConfig;
  draggedPole?: { id: string; lat: number; lng: number } | null;
  isGhostMode?: boolean;
  isXRayMode?: boolean;
  flags?: FeatureFlags;
  hasCollision?: boolean;
  jurisdiction?: any;
}

const MapSelectorEdgesLayer: React.FC<MapSelectorEdgesLayerProps> = React.memo(
  ({
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
    isGhostMode = false,
    isXRayMode = false,
    flags,
    jurisdiction,
  }) => {
    const [conductorOptions, setConductorOptions] = React.useState<string[]>(
      CONDUCTOR_OPTIONS_FALLBACK
    );

    React.useEffect(() => {
      let active = true;
      const loadConductorOptions = async () => {
        const conductors = await listConductorsByCategory('BT');
        if (!active || conductors.length === 0) return;
        setConductorOptions(conductors.map(item => item.conductorId));
      };
      void loadConductorOptions();
      return () => {
        active = false;
      };
    }, []);

    const popupEventHandlers = React.useMemo(
      () => ({
        add: (event: any) => {
          const popupEl = event?.popup?.getElement?.() as HTMLElement | null;
          const contentEl = popupEl?.querySelector('.leaflet-popup-content') as HTMLElement | null;
          if (!contentEl) return;
          L.DomEvent.disableClickPropagation(contentEl);
          L.DomEvent.disableScrollPropagation(contentEl);
        },
      }),
      []
    );

    return (
      <Pane name={paneName} style={{ zIndex: 420 }}>
        {(topology.edges || []).map(edge => {
          const fromRaw = polesById.get(edge.fromPoleId);
          const toRaw = polesById.get(edge.toPoleId);
          if (!fromRaw || !toRaw) return null;

          const isDraggingFrom = draggedPole?.id === edge.fromPoleId;
          const isDraggingTo = draggedPole?.id === edge.toPoleId;

          const from = isDraggingFrom
            ? { ...fromRaw, lat: draggedPole!.lat, lng: draggedPole!.lng }
            : fromRaw;
          const to = isDraggingTo
            ? { ...toRaw, lat: draggedPole!.lat, lng: draggedPole!.lng }
            : toRaw;

          const edgeChangeFlag = getEdgeChangeFlag(edge);
          const edgeVisual = getEdgeVisualConfig(edge);
          const isCurrentlyDragging = isDraggingFrom || isDraggingTo;

          const poleAccumulated = accumulatedByPoleMap?.get(
            isDraggingFrom ? edge.fromPoleId : edge.toPoleId
          );
          const accumulatedData = accumulatedByPoleMap?.get(edge.toPoleId);

          const oldDistance = L.latLng(fromRaw.lat, fromRaw.lng).distanceTo(
            L.latLng(toRaw.lat, toRaw.lng)
          );
          const currentDistance = L.latLng(from.lat, from.lng).distanceTo(L.latLng(to.lat, to.lng));

          let heatmapColor: string | null = null;
          if (flags?.enableMechanicalCalculation && layerConfig?.cqtHeatmap && accumulatedData) {
            heatmapColor = getCqtHeatmapColor(accumulatedData.dvAccumPercent ?? 0);
          }

          const isViolation = Boolean(
            flags?.enableMechanicalCalculation && (accumulatedData?.dvAccumPercent ?? 0) > 7
          );

          const isInterJurisdictional = SpatialJurisdictionService.isEdgeInterJurisdictional(
            from.lat,
            from.lng,
            to.lat,
            to.lng,
            jurisdiction
          );

          const distColorClass =
            currentDistance > 40
              ? 'text-red-600'
              : currentDistance > 30
                ? 'text-amber-600'
                : 'text-emerald-600';

          return (
            <MapBtEdgeComponent
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              edgeVisual={edgeVisual}
              edgeChangeFlag={edgeChangeFlag}
              isCurrentlyDragging={isCurrentlyDragging}
              currentDistance={currentDistance}
              oldDistance={oldDistance}
              poleAccumulated={poleAccumulated}
              accumulatedData={accumulatedData}
              heatmapColor={heatmapColor}
              isViolation={isViolation}
              isInterJurisdictional={isInterJurisdictional}
              distColorClass={distColorClass}
              isXRayMode={isXRayMode}
              isGhostMode={isGhostMode}
              flags={flags}
              layerConfig={layerConfig}
              onBtDeleteEdge={onBtDeleteEdge}
              onBtSetEdgeChangeFlag={onBtSetEdgeChangeFlag}
              onBtQuickAddEdgeConductor={onBtQuickAddEdgeConductor}
              onBtQuickRemoveEdgeConductor={onBtQuickRemoveEdgeConductor}
              popupEventHandlers={popupEventHandlers}
              conductorOptions={conductorOptions}
            />
          );
        })}
      </Pane>
    );
  }
);

MapSelectorEdgesLayer.displayName = 'MapSelectorEdgesLayer';

export default MapSelectorEdgesLayer;
