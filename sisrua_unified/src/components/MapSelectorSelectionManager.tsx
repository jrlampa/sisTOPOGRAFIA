import React from "react";
import {
  Marker,
  Circle,
  Polyline,
  Polygon,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  BtEditorMode,
  MtEditorMode,
  SelectionMode,
  GeoLocation,
} from "../types";

interface SelectionManagerProps {
  center: GeoLocation;
  flyToEdgeTarget?: { lat: number; lng: number; token: number } | null;
  flyToPoleTarget?: { lat: number; lng: number; token: number } | null;
  flyToTransformerTarget?: { lat: number; lng: number; token: number } | null;
  radius: number;
  selectionMode: SelectionMode;
  polygonPoints: Array<[number, number]>;
  onLocationChange: (location: GeoLocation) => void;
  onPolygonChange: (points: Array<[number, number]>) => void;
  measurePath?: Array<[number, number]>;
  onMeasurePathChange?: (path: Array<[number, number]>) => void;
  btEditorMode?: BtEditorMode;
  onBtMapClick?: (location: GeoLocation) => void;
  onBtContextAction?: (
    action: "add-edge" | "add-transformer" | "add-pole",
    location: GeoLocation,
  ) => void;
  mtEditorMode?: MtEditorMode;
  onMtMapClick?: (location: GeoLocation) => void;
  onMtContextAction?: (
    action: "add-pole" | "add-edge",
    location: GeoLocation,
  ) => void;
  keyboardPanEnabled?: boolean;
}

const SelectionManager: React.FC<SelectionManagerProps> = ({
  center,
  flyToEdgeTarget,
  flyToPoleTarget,
  flyToTransformerTarget,
  radius,
  selectionMode,
  polygonPoints,
  onLocationChange,
  onPolygonChange,
  measurePath = [],
  onMeasurePathChange,
  btEditorMode = "none",
  onBtMapClick,
  onBtContextAction,
  mtEditorMode = "none",
  onMtMapClick,
  onMtContextAction,
  keyboardPanEnabled = false,
}) => {
  const middlePanActiveRef = React.useRef(false);
  const middlePanMovedRef = React.useRef(false);
  const suppressNextClickRef = React.useRef(false);
  const middlePanLastPointRef = React.useRef<L.Point | null>(null);
  const [contextMenuLocation, setContextMenuLocation] =
    React.useState<GeoLocation | null>(null);

  const map = useMapEvents({
    click(e) {
      if (contextMenuLocation) {
        setContextMenuLocation(null);
      }

      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }

      if (
        btEditorMode !== "none" &&
        btEditorMode !== "move-pole" &&
        onBtMapClick
      ) {
        onBtMapClick({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `BT (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`,
        });
        return;
      }

      if (
        mtEditorMode !== "none" &&
        mtEditorMode !== "mt-move-pole" &&
        onMtMapClick
      ) {
        onMtMapClick({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `MT (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`,
        });
        return;
      }

      if (selectionMode === "circle") {
        onLocationChange({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `Selecionado (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`,
        });
      } else if (selectionMode === "polygon") {
        onPolygonChange([...polygonPoints, [e.latlng.lat, e.latlng.lng]]);
      } else if (selectionMode === "measure" && onMeasurePathChange) {
        if (measurePath.length >= 2) {
          onMeasurePathChange([[e.latlng.lat, e.latlng.lng]]);
        } else {
          onMeasurePathChange([...measurePath, [e.latlng.lat, e.latlng.lng]]);
        }
      }
    },
    contextmenu(e) {
      if (onBtContextAction && btEditorMode !== "none") {
        setContextMenuLocation({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `BT (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`,
        });
        return;
      }

      if (onMtContextAction && mtEditorMode !== "none") {
        setContextMenuLocation({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `MT (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`,
        });
      }
    },
    mousedown(e) {
      if (e.originalEvent.button !== 1) {
        return;
      }

      e.originalEvent.preventDefault();
      middlePanActiveRef.current = true;
      middlePanMovedRef.current = false;
      middlePanLastPointRef.current = e.containerPoint;
    },
    mousemove(e) {
      if (!middlePanActiveRef.current || !middlePanLastPointRef.current) {
        return;
      }

      e.originalEvent.preventDefault();
      const dx = e.containerPoint.x - middlePanLastPointRef.current.x;
      const dy = e.containerPoint.y - middlePanLastPointRef.current.y;

      if (dx !== 0 || dy !== 0) {
        middlePanMovedRef.current = true;
        map.panBy([-dx, -dy], { animate: false });
        middlePanLastPointRef.current = e.containerPoint;
      }
    },
    mouseup(e) {
      if (e.originalEvent.button !== 1) {
        return;
      }

      e.originalEvent.preventDefault();
      middlePanActiveRef.current = false;
      middlePanLastPointRef.current = null;

      if (middlePanMovedRef.current) {
        suppressNextClickRef.current = true;
        middlePanMovedRef.current = false;
      }
    },
  });

  const runBtContextAction = (
    action: "add-edge" | "add-transformer" | "add-pole",
  ) => {
    if (!onBtContextAction || !contextMenuLocation) {
      return;
    }

    onBtContextAction(action, contextMenuLocation);
    setContextMenuLocation(null);
  };

  const runMtContextAction = (action: "add-pole" | "add-edge") => {
    if (!onMtContextAction || !contextMenuLocation) {
      return;
    }

    onMtContextAction(action, contextMenuLocation);
    setContextMenuLocation(null);
  };

  const flyToCenter = (target: { lat: number; lng: number }) => {
    const next = L.latLng(target.lat, target.lng);
    const current = map.getCenter();
    const distance = current.distanceTo(next);
    const zoom = map.getZoom();

    if (distance < 1) {
      map.setView(next, zoom, { animate: false });
      return;
    }

    const duration = distance > 5000 ? 1.8 : distance > 1000 ? 1.3 : 0.9;
    map.flyTo(next, zoom, { duration, easeLinearity: 0.2, noMoveStart: true });
  };

  React.useEffect(() => {
    flyToCenter(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flyToCenter is stable (depends only on 'map' which is in deps); precision deps on lat/lng prevent re-flying on label-only changes.
  }, [center.lat, center.lng, map]);

  React.useEffect(() => {
    if (!flyToPoleTarget) {
      return;
    }

    const next = L.latLng(flyToPoleTarget.lat, flyToPoleTarget.lng);
    const current = map.getCenter();
    const distance = current.distanceTo(next);
    const zoom = map.getZoom();

    if (distance < 1) {
      map.setView(next, zoom, { animate: false });
      return;
    }

    const duration = distance > 5000 ? 1.8 : distance > 1000 ? 1.3 : 0.9;
    map.flyTo(next, zoom, { duration, easeLinearity: 0.2, noMoveStart: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is the intent-change signal; lat/lng read from flyToPoleTarget inside are stable within the same token.
  }, [flyToPoleTarget?.token, map]);

  React.useEffect(() => {
    if (!flyToEdgeTarget) {
      return;
    }

    const next = L.latLng(flyToEdgeTarget.lat, flyToEdgeTarget.lng);
    const current = map.getCenter();
    const distance = current.distanceTo(next);
    const zoom = map.getZoom();

    if (distance < 1) {
      map.setView(next, zoom, { animate: false });
      return;
    }

    const duration = distance > 5000 ? 1.8 : distance > 1000 ? 1.3 : 0.9;
    map.flyTo(next, zoom, { duration, easeLinearity: 0.2, noMoveStart: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is the intent-change signal; lat/lng read from flyToEdgeTarget inside are stable within the same token.
  }, [flyToEdgeTarget?.token, map]);

  React.useEffect(() => {
    if (!flyToTransformerTarget) {
      return;
    }

    const next = L.latLng(
      flyToTransformerTarget.lat,
      flyToTransformerTarget.lng,
    );
    const current = map.getCenter();
    const distance = current.distanceTo(next);
    const zoom = map.getZoom();

    if (distance < 1) {
      map.setView(next, zoom, { animate: false });
      return;
    }

    const duration = distance > 5000 ? 1.8 : distance > 1000 ? 1.3 : 0.9;
    map.flyTo(next, zoom, { duration, easeLinearity: 0.2, noMoveStart: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is the intent-change signal; lat/lng read from flyToTransformerTarget inside are stable within the same token.
  }, [flyToTransformerTarget?.token, map]);

  React.useEffect(() => {
    if (!keyboardPanEnabled) {
      return;
    }

    const panStep = 80;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (
        key !== "w" &&
        key !== "a" &&
        key !== "s" &&
        key !== "d" &&
        key !== "arrowup" &&
        key !== "arrowdown" &&
        key !== "arrowleft" &&
        key !== "arrowright"
      ) {
        return;
      }

      event.preventDefault();

      if (key === "w" || key === "arrowup") {
        map.panBy([0, -panStep], { animate: false });
      }
      if (key === "s" || key === "arrowdown") {
        map.panBy([0, panStep], { animate: false });
      }
      if (key === "a" || key === "arrowleft") {
        map.panBy([-panStep, 0], { animate: false });
      }
      if (key === "d" || key === "arrowright") {
        map.panBy([panStep, 0], { animate: false });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardPanEnabled, map]);

  React.useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [map]);

  return (
    <>
      {contextMenuLocation && (
        <Popup
          position={[contextMenuLocation.lat, contextMenuLocation.lng]}
          closeButton={true}
          autoPan={false}
          eventHandlers={{
            remove: () => setContextMenuLocation(null),
          }}
        >
          <div className="flex min-w-[170px] flex-col gap-1 p-0.5 text-xs font-black uppercase tracking-wide text-slate-900">
            {mtEditorMode === "none" ? (
              <>
                <button
                  type="button"
                  className="rounded-md border border-violet-300 bg-violet-50 px-2 py-1.5 text-left transition hover:bg-violet-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    runBtContextAction("add-edge");
                  }}
                >
                  +CONDUTOR (BT)
                </button>
                <button
                  type="button"
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-left transition hover:bg-emerald-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    runBtContextAction("add-transformer");
                  }}
                >
                  +TRAFO (BT)
                </button>
                <button
                  type="button"
                  className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1.5 text-left transition hover:bg-sky-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    runBtContextAction("add-pole");
                  }}
                >
                  +POSTE (BT)
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-md border border-orange-300 bg-orange-50 px-2 py-1.5 text-left transition hover:bg-orange-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    runMtContextAction("add-edge");
                  }}
                >
                  +VÃO (MT)
                </button>
                <button
                  type="button"
                  className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-left transition hover:bg-amber-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    runMtContextAction("add-pole");
                  }}
                >
                  +POSTE (MT)
                </button>
              </>
            )}
          </div>
        </Popup>
      )}

      {selectionMode === "circle" && (
        <>
          <Marker position={[center.lat, center.lng]} />
          <Circle
            center={[center.lat, center.lng]}
            radius={radius}
            pathOptions={{
              fillColor: "#3b82f6",
              fillOpacity: 0.1,
              color: "#60a5fa",
              weight: 1,
              dashArray: "5, 5",
            }}
          />
        </>
      )}
      {selectionMode === "polygon" && polygonPoints.length > 0 && (
        <>
          {polygonPoints.map((point: [number, number], i: number) => (
            <Marker key={i} position={point} />
          ))}
          {polygonPoints.length > 1 && (
            <Polyline
              positions={polygonPoints}
              pathOptions={{ color: "#a78bfa", weight: 2, dashArray: "5, 5" }}
            />
          )}
          {polygonPoints.length > 2 && (
            <Polygon
              positions={polygonPoints}
              pathOptions={{
                fillColor: "#8b5cf6",
                fillOpacity: 0.2,
                color: "#a78bfa",
                weight: 2,
              }}
            />
          )}
        </>
      )}
      {selectionMode === "measure" && measurePath.length > 0 && (
        <>
          {measurePath.map((point: [number, number], i: number) => (
            <Marker key={`measure-${i}`} position={point} />
          ))}
          {measurePath.length > 1 && (
            <Polyline
              positions={measurePath}
              pathOptions={{ color: "orange", weight: 4, opacity: 0.8 }}
            />
          )}
        </>
      )}
    </>
  );
};

export default SelectionManager;
