import React from "react";
import { Pane, CircleMarker, Marker, Tooltip, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import { Trash2, Triangle, Plus, Minus, CheckCircle, Circle as CircleIcon } from "lucide-react";
import { BtEditorMode, LayerConfig, AppLocale } from "../../types";
import { MapBtPole } from "../../types.map";
import { BtPoleAccumulatedDemand } from "../../utils/btTopologyFlow";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import {
  getFlagColor,
  getPoleChangeFlag,
  getFlagButtonClass,
  getIconActionButtonClass,
  POPUP_FLAG_GRID_CLASS,
  POPUP_TOOLBAR_CLASS,
} from "../MapSelectorStyles";

interface MapSelectorPolesLayerProps {
  paneName: string;
  poles: MapBtPole[];
  popupPoles?: MapBtPole[];
  btEditorMode: BtEditorMode;
  criticalPoleId: string | null;
  loadCenterPoleId?: string | null;
  pendingBtEdgeStartPoleId: string | null;
  poleHasTransformer: Map<string, boolean>;
  accumulatedByPoleMap: Map<string, BtPoleAccumulatedDemand>;
  onBtMapClick?: (location: {
    lat: number;
    lng: number;
    label?: string;
  }) => void;
  onBtDragPole?: (poleId: string, lat: number, lng: number) => void;
  onBtDragPoleRealtime?: (poleId: string, lat: number, lng: number) => void;
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (poleId: string, active: boolean) => void;
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
}

const MapSelectorPolesLayer: React.FC<MapSelectorPolesLayerProps> = ({
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
}) => {
  const t = getBtTopologyPanelText(locale).poleVerification;
  const popupPolesById = React.useMemo(
    () => new Map((popupPoles ?? poles).map((pole) => [pole.id, pole])),
    [popupPoles, poles],
  );

  const makePoleIcon = (poleId: string, verified: boolean) => {
    const hasTransformer = !!poleHasTransformer.get(poleId);
    const isCritical = poleId === criticalPoleId;
    const isLoadCenter = !!loadCenterPoleId && poleId === loadCenterPoleId;
    const isPending = poleId === pendingBtEdgeStartPoleId;
    const pole = poles.find((item) => item.id === poleId);
    const poleFlag = pole ? getPoleChangeFlag(pole) : "existing";
    const dataSource = pole?.dataSource;

    const sourceBadge = dataSource === "dg_calculated" 
      ? `<div style="position:absolute;top:-4px;right:-4px;background:#7c3aed;color:white;border-radius:4px;padding:1px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);"><svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>`
      : dataSource === "manual"
      ? `<div style="position:absolute;top:-4px;right:-4px;background:#0ea5e9;color:white;border-radius:4px;padding:1px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);"><svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`
      : "";

    if (hasTransformer) {
      const bg = isLoadCenter
        ? "#059669"
        : getFlagColor(poleFlag, verified ? "#15803d" : "#7c3aed");
      const size = isCritical ? 22 : isLoadCenter ? 22 : isPending ? 20 : 18;
      const glow = isLoadCenter ? ` filter: drop-shadow(0 0 5px #34d399);` : "";
      return L.divIcon({
        className: "bt-pole-transformer-icon",
        html: `<div style="position:relative;width:${size}px;height:${size}px;"><svg width="${size}" height="${size}" viewBox="0 0 24 24" style="${glow}filter: drop-shadow(0 0 2px rgba(15, 23, 42, 0.45));"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>${sourceBadge}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    }

    let bg = "#2563eb";
    let size = 16;
    if (isCritical) {
      bg = "#ef4444";
      size = 20;
    } else if (isLoadCenter) {
      bg = "#059669";
      size = 20;
    } else if (isPending) {
      bg = "#f59e0b";
      size = 18;
    } else {
      bg = getFlagColor(poleFlag, verified ? "#16a34a" : "#2563eb");
    }
    return L.divIcon({
      className: "bt-pole-icon",
      html: `<div style="position:relative;width:${size}px;height:${size}px;"><div style="background:${bg};border:2px solid #ffffff;width:${size}px;height:${size}px;border-radius:9999px;${isLoadCenter ? "box-shadow:0 0 0 3px #34d39980, 0 0 8px #059669, 0 1px 4px rgba(15, 23, 42, 0.45);" : `box-shadow:0 0 0 2px ${bg}50, 0 1px 4px rgba(15, 23, 42, 0.45);`}"></div>${sourceBadge}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  return (
    <Pane name={paneName} style={{ zIndex: 470 }}>
      {poles.map((pole) => {
        const popupPole = popupPolesById.get(pole.id) ?? pole;
        const poleAccumulated = accumulatedByPoleMap.get(pole.id);
        const cqtClass =
          poleAccumulated?.cqtStatus === "CRÍTICO"
            ? "text-red-600"
            : poleAccumulated?.cqtStatus === "ATENÇÃO"
              ? "text-amber-600"
              : "text-emerald-700";

        const isLeaf = leafPoleIds.has(pole.id);
        const hasTransformer = !!poleHasTransformer.get(pole.id);
        const isDragged = draggedPole?.id === pole.id;
        const dragPos = isDragged && draggedPole ? L.latLng(draggedPole.lat, draggedPole.lng) : null;
        
        const isViolation =
          poleAccumulated?.cqtStatus === "CRÍTICO" ||
          pole.id === criticalPoleId;

        return (
          <React.Fragment
            key={`${pole.id}-${pole.verified ? "v" : "u"}-${pole.id === criticalPoleId ? "c" : "n"}-${pole.id === pendingBtEdgeStartPoleId ? "p" : "x"}-${hasTransformer ? "t" : "nt"}`}
          >
            {/* Círculo de Alcance (Ghost Range) durante o Arrasto (UX: Prevenção de erro) */}
            {isDragged && dragPos && (
              <Pane name="drag-range-pane" style={{ zIndex: 400 }}>
                <Circle
                  center={dragPos}
                  radius={30}
                  pathOptions={{ color: "#3b82f6", weight: 1, fillOpacity: 0.05, interactive: false }}
                />
                <Circle
                  center={dragPos}
                  radius={40}
                  pathOptions={{ color: "#f59e0b", weight: 1, fillOpacity: 0.03, dashArray: "5 5", interactive: false }}
                />
              </Pane>
            )}

            {/* Rótulo Permanente de CQT nas Pontas (UX: Redução de ruído) */}
            {isLeaf && poleAccumulated?.dvAccumPercent != null && (
              <Marker
                position={[pole.lat, pole.lng]}
                icon={L.divIcon({
                  className: "cqt-leaf-label",
                  html: `<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-1.5 py-0.5 rounded-md border-2 border-white shadow-lg text-[10px] font-black whitespace-nowrap bg-white/90 ${cqtClass} animate-in zoom-in-50 duration-300" style="transform: translate(-50%, -10px); pointer-events: none; animation: subtle-bounce 2s infinite ease-in-out;">${poleAccumulated.dvAccumPercent.toFixed(1)}%</div><style>@keyframes subtle-bounce { 0%, 100% { transform: translate(-50%, -10px); } 50% { transform: translate(-50%, -14px); } }</style>`,
                  iconSize: [0, 0],
                })}
                interactive={false}
              />
            )}

            <CircleMarker
              center={[pole.lat, pole.lng]}
              data-violation={isViolation ? "true" : undefined}
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
                fillColor: getFlagColor(
                  getPoleChangeFlag(pole),
                  pole.verified ? "#16a34a" : "#2563eb",
                ),
                fillOpacity: isXRayMode ? (isViolation ? 1.0 : 0.05) : 0.95,
                opacity: isXRayMode ? (isViolation ? 1.0 : 0.05) : 1,
                className: isXRayMode && isViolation ? "critical-neon-glow" : undefined
              }}
              interactive={false}
            />
            <Marker
              position={[pole.lat, pole.lng]}
              icon={makePoleIcon(pole.id, !!pole.verified)}
              zIndexOffset={1200}
              data-violation={isViolation ? "true" : undefined}
              draggable={
                btEditorMode !== "add-edge" &&
                btEditorMode !== "add-transformer"
              }
              eventHandlers={{
                click: (e) => {
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
                  } else if (onBtSelectPole) {
                    // Sincronização Poste-Driven: seleciona na sidebar ao clicar no mapa
                    onBtSelectPole(pole.id, e.originalEvent.shiftKey);
                  }
                },
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  onBtDragPole?.(pole.id, lat, lng);
                  onBtDragPoleRealtime?.(pole.id, 0, 0); // Clear realtime state
                },
                drag: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  onBtDragPoleRealtime?.(pole.id, lat, lng);
                },
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -12]}
                opacity={1}
                className="bim-pop-in-tooltip"
              >
                <div className="min-w-[140px] overflow-hidden rounded-2xl border border-white/20 bg-slate-900/40 p-3 shadow-2xl backdrop-blur-md dark:bg-zinc-950/60">
                  <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                      {pole.title || pole.id.slice(-4)}
                    </span>
                    {isViolation && (
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold uppercase text-white/40">CQT</span>
                        <span className={`text-xs font-black ${cqtClass.replace('text-', 'text-white')}`}>
                          {poleAccumulated?.dvAccumPercent?.toFixed(1) ?? "-"}%
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[8px] font-bold uppercase text-white/40">Dmd</span>
                        <span className="text-xs font-black text-white/90">
                          {poleAccumulated?.accumulatedDemandKva?.toFixed(1) ?? "0"}k
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[8px] font-bold uppercase text-white/40">Esforço</span>
                      <span className="text-[9px] font-black text-sky-400">
                        {pole.poleSpec?.nominalEffortDan ?? "N/D"} daN
                      </span>
                    </div>

                  </div>
                </div>
              </Tooltip>
              {!layerConfig?.disablePopups && (
                <Popup>
                  <div className="text-xs min-w-[200px]">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-2">
                      <div>
                        <strong className="text-sm">{popupPole.title}</strong>
                        <div className="text-[10px] text-slate-400 font-mono uppercase">{popupPole.id}</div>
                      </div>
                      {isLeaf && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider">{t.pontaLabel}</span>
                      )}
                    </div>

                    {/* Resultados de Engenharia Detalhados */}
                    {poleAccumulated && (
                      <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg mb-3 border border-slate-100">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 uppercase font-bold tracking-tighter">{t.cargaAcumulada}</span>
                          <span className="font-black text-slate-900">{poleAccumulated.accumulatedDemandKva.toFixed(2)} kVA</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 uppercase font-bold tracking-tighter">{t.quedaTensao}</span>
                          <span className={`font-black ${cqtClass}`}>
                            {poleAccumulated.dvAccumPercent?.toFixed(2) ?? "-"}%
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500 uppercase font-bold tracking-tighter">{t.tensaoNo}</span>
                          <span className="font-bold text-slate-700">{poleAccumulated.voltageV?.toFixed(1) ?? "-"} V</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-200/50">
                          <span className="text-slate-400 uppercase">{t.clientes} {poleAccumulated.accumulatedClients}</span>
                          {poleAccumulated.cqtStatus && (
                            <span className={`px-1 rounded-sm text-[9px] font-black uppercase ${
                              poleAccumulated.cqtStatus === "OK" ? "bg-emerald-100 text-emerald-700" :
                              poleAccumulated.cqtStatus === "ATENÇÃO" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {t.statusLabel} {poleAccumulated.cqtStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* BIM Specs Section */}
                    {(popupPole.poleSpec || popupPole.btStructures) && (
                      <div className="mt-1 border-t border-slate-100 pt-1 pb-2">
                        {popupPole.poleSpec && (
                          <div className="font-semibold text-slate-800">
                            {t.bimTitle} {popupPole.poleSpec.heightM}m | {popupPole.poleSpec.nominalEffortDan}daN
                          </div>
                        )}
                        {popupPole.btStructures && (
                          <div className="text-sky-800 italic text-[10px]">
                            {t.structuresLabel} {[
                              popupPole.btStructures.si1,
                              popupPole.btStructures.si2,
                              popupPole.btStructures.si3,
                              popupPole.btStructures.si4,
                            ].filter(Boolean).join(", ") || "-"}
                          </div>
                        )}
                      </div>
                    )}
                    {onBtRenamePole && (
                      <input
                        type="text"
                        value={popupPole.title}
                        title={`Nome do poste ${pole.id}`}
                        placeholder="Nome do poste"
                        onChange={(e) => onBtRenamePole(pole.id, e.target.value)}
                        className="mb-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                      />
                    )}
                    {pole.id === criticalPoleId && (
                      <div className="mb-2 font-black text-red-600 bg-red-50 p-1.5 rounded-md border border-red-200 text-center animate-pulse">
                        {t.criticalWarning}
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-1 text-[11px] border-t border-slate-100 pt-2 mt-1">
                      <div className={`flex items-center gap-1.5 font-bold ${pole.verified ? "text-green-600" : "text-amber-600"}`}>
                        {pole.verified ? <CheckCircle size={12} /> : <CircleIcon size={12} />}
                        {pole.verified ? t.flagExisting : "Pendente de Verificação"}
                      </div>
                      <div className="text-slate-500">
                        Estado: <span className="font-bold text-slate-700">{
                          getPoleChangeFlag(popupPole) === "new" ? t.flagNew :
                          getPoleChangeFlag(popupPole) === "remove" ? t.flagRemove :
                          getPoleChangeFlag(popupPole) === "replace" ? t.flagReplace :
                          t.flagExisting
                        }</span>
                      </div>
                    </div>

                    {popupPole.circuitBreakPoint && (
                      <div className="mt-2 font-black text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-200 text-center text-[10px]">
                        {t.separationActive}
                      </div>
                    )}

                    {onBtSetPoleChangeFlag && (
                      <div className={`${POPUP_FLAG_GRID_CLASS} mt-3`}>
                        {(["existing", "new", "replace", "remove"] as const).map(
                          (flag) => (
                            <button
                              key={flag}
                              onClick={(e) => {
                                e.preventDefault();
                                onBtSetPoleChangeFlag(pole.id, flag);
                              }}
                              className={getFlagButtonClass(
                                getPoleChangeFlag(popupPole) === flag,
                                flag,
                              )}
                            >
                              {flag === "new" ? t.flagNew :
                               flag === "remove" ? t.flagRemove :
                               flag === "replace" ? t.flagReplace :
                               t.flagExisting}
                            </button>
                          ),
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onBtTogglePoleCircuitBreak?.(
                              pole.id,
                              !(popupPole.circuitBreakPoint ?? false),
                            );
                          }}
                          className={`h-6 rounded border text-xs font-bold ${popupPole.circuitBreakPoint ? "border-sky-400 bg-sky-100 text-sky-700" : "border-slate-400 bg-white text-slate-600"}`}
                          title="Alternar Separação de Circuito"
                        >
                          -| |-
                        </button>
                      </div>
                    )}

                    <div className={`${POPUP_TOOLBAR_CLASS} mt-4 pt-2 border-t border-slate-100`}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBtDeletePole?.(pole.id);
                        }}
                        className={getIconActionButtonClass("danger")}
                        title="Deletar poste"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => onBtToggleTransformerOnPole?.(pole.id)}
                        className={getIconActionButtonClass(
                          "violet",
                          !!hasTransformer,
                        )}
                        title="Alternar Transformador"
                      >
                        <Triangle size={14} className="rotate-180 fill-current" />
                      </button>
                      {onBtQuickAddPoleRamal && (
                        <button
                          onClick={() => onBtQuickAddPoleRamal(pole.id)}
                          className={getIconActionButtonClass("sky")}
                          title="Adicionar Ramal"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      {onBtQuickRemovePoleRamal && (
                        <button
                          onClick={() => onBtQuickRemovePoleRamal(pole.id)}
                          className={getIconActionButtonClass("slate")}
                          title="Remover Ramal"
                        >
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              )}
            </Marker>
          </React.Fragment>
        );
      })}
    </Pane>
  );
};

export default MapSelectorPolesLayer;
