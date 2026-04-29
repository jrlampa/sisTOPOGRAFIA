import React from "react";
import { Pane, Polyline, Popup } from "react-leaflet";
import { Trash2 } from "lucide-react";
import L from "leaflet";
import type { MapMtEdge, MapMtPole, MapMtTopology } from "../../types.map";
import {
  getFlagButtonClass,
  POPUP_FLAG_GRID_CLASS,
  POPUP_TOOLBAR_CLASS,
} from "../MapSelectorStyles";
import { getBtTopologyPanelText } from "../../i18n/btTopologyPanelText";
import type { AppLocale } from "../../types";

const EDGE_HIT_AREA_WEIGHT = 44;

const getMtEdgeVisualConfig = (edge: MapMtEdge) => {
  const flag = edge.edgeChangeFlag ?? "existing";

  if (flag === "new") {
    return { color: "#ea580c", dashArray: "8 6", weight: 3.5 };
  }
  if (flag === "remove") {
    return { color: "#ef4444", dashArray: "8 6", weight: 3.5 };
  }
  if (flag === "replace") {
    return { color: "#fbbf24", dashArray: undefined, weight: 3.5 };
  }
  return { color: "#d97706", dashArray: undefined, weight: 3.5 };
};

interface MapSelectorMtEdgesLayerProps {
  paneName: string;
  topology: MapMtTopology;
  popupTopology?: MapMtTopology;
  polesById: Map<string, MapMtPole>;
  onMtDeleteEdge?: (id: string) => void;
  onMtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
  locale: AppLocale;
}

const MapSelectorMtEdgesLayer: React.FC<MapSelectorMtEdgesLayerProps> = ({
  paneName,
  topology,
  popupTopology,
  polesById,
  onMtDeleteEdge,
  onMtSetEdgeChangeFlag,
  locale,
}) => {
  const t = getBtTopologyPanelText(locale).poleVerification;

  const popupEdgesById = React.useMemo(
    () =>
      new Map((popupTopology ?? topology).edges.map((edge) => [edge.id, edge])),
    [popupTopology, topology],
  );
  const popupPolesById = React.useMemo(
    () =>
      new Map((popupTopology ?? topology).poles.map((pole) => [pole.id, pole])),
    [popupTopology, topology],
  );
  const popupEventHandlers = React.useMemo(
    () => ({
      add: (event: any) => {
        const popupEl = event?.popup?.getElement?.() as HTMLElement | null;
        const contentEl = popupEl?.querySelector(
          ".leaflet-popup-content",
        ) as HTMLElement | null;
        if (!contentEl) {
          return;
        }
        L.DomEvent.disableClickPropagation(contentEl);
        L.DomEvent.disableScrollPropagation(contentEl);
      },
    }),
    [],
  );

  return (
    <Pane name={paneName} style={{ zIndex: 430 }}>
      {(topology.edges || []).map((edge) => {
        const from = polesById.get(edge.fromPoleId);
        const to = polesById.get(edge.toPoleId);
        if (!from || !to) return null;

        const edgeVisual = getMtEdgeVisualConfig(edge);
        const popupEdge = popupEdgesById.get(edge.id) ?? edge;
        const popupFrom = popupPolesById.get(edge.fromPoleId) ?? from;
        const popupTo = popupPolesById.get(edge.toPoleId) ?? to;
        const edgeChangeFlag = popupEdge.edgeChangeFlag ?? "existing";

        return (
          <React.Fragment key={edge.id}>
            <Polyline
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: "#000000",
                weight: EDGE_HIT_AREA_WEIGHT,
                opacity: 0.01,
              }}
            >
              <Popup eventHandlers={popupEventHandlers}>
                <div
                  className="text-xs"
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                >
                  <strong>Vão MT: {edge.id}</strong>
                  <div className="mt-1 text-slate-700">
                    {popupFrom.title} {"<->"} {popupTo.title}
                  </div>
                  <div className="mt-1 text-slate-700">
                    Comprimento: {popupEdge.lengthMeters} m
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <div className={POPUP_FLAG_GRID_CLASS}>
                      {(["existing", "new", "replace", "remove"] as const).map(
                        (flag) => (
                          <button
                            key={flag}
                            onClick={() =>
                              onMtSetEdgeChangeFlag?.(edge.id, flag)
                            }
                            className={getFlagButtonClass(
                              edgeChangeFlag === flag,
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
                    {onMtDeleteEdge && (
                      <div className={POPUP_TOOLBAR_CLASS}>
                        <button
                          onClick={() => onMtDeleteEdge(edge.id)}
                          className="flex h-6 items-center justify-center gap-1.5 rounded border border-red-500 bg-red-50 px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                        >
                          <Trash2 size={12} />
                          Deletar Vão
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Polyline>
            <Polyline
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: "#ffffff",
                weight: edgeVisual.weight + 2,
                opacity: 0.6,
                dashArray: edgeVisual.dashArray,
                interactive: false,
              }}
            />
            <Polyline
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: edgeVisual.color,
                weight: edgeVisual.weight,
                opacity: 1,
                dashArray: edgeVisual.dashArray,
                interactive: false,
              }}
            />
          </React.Fragment>
        );
      })}
    </Pane>
  );
};

export default MapSelectorMtEdgesLayer;
