import React from 'react';
import { Pane, CircleMarker, Marker, Tooltip, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Trash2, Plus, Minus, Zap } from 'lucide-react';
import { BtEditorMode, LayerConfig, AppLocale } from '../../types';
import { FeatureFlags } from '../../types/featureFlags';
import { MapBtPole } from '../../types.map';
import { BtPoleAccumulatedDemand } from '../../utils/btTopologyFlow';
import {
  getFlagButtonClass,
  getIconActionButtonClass,
  POPUP_FLAG_GRID_CLASS,
} from '../MapSelectorStyles';
import { getBtPoleColor, getBtPoleFillColor } from '../../theme/btTopologyTheme';

// ─── Componente de Marcador Individual (Memoizado) ───────────────────────────

interface PoleMarkerProps {
  pole: MapBtPole;
  popupPole: MapBtPole;
  btEditorMode: BtEditorMode;
  isCritical: boolean;
  isLoadCenter: boolean;
  isPending: boolean;
  hasTransformer: boolean;
  poleAccumulated?: BtPoleAccumulatedDemand;
  isLeaf: boolean;
  isDragged: boolean;
  dragPos: L.LatLng | null;
  isXRayMode: boolean;
  isGhostMode: boolean;
  flags?: FeatureFlags;
  complianceViolation?: boolean;
  complianceDetail?: string;
  locale: AppLocale;
  layerConfig?: LayerConfig;
  onBtMapClick?: (loc: { lat: number; lng: number; label?: string }) => void;
  onBtDragPole?: (id: string, lat: number, lng: number) => void;
  onBtDragPoleRealtime?: (id: string, lat: number, lng: number) => void;
  onBtRenamePole?: (id: string, title: string) => void;
  onBtSetPoleChangeFlag?: (id: string, flag: any) => void;
  onBtTogglePoleCircuitBreak?: (id: string, breakPoint: boolean) => void;
  onBtDeletePole?: (id: string) => void;
  onBtToggleTransformerOnPole?: (poleId: string) => void;
  onBtQuickAddPoleRamal?: (poleId: string) => void;
  onBtQuickRemovePoleRamal?: (poleId: string) => void;
  onBtSelectPole?: (poleId: string, isShiftSelect?: boolean) => void;
}

const MapBtPoleMarker = React.memo(
  ({
    pole,
    popupPole,
    btEditorMode,
    isCritical,
    isLoadCenter,
    isPending,
    hasTransformer,
    poleAccumulated,
    isLeaf,
    isDragged,
    dragPos,
    isXRayMode,
    isGhostMode,
    flags,
    complianceViolation = false,
    complianceDetail = '',
    locale: _locale,
    layerConfig,
    onBtMapClick: _onBtMapClick,
    onBtDragPole,
    onBtDragPoleRealtime,
    onBtRenamePole,
    onBtSetPoleChangeFlag,
    onBtTogglePoleCircuitBreak,
    onBtDeletePole,
    onBtToggleTransformerOnPole,
    onBtQuickAddPoleRamal,
    onBtQuickRemovePoleRamal,
    onBtSelectPole,
  }: PoleMarkerProps) => {
    const t = {
      bimTitle: 'BIM Spec:',
      criticalLabel: 'CRÍTICO',
      loadCenterLabel: 'CENTRO DE CARGA',
      pendingLabel: 'PENDENTE',
      renamePlaceholder: 'Novo título...',
      deleteTitle: 'Remover Poste',
      addRamal: 'Adicionar Ramal',
      removeRamal: 'Remover Ramal',
      toggleTrafo: 'Alternar Trafo',
      circuitBreak: 'Ponto de Seccionamento',
    };

    const pos = L.latLng(pole.lat, pole.lng);
    const color = getBtPoleColor(pole, isCritical, isPending);
    const fillColor = getBtPoleFillColor(pole, isCritical, isLoadCenter);
    const radius = isCritical ? 9 : isLoadCenter ? 10 : 7;

    const eventHandlers = React.useMemo(
      () => ({
        click: (e: any) => {
          L.DomEvent.stopPropagation(e);
          if (onBtSelectPole) {
            onBtSelectPole(pole.id, e.originalEvent.shiftKey);
          }
        },
        dragstart: () => {
          if (onBtDragPoleRealtime) onBtDragPoleRealtime(pole.id, pole.lat, pole.lng);
        },
        drag: (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          if (onBtDragPoleRealtime) onBtDragPoleRealtime(pole.id, lat, lng);
        },
        dragend: (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          if (onBtDragPole) onBtDragPole(pole.id, lat, lng);
          if (onBtDragPoleRealtime) onBtDragPoleRealtime(pole.id, 0, 0);
        },
      }),
      [pole.id, pole.lat, pole.lng, onBtDragPole, onBtDragPoleRealtime, onBtSelectPole]
    );

    const cqtClass =
      poleAccumulated?.cqtStatus === 'CRÍTICO'
        ? 'text-red-500'
        : poleAccumulated?.cqtStatus === 'ATENÇÃO'
          ? 'text-amber-500'
          : 'text-emerald-500';

    return (
      <>
        {isDragged && dragPos && (
          <Pane name="pole-drag-pane" style={{ zIndex: 400 }}>
            <Circle
              center={dragPos}
              radius={30}
              pathOptions={{
                color: '#3b82f6',
                weight: 1,
                fillOpacity: 0.05,
                interactive: false,
              }}
            />
            <Circle
              center={dragPos}
              radius={1.5}
              pathOptions={{
                color: '#3b82f6',
                weight: 2,
                fillOpacity: 0.8,
                interactive: false,
              }}
            />
          </Pane>
        )}

        <Pane name="pole-interaction-pane" style={{ zIndex: 490 }}>
          <Pane name="pole-base-pane" style={{ zIndex: 480 }}>
            <CircleMarker
              center={pos}
              radius={radius}
              pathOptions={{
                color: isGhostMode ? '#94a3b8' : color,
                weight: isGhostMode ? 1 : 2.5,
                fillColor: isGhostMode ? '#cbd5e1' : fillColor,
                fillOpacity: isGhostMode ? 0.05 : 0.9,
                opacity: isGhostMode ? 0.1 : isXRayMode ? (complianceViolation ? 1.0 : 0.05) : 1.0,
                interactive: !isGhostMode,
              }}
              eventHandlers={!isGhostMode ? eventHandlers : {}}
              data-violation={complianceViolation ? 'true' : 'false'}
            >
              {!isGhostMode && (
                <Popup className="bt-pole-popup">
                  <div className="min-w-[220px] space-y-4 p-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Poste
                        </span>
                        <span className="text-xs font-bold text-slate-800">{pole.id}</span>
                      </div>
                      <button
                        onClick={() => onBtDeletePole?.(pole.id)}
                        title="Remover poste"
                        aria-label="Remover poste"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-400">
                        Identificação
                      </label>
                      <input
                        type="text"
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors"
                        value={pole.title}
                        onChange={e => onBtRenamePole?.(pole.id, e.target.value)}
                        placeholder={t.renamePlaceholder}
                      />
                    </div>

                    <div className={POPUP_FLAG_GRID_CLASS}>
                      {(['existing', 'new', 'replace', 'remove'] as const).map(f => (
                        <button
                          key={f}
                          className={getFlagButtonClass(pole.nodeChangeFlag === f, f)}
                          onClick={() => onBtSetPoleChangeFlag?.(pole.id, f)}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {(popupPole.poleSpec || popupPole.btStructures) && (
                      <div className="mt-1 border-t border-slate-100 pt-1 pb-2">
                        {flags?.enableMechanicalCalculation && popupPole.poleSpec && (
                          <div className="font-semibold text-slate-800">
                            {t.bimTitle} {popupPole.poleSpec.heightM}m |{' '}
                            {popupPole.poleSpec.nominalEffortDan}daN
                          </div>
                        )}
                        {popupPole.btStructures && (
                          <div className="text-[10px] text-slate-500">
                            Estruturas:{' '}
                            {Object.values(popupPole.btStructures).filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onBtToggleTransformerOnPole?.(pole.id)}
                        className={getIconActionButtonClass(hasTransformer ? 'amber' : 'slate')}
                      >
                        <Zap size={14} className={hasTransformer ? 'fill-current' : ''} />
                        <span className="text-[9px] font-bold">Trafo</span>
                      </button>
                      <button
                        onClick={() =>
                          onBtTogglePoleCircuitBreak?.(pole.id, !pole.circuitBreakPoint)
                        }
                        className={getIconActionButtonClass(
                          pole.circuitBreakPoint ? 'rose' : 'slate'
                        )}
                      >
                        <Minus size={14} className={pole.circuitBreakPoint ? 'stroke-[4]' : ''} />
                        <span className="text-[9px] font-bold">Corte</span>
                      </button>
                      <button
                        onClick={() => onBtQuickAddPoleRamal?.(pole.id)}
                        className={getIconActionButtonClass('emerald')}
                      >
                        <Plus size={14} />
                        <span className="text-[9px] font-bold">+ Ramal</span>
                      </button>
                      <button
                        onClick={() => onBtQuickRemovePoleRamal?.(pole.id)}
                        className={getIconActionButtonClass('rose')}
                      >
                        <Minus size={14} />
                        <span className="text-[9px] font-bold">- Ramal</span>
                      </button>
                    </div>
                  </div>
                </Popup>
              )}
              {layerConfig?.labels && !isGhostMode && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  opacity={0.9}
                  className="bt-pole-tooltip"
                >
                  <div className="flex flex-col items-center bg-slate-900/90 text-white px-2 py-1 rounded-lg border border-white/20 shadow-2xl backdrop-blur-sm pointer-events-none min-w-[60px]">
                    <div className="text-[10px] font-black tracking-tighter mb-1 border-b border-white/10 w-full text-center pb-0.5 whitespace-nowrap">
                      {pole.title || pole.id}
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold uppercase text-white/40">CQT</span>
                          <span
                            className={`text-xs font-black ${cqtClass.replace('text-', 'text-white')}`}
                          >
                            {poleAccumulated?.dvAccumPercent?.toFixed(1) ?? '-'}%
                          </span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[8px] font-bold uppercase text-white/40">Dmd</span>
                          <span className="text-xs font-black text-white/90">
                            {poleAccumulated?.accumulatedDemandKva?.toFixed(1) ?? '0'}k
                          </span>
                        </div>
                      </div>
                      {flags?.enableMechanicalCalculation && (
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="text-[8px] font-bold uppercase text-white/40">
                            Esforço
                          </span>
                          <span className="text-[9px] font-black text-sky-400">
                            {pole.poleSpec?.nominalEffortDan ?? 'N/D'} daN
                          </span>
                        </div>
                      )}
                    </div>
                    {complianceViolation && (
                      <div className="mt-2 pt-1 border-t border-red-500/30 text-[8px] font-black text-red-400 flex items-center gap-1 uppercase italic">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Auditoria: {complianceDetail}
                      </div>
                    )}
                  </div>
                </Tooltip>
              )}
            </CircleMarker>
          </Pane>

          {!isGhostMode &&
            (isCritical || isLoadCenter || isPending || hasTransformer || isLeaf) && (
              <Pane name="pole-overlay-pane" style={{ zIndex: 485 }}>
                <Marker
                  position={pos}
                  icon={L.divIcon({
                    className: 'bt-pole-indicators',
                    html: `
                    <div class="flex flex-col items-center gap-0.5" style="transform: translateY(-24px);">
                      ${hasTransformer ? '<div class="w-2.5 h-2.5 bg-amber-500 rounded-sm shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"></div>' : ''}
                      ${isCritical ? '<div class="px-1 bg-red-600 text-white text-[7px] font-black rounded shadow-lg">!!!</div>' : ''}
                      ${isLoadCenter ? '<div class="w-3 h-3 bg-cyan-400 rounded-full border-2 border-white shadow-xl"></div>' : ''}
                    </div>
                  `,
                    iconSize: [0, 0],
                  })}
                  interactive={false}
                />
              </Pane>
            )}
        </Pane>

        {!isGhostMode && btEditorMode === 'move-pole' && (
          <Marker
            position={pos}
            draggable={true}
            eventHandlers={eventHandlers}
            icon={L.divIcon({
              className: 'bt-pole-drag-handle',
              html: '<div class="w-8 h-8 -ml-4 -mt-4 bg-transparent cursor-move"></div>',
              iconSize: [32, 32],
            })}
          />
        )}
      </>
    );
  }
);

MapBtPoleMarker.displayName = 'MapBtPoleMarker';

// ─── Componente Principal ───────────────────────────────────────────────────

interface MapSelectorPolesLayerProps {
  paneName: string;
  poles: MapBtPole[];
  popupPoles?: MapBtPole[];
  btEditorMode: BtEditorMode;
  criticalPoleId: string | null;
  loadCenterPoleId: string | null;
  pendingBtEdgeStartPoleId: string | null;
  poleHasTransformer: Map<string, boolean>;
  accumulatedByPoleMap: Map<string, BtPoleAccumulatedDemand>;
  onBtMapClick?: (loc: { lat: number; lng: number; label?: string }) => void;
  onBtDragPole?: (id: string, lat: number, lng: number) => void;
  onBtDragPoleRealtime?: (id: string, lat: number, lng: number) => void;
  onBtRenamePole?: (id: string, title: string) => void;
  onBtSetPoleChangeFlag?: (id: string, flag: any) => void;
  onBtTogglePoleCircuitBreak?: (id: string, breakPoint: boolean) => void;
  onBtDeletePole?: (id: string) => void;
  onBtToggleTransformerOnPole?: (poleId: string) => void;
  onBtQuickAddPoleRamal?: (poleId: string) => void;
  onBtQuickRemovePoleRamal?: (poleId: string) => void;
  onBtSelectPole?: (poleId: string, isShiftSelect?: boolean) => void;
  leafPoleIds?: Set<string>;
  draggedPole?: { id: string; lat: number; lng: number } | null;
  locale: AppLocale;
  layerConfig?: LayerConfig;
  isXRayMode?: boolean;
  isGhostMode?: boolean;
  hasCollision?: boolean;
  complianceResults?: {
    urban?: any[];
    environmental?: any[];
    solar?: { results: any[] };
  };
  flags?: FeatureFlags;
}

const MapSelectorPolesLayer: React.FC<MapSelectorPolesLayerProps> = React.memo(
  ({
    paneName,
    poles,
    popupPoles,
    btEditorMode,
    criticalPoleId,
    loadCenterPoleId,
    pendingBtEdgeStartPoleId,
    poleHasTransformer,
    accumulatedByPoleMap,
    onBtMapClick,
    onBtDragPole,
    onBtDragPoleRealtime,
    onBtRenamePole,
    onBtSetPoleChangeFlag,
    onBtTogglePoleCircuitBreak,
    onBtDeletePole,
    onBtToggleTransformerOnPole,
    onBtQuickAddPoleRamal,
    onBtQuickRemovePoleRamal,
    onBtSelectPole,
    leafPoleIds = new Set(),
    draggedPole,
    locale,
    layerConfig,
    isXRayMode = false,
    isGhostMode = false,
    complianceResults,
    flags,
  }) => {
    const popupPolesById = React.useMemo(
      () => new Map((popupPoles ?? poles).map(pole => [pole.id, pole])),
      [popupPoles, poles]
    );

    return (
      <Pane name={paneName} style={{ zIndex: 470 }}>
        {poles.map(pole => {
          const isDragged = draggedPole?.id === pole.id;
          const dragPos =
            isDragged && draggedPole ? L.latLng(draggedPole.lat, draggedPole.lng) : null;
          const hasTransformer = !!poleHasTransformer.get(pole.id);

          const urbanViolation = flags?.enableNbr9050
            ? complianceResults?.urban?.find((r: any) => r.poleId === pole.id && !r.conforme)
            : null;
          const envViolation = flags?.enableEnvironmentalAudit
            ? complianceResults?.environmental?.find((r: any) => r.poleId === pole.id)
            : null;
          const solarData = complianceResults?.solar?.results?.find(
            (r: any) => r.ativoId === pole.id
          );
          const solarViolation =
            flags?.enableSolarShading &&
            (solarData?.nivelRiscoTermico === 'alto' || solarData?.nivelRiscoTermico === 'critico');

          const complianceViolation = !!urbanViolation || !!envViolation || solarViolation;
          const complianceDetail =
            urbanViolation?.detalhe ||
            envViolation?.nomeArea ||
            (solarViolation ? `Risco Térmico: ${solarData.eficienciaPercent}%` : '');

          return (
            <MapBtPoleMarker
              key={pole.id}
              pole={pole}
              popupPole={popupPolesById.get(pole.id) ?? pole}
              btEditorMode={btEditorMode}
              isCritical={pole.id === criticalPoleId}
              isLoadCenter={!!loadCenterPoleId && pole.id === loadCenterPoleId}
              isPending={pole.id === pendingBtEdgeStartPoleId}
              hasTransformer={hasTransformer}
              poleAccumulated={accumulatedByPoleMap.get(pole.id)}
              isLeaf={leafPoleIds.has(pole.id)}
              isDragged={isDragged}
              dragPos={dragPos}
              isXRayMode={isXRayMode}
              isGhostMode={isGhostMode}
              flags={flags}
              complianceViolation={complianceViolation}
              complianceDetail={complianceDetail}
              locale={locale}
              layerConfig={layerConfig}
              onBtMapClick={onBtMapClick}
              onBtDragPole={onBtDragPole}
              onBtDragPoleRealtime={onBtDragPoleRealtime}
              onBtRenamePole={onBtRenamePole}
              onBtSetPoleChangeFlag={onBtSetPoleChangeFlag}
              onBtTogglePoleCircuitBreak={onBtTogglePoleCircuitBreak}
              onBtDeletePole={onBtDeletePole}
              onBtToggleTransformerOnPole={onBtToggleTransformerOnPole}
              onBtQuickAddPoleRamal={onBtQuickAddPoleRamal}
              onBtQuickRemovePoleRamal={onBtQuickRemovePoleRamal}
              onBtSelectPole={onBtSelectPole}
            />
          );
        })}
      </Pane>
    );
  }
);

MapSelectorPolesLayer.displayName = 'MapSelectorPolesLayer';

export default MapSelectorPolesLayer;
