import React from "react";
import { Pane, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { Trash2 } from "lucide-react";
import { BtEditorMode, LayerConfig, AppLocale } from "../../types";
import type { MapBtPole, MapBtTransformer } from "../../types.map";
import {
  getFlagColor,
  getTransformerChangeFlag,
  getFlagButtonClass,
  getIconActionButtonClass,
  POPUP_FLAG_GRID_CLASS,
  POPUP_TOOLBAR_CLASS,
} from "../MapSelectorStyles";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";

interface MapSelectorTransformersLayerProps {
  paneName: string;
  transformers: MapBtTransformer[];
  btEditorMode: BtEditorMode;
  polesById: Map<string, MapBtPole>;
  onBtMapClick?: (location: {
    lat: number;
    lng: number;
    label?: string;
  }) => void;
  onBtDragTransformer?: (
    transformerId: string,
    lat: number,
    lng: number,
  ) => void;
  onBtRenameTransformer?: (transformerId: string, title: string) => void;
  onBtSetTransformerChangeFlag?: (
    transformerId: string,
    transformerChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  onBtDeleteTransformer?: (id: string) => void;
  locale: AppLocale;
  layerConfig?: LayerConfig;
}

const MapSelectorTransformersLayer: React.FC<
  MapSelectorTransformersLayerProps
> = ({
  paneName,
  transformers,
  btEditorMode,
  polesById,
  onBtMapClick,
  onBtDragTransformer,
  onBtRenameTransformer,
  onBtSetTransformerChangeFlag,
  onBtDeleteTransformer,
  locale,
  layerConfig,
}) => {
  const t = getBtTopologyPanelText(locale).poleVerification;
  const makeTransformerIcon = (
    verified: boolean,
    transformerFlag: "existing" | "new" | "remove" | "replace",
    dataSource?: "imported" | "manual" | "dg_calculated"
  ) => {
    const bg = getFlagColor(transformerFlag, verified ? "#15803d" : "#7c3aed");
    
    const sourceBadge = dataSource === "dg_calculated" 
      ? `<div style="position:absolute;top:-4px;right:-4px;background:#7c3aed;color:white;border-radius:4px;padding:1px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);"><svg width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>`
      : dataSource === "manual"
      ? `<div style="position:absolute;top:-4px;right:-4px;background:#0ea5e9;color:white;border-radius:4px;padding:1px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);"><svg width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`
      : "";

    return L.divIcon({
      className: "bt-transformer-icon",
      html: `<div style="position:relative;width:14px;height:14px;"><svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>${sourceBadge}</div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  return (
    <Pane name={paneName} style={{ zIndex: 480 }}>
      {transformers.map((transformer) => (
        <Marker
          key={`${transformer.id}-${transformer.verified ? "v" : "u"}`}
          position={[transformer.lat, transformer.lng]}
          icon={makeTransformerIcon(
            !!transformer.verified,
            getTransformerChangeFlag(transformer),
            transformer.dataSource
          )}
          zIndexOffset={1400}
          draggable={true}
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
          <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-violet-900">{transformer.title}</span>
              {layerConfig?.labels && typeof transformer.projectPowerKva === "number" && (
                <span className="text-[9px] font-black text-violet-700">
                  {transformer.projectPowerKva} kVA
                </span>
              )}
            </div>
          </Tooltip>
          <Popup>
            <div className="text-xs">
              <strong>{transformer.title}</strong>
              <div className="text-[10px] text-slate-500">{transformer.id}</div>

              {/* Transformer BIM Specs Section */}
              {typeof transformer.projectPowerKva === "number" && (
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <div className="font-bold text-violet-800">
                    Potência: {transformer.projectPowerKva} kVA
                  </div>
                </div>
              )}
              {onBtRenameTransformer && (
                <input
                  type="text"
                  value={transformer.title}
                  title={`Nome do transformador ${transformer.id}`}
                  placeholder="Nome do transformador"
                  onChange={(e) =>
                    onBtRenameTransformer(transformer.id, e.target.value)
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                />
              )}
              {onBtSetTransformerChangeFlag && (
                <div className={POPUP_FLAG_GRID_CLASS}>
                  {(["existing", "new", "replace", "remove"] as const).map(
                    (flag) => (
                      <button
                        key={flag}
                        onClick={(e) => {
                          e.preventDefault();
                          onBtSetTransformerChangeFlag(transformer.id, flag);
                        }}
                        className={getFlagButtonClass(
                          getTransformerChangeFlag(transformer) === flag,
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
              )}
              <div className={POPUP_TOOLBAR_CLASS}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onBtDeleteTransformer?.(transformer.id);
                  }}
                  className={getIconActionButtonClass("danger")}
                  title="Deletar transformador"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </Pane>
  );
};

export default MapSelectorTransformersLayer;
