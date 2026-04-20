import React from "react";
import { Pane, Polyline, Popup } from "react-leaflet";
import { Trash2 } from "lucide-react";
import { MtEdge, MtPoleNode, MtTopology } from "../../types";

const EDGE_HIT_AREA_WEIGHT = 24;
const POPUP_FLAG_GRID_CLASS = "mt-1.5 grid grid-cols-2 gap-1.5";

const getMtEdgeVisualConfig = (edge: MtEdge) => {
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

const getFlagButtonClass = (
  isActive: boolean,
  variant: "existing" | "new" | "replace" | "remove",
) => {
  const baseClass =
    "h-6 rounded border bg-white text-[10px] font-bold transition-colors";

  if (variant === "new") {
    return `${baseClass} border-orange-500 text-orange-700 ${isActive ? "bg-orange-100" : "hover:bg-orange-50"}`;
  }
  if (variant === "replace") {
    return `${baseClass} border-amber-400 text-amber-700 ${isActive ? "bg-amber-100" : "hover:bg-amber-50"}`;
  }
  if (variant === "remove") {
    return `${baseClass} border-red-500 text-red-700 ${isActive ? "bg-red-100" : "hover:bg-red-50"}`;
  }
  return `${baseClass} border-orange-500 text-orange-700 ${isActive ? "bg-orange-100" : "hover:bg-orange-50"}`;
};

interface MapSelectorMtEdgesLayerProps {
  paneName: string;
  topology: MtTopology;
  popupTopology?: MtTopology;
  polesById: Map<string, MtPoleNode>;
  onMtDeleteEdge?: (id: string) => void;
  onMtSetEdgeChangeFlag?: (
    edgeId: string,
    edgeChangeFlag: "existing" | "new" | "remove" | "replace",
  ) => void;
}

const MapSelectorMtEdgesLayer: React.FC<MapSelectorMtEdgesLayerProps> = ({
  paneName,
  topology,
  popupTopology,
  polesById,
  onMtDeleteEdge,
  onMtSetEdgeChangeFlag,
}) => {
  const popupEdgesById = React.useMemo(
    () => new Map((popupTopology ?? topology).edges.map((edge) => [edge.id, edge])),
    [popupTopology, topology],
  );

  return (
    <Pane name={paneName} style={{ zIndex: 430 }}>
      {(topology.edges || []).map((edge) => {
        const from = polesById.get(edge.fromPoleId);
        const to = polesById.get(edge.toPoleId);
        if (!from || !to) return null;

        const edgeVisual = getMtEdgeVisualConfig(edge);
        const popupEdge = popupEdgesById.get(edge.id) ?? edge;
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
              <Popup>
                <div className="text-xs">
                  <strong>Vão MT: {edge.id}</strong>
                  <div className="mt-1 text-slate-700">
                    {from.title} {"<->"} {to.title}
                  </div>
                  <div className="mt-1 text-slate-700">
                    Comprimento: {popupEdge.lengthMeters} m
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <div className={POPUP_FLAG_GRID_CLASS}>
                      <button
                        onClick={() =>
                          onMtSetEdgeChangeFlag?.(edge.id, "existing")
                        }
                        className={getFlagButtonClass(
                          edgeChangeFlag === "existing",
                          "existing",
                        )}
                      >
                        Existente
                      </button>
                      <button
                        onClick={() => onMtSetEdgeChangeFlag?.(edge.id, "new")}
                        className={getFlagButtonClass(
                          edgeChangeFlag === "new",
                          "new",
                        )}
                      >
                        Novo
                      </button>
                    </div>
                    {onMtDeleteEdge && (
                      <button
                        onClick={() => onMtDeleteEdge(edge.id)}
                        className="flex h-6 items-center justify-center gap-1.5 rounded border border-red-500 bg-red-50 text-[10px] font-bold text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                        Deletar Vão
                      </button>
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
