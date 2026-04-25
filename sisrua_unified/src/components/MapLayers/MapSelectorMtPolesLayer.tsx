import React from "react";
import { Pane, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { Trash2 } from "lucide-react";
import { MtEditorMode, GeoLocation, LayerConfig } from "../../types";
import type { MapMtPole } from "../../types.map";
import {
  getFlagColor,
  getFlagButtonClass,
  POPUP_FLAG_GRID_CLASS,
} from "../MapSelectorStyles";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import { AppLocale } from "../../types";

interface MapSelectorMtPolesLayerProps {
  paneName: string;
  poles: MapMtPole[];
  popupPoles?: MapMtPole[];
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
  locale: AppLocale;
  layerConfig?: LayerConfig;
}

const MapSelectorMtPolesLayer: React.FC<MapSelectorMtPolesLayerProps> = ({
  paneName,
  poles,
  popupPoles,
  mtEditorMode,
  onMtMapClick,
  onMtDragPole,
  onMtRenamePole,
  onMtSetPoleChangeFlag,
  onMtDeletePole,
  onMtSetPoleVerified,
  locale,
  layerConfig,
}) => {
  const t = getBtTopologyPanelText(locale).poleVerification;
  const popupPolesById = React.useMemo(
    () => new Map((popupPoles ?? poles).map((pole) => [pole.id, pole])),
    [popupPoles, poles],
  );

  const makeMtPoleIcon = (pole: MapMtPole) => {
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
      {poles.map((pole) => {
        const popupPole = popupPolesById.get(pole.id) ?? pole;

        return (
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
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-orange-900 dark:text-orange-100">
                    {pole.title}
                  </span>
                  {layerConfig?.labels && pole.mtStructures && (
                    <span className="text-[8px] font-bold text-orange-700">
                      {[
                        pole.mtStructures.n1,
                        pole.mtStructures.n2,
                        pole.mtStructures.n3,
                        pole.mtStructures.n4,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div className="text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <strong>Poste MT: {popupPole.title}</strong>
                    <span
                      className={`text-[9px] font-bold ${popupPole.verified ? "text-green-600" : "text-orange-600"}`}
                    >
                      {popupPole.verified ? "VERIFICADO" : "PENDENTE"}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-500 font-mono text-[9px]">
                    {popupPole.id}
                  </div>

                  {/* MT BIM Specs Section */}
                  {popupPole.mtStructures && (
                    <div className="mt-1 border-t border-slate-100 pt-1">
                      <div className="text-orange-800 italic">
                        Estruturas MT: {[
                          popupPole.mtStructures.n1,
                          popupPole.mtStructures.n2,
                          popupPole.mtStructures.n3,
                          popupPole.mtStructures.n4,
                        ].filter(Boolean).join(", ") || "-"}
                      </div>
                    </div>
                  )}

                  {onMtRenamePole && (
                    <input
                      type="text"
                      value={popupPole.title}
                      onChange={(e) => onMtRenamePole(pole.id, e.target.value)}
                      className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
                      placeholder="Nome do poste MT"
                      title="Editar nome"
                    />
                  )}

                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        Estado
                      </span>
                      <button
                        onClick={() =>
                          onMtSetPoleVerified?.(pole.id, !popupPole.verified)
                        }
                        className={`rounded px-2 py-0.5 text-[9px] font-bold transition-colors ${
                          popupPole.verified
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                        }`}
                      >
                        {popupPole.verified ? "DESMARCAR" : "VERIFICAR"}
                      </button>
                    </div>

                    <div className={POPUP_FLAG_GRID_CLASS}>
                      {(["existing", "new", "replace", "remove"] as const).map(
                        (flag) => (
                          <button
                            key={flag}
                            onClick={() =>
                              onMtSetPoleChangeFlag?.(pole.id, flag)
                            }
                            className={getFlagButtonClass(
                              (popupPole.nodeChangeFlag ?? "existing") === flag,
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
                    </div>

                    {onMtDeletePole && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onMtDeletePole(pole.id);
                        }}
                        className="flex h-7 items-center justify-center gap-1.5 rounded-lg border border-red-500 bg-red-50 text-[10px] font-black uppercase text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                        Excluir Poste MT
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

export default MapSelectorMtPolesLayer;
