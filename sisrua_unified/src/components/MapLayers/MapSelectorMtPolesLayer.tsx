import React from "react";
import { Pane, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { Trash2 } from "lucide-react";
import { MtPoleNode, MtEditorMode, GeoLocation } from "../../types";
import {
  getFlagColor,
  getFlagButtonClass,
  POPUP_FLAG_GRID_CLASS,
  POPUP_TOOLBAR_CLASS,
  getIconActionButtonClass,
} from "../MapSelectorStyles";

interface MapSelectorMtPolesLayerProps {
  paneName: string;
  poles: MtPoleNode[];
  mtEditorMode: MtEditorMode;
  onMtMapClick?: (location: GeoLocation) => void;
  onMtDragPole?: (poleId: string, lat: number, lng: number) => void;
  onMtRenamePole?: (poleId: string, title: string) => void;
  onMtSetPoleChangeFlag?: (
    poleId: string,
    flag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onMtDeletePole?: (poleId: string) => void;
  onMtSetPoleVerified?: (poleId: string, verified: boolean) => void;
}

// ── Helper function ───────────────────────────────────────────────────────

const getMtPoleChangeFlag = (pole: MtPoleNode): "existing" | "new" | "remove" | "replace" =>
  pole.nodeChangeFlag ?? "existing";

const MapSelectorMtPolesLayer: React.FC<MapSelectorMtPolesLayerProps> = ({
  paneName,
  poles,
  mtEditorMode,
  onMtMapClick,
  onMtDragPole,
  onMtRenamePole,
  onMtSetPoleChangeFlag,
  onMtDeletePole,
  onMtSetPoleVerified,
}) => {
  const makeMtPoleIcon = (pole: MtPoleNode) => {
    const flag = pole.nodeChangeFlag ?? "existing";
    const bg = getFlagColor(flag, pole.verified ? "#16a34a" : "#2563eb");
    const size = 16;

    return L.divIcon({
      className: "mt-pole-icon",
      html: `<div style="background:${bg};border:2px solid #ffffff;width:${size}px;height:${size}px;border-radius:9999px;box-shadow:0 0 0 2px ${bg}50, 0 1px 4px rgba(15, 23, 42, 0.45);"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  return (
    <Pane name={paneName} style={{ zIndex: 480 }}>
      {poles.map((pole) => (
        <React.Fragment key={`${pole.id}-${pole.verified ? "v" : "u"}`}>
          <Marker
            position={[pole.lat, pole.lng]}
            icon={makeMtPoleIcon(pole)}
            zIndexOffset={1300}
            draggable={mtEditorMode !== "mt-add-edge"}
            eventHandlers={{
              click: () => {
                if (mtEditorMode === "mt-add-edge" && onMtMapClick) {
                  onMtMapClick({
                    lat: pole.lat,
                    lng: pole.lng,
                    label: pole.title,
                  });
                }
              },
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onMtDragPole?.(pole.id, lat, lng);
              },
            }}
          >
            <Tooltip
              permanent={mtEditorMode === "mt-add-edge"}
              direction="top"
              offset={[0, -10]}
              opacity={0.85}
            >
              <span className="text-[10px] font-bold text-orange-900 dark:text-orange-100">
                {pole.title}
              </span>
            </Tooltip>
            <Popup>
              <div className="text-xs">
                {/* Header com título, ID e status */}
                <div>
                  <strong>{pole.title}</strong>
                  <div className="text-[9px] text-slate-500 font-mono">{pole.id}</div>
                </div>

                {/* Renomear */}
                {onMtRenamePole && (
                  <input
                    type="text"
                    value={pole.title}
                    onChange={(e) => onMtRenamePole(pole.id, e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
                    placeholder="Nome do poste"
                    title="Editar nome"
                  />
                )}

                {/* Status com símbolo */}
                <div
                  className={`mt-0.5 font-semibold ${pole.verified ? "text-green-600" : "text-amber-600"}`}
                >
                  {pole.verified ? "✓ Verificado" : "○ Não verificado"}
                </div>

                {/* Exibição da flag */}
                <div className="mt-0.5 text-slate-700">
                  Flag: <strong>{getMtPoleChangeFlag(pole)}</strong>
                </div>

                {/* Grid de flags */}
                {onMtSetPoleChangeFlag && (
                  <div className={POPUP_FLAG_GRID_CLASS}>
                    {(["existing", "new", "replace", "remove"] as const).map(
                      (flag) => (
                        <button
                          key={flag}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onMtSetPoleChangeFlag(pole.id, flag);
                          }}
                          className={getFlagButtonClass(
                            getMtPoleChangeFlag(pole) === flag,
                            flag,
                          )}
                        >
                          {flag.charAt(0).toUpperCase() + flag.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                )}

                {/* Toolbar com botões */}
                <div className={POPUP_TOOLBAR_CLASS}>
                  <button
                    onClick={() => onMtSetPoleVerified?.(pole.id, !pole.verified)}
                    className={`flex-1 rounded px-2 py-0.5 text-[9px] font-bold transition-colors ${
                      pole.verified
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                    }`}
                  >
                    {pole.verified ? "DESMARCAR" : "VERIFICAR"}
                  </button>

                  {onMtDeletePole && (
                    <button
                      onClick={() => onMtDeletePole(pole.id)}
                      className={getIconActionButtonClass("danger")}
                      title="Deletar poste"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        </React.Fragment>
      ))}
    </Pane>
  );
};

export default MapSelectorMtPolesLayer;
