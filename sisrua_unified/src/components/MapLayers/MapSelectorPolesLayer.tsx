import React from "react";
import { Pane, CircleMarker, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { Trash2, Triangle, Plus, Minus } from "lucide-react";
import { BtEditorMode, LayerConfig, AppLocale } from "../../types";
import type { MapBtPole } from "../../types.map";
import type { BtPoleAccumulatedDemand } from "../../utils/btTopologyFlow";
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
  onBtRenamePole?: (poleId: string, title: string) => void;
  onBtSetPoleChangeFlag?: (
    poleId: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtTogglePoleCircuitBreak?: (poleId: string, active: boolean) => void;
  onBtDeletePole?: (poleId: string) => void;
  onBtToggleTransformerOnPole?: (poleId: string) => void;
  onBtQuickAddPoleRamal?: (poleId: string) => void;
  onBtQuickRemovePoleRamal?: (poleId: string) => void;
  onBtSelectPole?: (poleId: string) => void;
  locale: AppLocale;
  layerConfig?: LayerConfig;
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
  onBtRenamePole,
  onBtSetPoleChangeFlag,
  onBtTogglePoleCircuitBreak,
  onBtDeletePole,
  onBtToggleTransformerOnPole,
  onBtQuickAddPoleRamal,
  onBtQuickRemovePoleRamal,
  onBtSelectPole,
  locale,
  layerConfig,
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

        return (
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
                  } else if (onBtSelectPole) {
                    // Sincronização Poste-Driven: seleciona na sidebar ao clicar no mapa
                    onBtSelectPole(pole.id);
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
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold">{pole.title}</span>
                  {layerConfig?.labels && pole.poleSpec && (
                    <span className="text-[8px] text-slate-700">
                      {pole.poleSpec.heightM}m / {pole.poleSpec.nominalEffortDan}
                      daN
                    </span>
                  )}
                  {layerConfig?.labels && pole.btStructures && (
                    <span className="text-[8px] text-sky-700">
                      {[
                        pole.btStructures.si1,
                        pole.btStructures.si2,
                        pole.btStructures.si3,
                        pole.btStructures.si4,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <strong>{popupPole.title}</strong>
                  <div className="text-[10px] text-slate-500">{popupPole.id}</div>

                  {/* BIM Specs Section */}
                  {(popupPole.poleSpec || popupPole.btStructures) && (
                    <div className="mt-1 border-t border-slate-100 pt-1">
                      {popupPole.poleSpec && (
                        <div className="font-semibold text-slate-800">
                          BIM: {popupPole.poleSpec.heightM}m | {popupPole.poleSpec.nominalEffortDan}daN
                        </div>
                      )}
                      {popupPole.btStructures && (
                        <div className="text-sky-800 italic">
                          Estruturas: {[
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
                      <div>CLT acum.: {poleAccumulated.accumulatedClients}</div>
                      <div>
                        Demanda acum.:{" "}
                        {poleAccumulated.accumulatedDemandKva.toFixed(2)} kVA
                      </div>
                      {(typeof poleAccumulated.voltageV === "number" ||
                        typeof poleAccumulated.dvAccumPercent === "number") && (
                        <div className={`mt-0.5 font-semibold ${cqtClass}`}>
                          Tensão: {poleAccumulated.voltageV?.toFixed(2) ?? "-"}{" "}
                          V{" | "}
                          dV:{" "}
                          {poleAccumulated.dvAccumPercent?.toFixed(2) ?? "-"}%
                          {poleAccumulated.cqtStatus
                            ? ` | ${poleAccumulated.cqtStatus}`
                            : ""}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`mt-0.5 font-semibold ${pole.verified ? "text-green-600" : "text-amber-600"}`}
                  >
                    {pole.verified ? `✓ ${t.btnMarkVerified.replace("Marcar poste como ", "")}` : `○ ${t.btnMarkUnverified.replace("Marcar como ", "")}`}
                  </div>
                  <div className="mt-0.5 text-slate-700">
                    Flag: <strong>{
                      getPoleChangeFlag(popupPole) === "new" ? t.flagNew :
                      getPoleChangeFlag(popupPole) === "remove" ? t.flagRemove :
                      getPoleChangeFlag(popupPole) === "replace" ? t.flagReplace :
                      t.flagExisting
                    }</strong>
                  </div>
                  {popupPole.circuitBreakPoint && (
                    <div className="mt-0.5 font-bold text-sky-700">
                      Separação física ativa.
                    </div>
                  )}
                  {onBtSetPoleChangeFlag && (
                    <div className={POPUP_FLAG_GRID_CLASS}>
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
                        className={`h-6 rounded border text-[10px] font-bold ${popupPole.circuitBreakPoint ? "border-sky-400 bg-sky-100 text-sky-700" : "border-slate-400 bg-white text-slate-600"}`}
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
                    >
                      <Trash2 size={12} />
                    </button>
                    <button
                      onClick={() => onBtToggleTransformerOnPole?.(pole.id)}
                      className={getIconActionButtonClass(
                        "violet",
                        !!poleHasTransformer.get(pole.id),
                      )}
                      title="Toggle Trafo"
                    >
                      <Triangle size={12} className="rotate-180 fill-current" />
                    </button>
                    {onBtQuickAddPoleRamal && (
                      <button
                        onClick={() => onBtQuickAddPoleRamal(pole.id)}
                        className={getIconActionButtonClass("sky")}
                        title="Add Ramal"
                      >
                        <Plus size={12} />
                      </button>
                    )}
                    {onBtQuickRemovePoleRamal && (
                      <button
                        onClick={() => onBtQuickRemovePoleRamal(pole.id)}
                        className={getIconActionButtonClass("slate")}
                        title="Rem Ramal"
                      >
                        <Minus size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </Pane>
  );
};

export default MapSelectorPolesLayer;
