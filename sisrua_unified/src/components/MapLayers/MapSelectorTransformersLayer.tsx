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
  ) => {
    const bg = getFlagColor(transformerFlag, verified ? "#15803d" : "#7c3aed");
    return L.divIcon({
      className: "bt-transformer-icon",
      html: `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
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
