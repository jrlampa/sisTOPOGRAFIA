import React from "react";
import { Pane, CircleMarker, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { Trash2, Triangle, Plus, Minus } from "lucide-react";
import { PoleNode, BtEditorMode, PoleEquipmentType } from "../../types";
import type { BtPoleAccumulatedDemand } from "../../utils/btTopologyFlow";
import {
  getFlagColor,
  getPoleChangeFlag,
  getFlagButtonClass,
  getIconActionButtonClass,
  POPUP_FLAG_GRID_CLASS,
  POPUP_TOOLBAR_CLASS,
} from "../MapSelectorStyles";

// ─── Labels de catálogo ───────────────────────────────────────────────────────

const EQUIPMENT_LABELS: Record<PoleEquipmentType, string> = {
  trafo: "Transformador",
  medicao: "Medição",
  religador: "Religador",
  chave_faca: "Chave-Faca",
  chave_seccionadora: "Ch. Seccionadora",
  para_raios: "Para-Raios",
  banco_capacitor: "Banco Capacitor",
  iluminacao: "Iluminação",
  outro: "Outro",
};

const CONDITION_LABELS: Record<string, string> = {
  bom_estado: "Bom estado",
  desaprumado: "Desaprumado",
  trincado: "Trincado",
  condenado: "Condenado",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapSelectorPolesLayerProps {
  paneName: string;
  poles: PoleNode[];
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
}

// ─── Componente ───────────────────────────────────────────────────────────────

const MapSelectorPolesLayer: React.FC<MapSelectorPolesLayerProps> = ({
  paneName,
  poles,
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
}) => {
  const makePoleIcon = (poleId: string, verified: boolean) => {
    const hasTransformer = !!poleHasTransformer.get(poleId);
    const isCritical = poleId === criticalPoleId;
    const isLoadCenter = !!loadCenterPoleId && poleId === loadCenterPoleId;
    const isPending = poleId === pendingBtEdgeStartPoleId;
    const pole = poles.find((item) => item.id === poleId);
    const poleFlag = pole ? getPoleChangeFlag(pole) : "existing";

    if (hasTransformer) {
      const bg = isLoadCenter
        ? "#059669"
        : getFlagColor(poleFlag, verified ? "#15803d" : "#7c3aed");
      const size = isCritical ? 22 : isLoadCenter ? 22 : isPending ? 20 : 18;
      const glow = isLoadCenter ? "filter: drop-shadow(0 0 5px #34d399);" : "";
      return L.divIcon({
        className: "bt-pole-transformer-icon",
        html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="${glow}filter: drop-shadow(0 0 2px rgba(15, 23, 42, 0.45));"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
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

    // Poste com MT recebe anel laranja externo
    const hasMtRing = pole?.hasMt
      ? `box-shadow:0 0 0 3px #f97316, 0 1px 4px rgba(15,23,42,0.45);`
      : isLoadCenter
        ? "box-shadow:0 0 0 3px #34d39980, 0 0 8px #059669, 0 1px 4px rgba(15, 23, 42, 0.45);"
        : `box-shadow:0 0 0 2px ${bg}50, 0 1px 4px rgba(15, 23, 42, 0.45);`;

    return L.divIcon({
      className: "bt-pole-icon",
      html: `<div style="background:${bg};border:2px solid #ffffff;width:${size}px;height:${size}px;border-radius:9999px;${hasMtRing}"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  return (
    <Pane name={paneName} style={{ zIndex: 470 }}>
      {poles.map((pole) => {
        const poleAccumulated = accumulatedByPoleMap.get(pole.id);
        const cqtClass =
          poleAccumulated?.cqtStatus === "CRÍTICO"
            ? "text-red-600"
            : poleAccumulated?.cqtStatus === "ATENÇÃO"
              ? "text-amber-600"
              : "text-emerald-700";

        const hasBtStructures =
          pole.btStructures && Object.values(pole.btStructures).some((v) => v);
        const hasMtStructures =
          pole.mtStructures && Object.values(pole.mtStructures).some((v) => v);
        const hasEquipments = pole.equipments && pole.equipments.length > 0;
        const totalRamais =
          pole.ramais?.reduce((acc, r) => acc + (r.quantity ?? 0), 0) ?? 0;

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
                <span className="text-[10px] font-semibold">{pole.title}</span>
              </Tooltip>

              <Popup>
                <div className="w-52 space-y-1.5 text-xs">
                  {/* ── Cabeçalho ── */}
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <strong className="text-slate-800">{pole.title}</strong>
                      <div className="font-mono text-[9px] text-slate-400">
                        {pole.id}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      {pole.hasBt && (
                        <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700">
                          BT
                        </span>
                      )}
                      {pole.hasMt && (
                        <span className="rounded bg-orange-100 px-1 py-0.5 text-[9px] font-bold text-orange-700">
                          MT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Renomear ── */}
                  {onBtRenamePole && (
                    <input
                      type="text"
                      value={pole.title}
                      title={`Nome do poste ${pole.id}`}
                      placeholder="Nome do poste"
                      onChange={(e) => onBtRenamePole(pole.id, e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                    />
                  )}

                  {/* ── Alertas ── */}
                  {pole.id === criticalPoleId && (
                    <div className="font-bold text-red-500">
                      ⚠ Ponto crítico
                    </div>
                  )}
                  {pole.circuitBreakPoint && (
                    <div className="font-bold text-sky-700">
                      ⊣⊢ Separação física
                    </div>
                  )}

                  {/* ── Estruturas BT ── */}
                  {hasBtStructures && (
                    <div className="rounded border border-blue-100 bg-blue-50 px-1.5 py-1">
                      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                        Estruturas BT
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-700">
                        {(["si1", "si2", "si3", "si4"] as const).map((k) =>
                          pole.btStructures?.[k] ? (
                            <span key={k}>
                              <span className="font-semibold">
                                {k.toUpperCase()}:
                              </span>{" "}
                              {pole.btStructures[k]}
                            </span>
                          ) : null,
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Estruturas MT ── */}
                  {hasMtStructures && (
                    <div className="rounded border border-orange-100 bg-orange-50 px-1.5 py-1">
                      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700">
                        Estruturas MT
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-700">
                        {(["n1", "n2", "n3", "n4"] as const).map((k) =>
                          pole.mtStructures?.[k] ? (
                            <span key={k}>
                              <span className="font-semibold">
                                {k.toUpperCase()}:
                              </span>{" "}
                              {pole.mtStructures[k]}
                            </span>
                          ) : null,
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Equipamentos ── */}
                  {hasEquipments && (
                    <div className="rounded border border-violet-100 bg-violet-50 px-1.5 py-1">
                      <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700">
                        Equipamentos
                      </div>
                      <ul className="space-y-0.5 text-[10px] text-slate-700">
                        {pole.equipments!.map((eq) => (
                          <li key={eq.id}>
                            • {EQUIPMENT_LABELS[eq.type]}
                            {eq.label ? ` — ${eq.label}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── Ramais ── */}
                  {totalRamais > 0 && (
                    <div className="text-slate-700">
                      Ramais: <strong>{totalRamais}</strong>
                    </div>
                  )}

                  {/* ── CQT / Carga ── */}
                  {poleAccumulated && (
                    <div className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-700">
                      <div>
                        CLT acum.:{" "}
                        <strong>{poleAccumulated.accumulatedClients}</strong>
                      </div>
                      <div>
                        Demanda:{" "}
                        <strong>
                          {poleAccumulated.accumulatedDemandKva.toFixed(2)} kVA
                        </strong>
                      </div>
                      {(typeof poleAccumulated.voltageV === "number" ||
                        typeof poleAccumulated.dvAccumPercent === "number") && (
                        <div className={`mt-0.5 font-semibold ${cqtClass}`}>
                          {poleAccumulated.voltageV?.toFixed(2) ?? "-"} V | dV:{" "}
                          {poleAccumulated.dvAccumPercent?.toFixed(2) ?? "-"}%
                          {poleAccumulated.cqtStatus
                            ? ` | ${poleAccumulated.cqtStatus}`
                            : ""}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Estado físico ── */}
                  {pole.conditionStatus && (
                    <div className="text-slate-600">
                      Condição:{" "}
                      <strong>
                        {CONDITION_LABELS[pole.conditionStatus] ??
                          pole.conditionStatus}
                      </strong>
                    </div>
                  )}

                  {/* ── Verificação e flag ── */}
                  <div
                    className={`font-semibold ${pole.verified ? "text-green-600" : "text-amber-600"}`}
                  >
                    {pole.verified ? "✓ Verificado" : "○ Não verificado"}
                  </div>
                  <div className="text-slate-700">
                    Flag: <strong>{getPoleChangeFlag(pole)}</strong>
                  </div>

                  {/* ── Botões de flag ── */}
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
                              getPoleChangeFlag(pole) === flag,
                              flag,
                            )}
                          >
                            {flag.charAt(0).toUpperCase() + flag.slice(1)}
                          </button>
                        ),
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          onBtTogglePoleCircuitBreak?.(
                            pole.id,
                            !(pole.circuitBreakPoint ?? false),
                          );
                        }}
                        className={`h-6 rounded border text-[10px] font-bold ${pole.circuitBreakPoint ? "border-sky-400 bg-sky-100 text-sky-700" : "border-slate-400 bg-white text-slate-600"}`}
                      >
                        -| |-
                      </button>
                    </div>
                  )}

                  {/* ── Toolbar de ações ── */}
                  <div className={POPUP_TOOLBAR_CLASS}>
                    <button
                      onClick={() => onBtDeletePole?.(pole.id)}
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
