import React from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents, GeoJSON, Polygon, Polyline, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GeoJsonObject, FeatureCollection } from 'geojson';
import { BtEditorMode, BtEdge, BtPoleNode, BtRamalEntry, BtTopology, BtTransformer, SelectionMode, GeoLocation } from '../types';
import { Minus, Plus, Trash2, Triangle } from 'lucide-react';
import { LEGACY_ID_ENTROPY, ENTITY_ID_PREFIXES } from '../constants/magicNumbers';

const CONDUCTOR_OPTIONS = [
    '70 Al - MX',
    '185 Al - MX',
    '240 Al - MX',
    '25 Al - Arm',
    '50 Al - Arm',
    '95 Al - Arm',
    '150 Al - Arm',
    '240 Al - Arm',
    '25 Al',
    '35 Cu',
    '70 Cu',
    '95 Al',
    '120 Cu',
    '240 Al',
    '240 Cu',
    '500 Cu',
    '10 Cu_CONC_bi',
    '10 Cu_CONC_Tri',
    '16 Al_CONC_bi',
    '16 Al_CONC_Tri',
    '13 Al - DX',
    '13 Al - TX',
    '13 Al - QX',
    '21 Al - QX',
    '53 Al - QX',
    '6 AWG',
    '2 AWG',
    '1/0 AWG',
    '3/0 AWG',
    '4/0 AWG'
];

const EDGE_HIT_AREA_WEIGHT = 28;
const VIEWPORT_PADDING_RATIO = 0.15;
const DENSE_TOOLTIP_POLE_LIMIT = 400;
const DENSE_TOOLTIP_TRANSFORMER_LIMIT = 220;
const TOOLTIP_MIN_ZOOM = 16;
const LEAFLET_ICON_BASE_URL = import.meta.env.BASE_URL;
const POPUP_SELECT_CLASS = 'w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-700';
const POPUP_TOOLBAR_CLASS = 'mt-1.5 flex items-center gap-2';
const POPUP_FLAG_GRID_CLASS = 'mt-1.5 grid grid-cols-2 gap-1.5';

const getFlagButtonClass = (isActive: boolean, variant: 'existing' | 'new' | 'replace' | 'remove') => {
    const baseClass = 'h-6 rounded border bg-white text-[10px] font-bold transition-colors';

    if (variant === 'new') {
        return `${baseClass} border-green-500 text-green-700 ${isActive ? 'bg-green-100' : 'hover:bg-green-50'}`;
    }

    if (variant === 'replace') {
        return `${baseClass} border-yellow-400 text-yellow-700 ${isActive ? 'bg-yellow-100' : 'hover:bg-yellow-50'}`;
    }

    if (variant === 'remove') {
        return `${baseClass} border-red-500 text-red-700 ${isActive ? 'bg-red-100' : 'hover:bg-red-50'}`;
    }

    return `${baseClass} border-fuchsia-500 text-fuchsia-700 ${isActive ? 'bg-fuchsia-100' : 'hover:bg-fuchsia-50'}`;
};

const getIconActionButtonClass = (variant: 'danger' | 'sky' | 'slate' | 'violet', active = false) => {
    const baseClass = 'inline-flex h-6 w-7 items-center justify-center rounded border transition-colors';

    if (variant === 'danger') {
        return `${baseClass} border-red-500 text-red-500 ${active ? 'bg-red-100' : 'bg-red-500/10 hover:bg-red-100'}`;
    }

    if (variant === 'sky') {
        return `${baseClass} border-sky-500 text-sky-600 bg-sky-500/10 hover:bg-sky-100`;
    }

    if (variant === 'violet') {
        return `${baseClass} ${active ? 'border-violet-700 text-violet-700 bg-violet-100' : 'border-slate-500 text-slate-600 bg-slate-100 hover:bg-slate-200'}`;
    }

    return `${baseClass} border-slate-500 text-slate-700 bg-slate-100 hover:bg-slate-200`;
};

// Fix for default marker icon in React Leaflet
// We need to set the marker icon paths because Leaflet doesn't handle them well in bundled apps.
// Using public/ static resources to avoid external CDN dependency and improve CSP compliance.
const DefaultIcon = L.icon({
  iconRetinaUrl: `${LEAFLET_ICON_BASE_URL}marker-icon-2x.png`,
  iconUrl: `${LEAFLET_ICON_BASE_URL}marker-icon.png`,
  shadowUrl: `${LEAFLET_ICON_BASE_URL}marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
    center: { lat: number; lng: number; label?: string };
    flyToEdgeTarget?: { lat: number; lng: number; token: number } | null;
    flyToPoleTarget?: { lat: number; lng: number; token: number } | null;
    flyToTransformerTarget?: { lat: number; lng: number; token: number } | null;
    radius: number;
    selectionMode: SelectionMode;
    polygonPoints: [number, number][];
    onLocationChange: (newCenter: { lat: number; lng: number; label?: string }) => void;
    onPolygonChange: (points: [number, number][]) => void;
    measurePath?: [number, number][]; // optional for now
    onMeasurePathChange?: (path: [number, number][]) => void;
    btTopology?: BtTopology;
    btEditorMode?: BtEditorMode;
    pendingBtEdgeStartPoleId?: string | null;
    onBtMapClick?: (location: { lat: number; lng: number; label?: string }) => void;
    onBtDeletePole?: (id: string) => void;
    onBtDeleteEdge?: (id: string) => void;
    onBtSetEdgeChangeFlag?: (edgeId: string, edgeChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => void;
    onBtDeleteTransformer?: (id: string) => void;
    onBtToggleTransformerOnPole?: (poleId: string) => void;
    onBtQuickAddPoleRamal?: (poleId: string) => void;
    onBtQuickRemovePoleRamal?: (poleId: string) => void;
    onBtQuickAddEdgeConductor?: (edgeId: string, conductorName: string) => void;
    onBtQuickRemoveEdgeConductor?: (edgeId: string, conductorName: string) => void;
    onBtSetEdgeReplacementFromConductors?: (edgeId: string, conductors: BtRamalEntry[]) => void;
    onBtRenamePole?: (poleId: string, title: string) => void;
    onBtRenameTransformer?: (transformerId: string, title: string) => void;
    onBtSetPoleVerified?: (poleId: string, verified: boolean) => void;
    onBtSetPoleChangeFlag?: (poleId: string, nodeChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => void;
    onBtTogglePoleCircuitBreak?: (poleId: string, circuitBreakPoint: boolean) => void;
    onBtSetTransformerChangeFlag?: (transformerId: string, transformerChangeFlag: 'existing' | 'new' | 'remove' | 'replace') => void;
    onBtDragPole?: (poleId: string, lat: number, lng: number) => void;
    onBtDragTransformer?: (transformerId: string, lat: number, lng: number) => void;
    criticalPoleId?: string | null;
    accumulatedByPole?: { poleId: string; accumulatedClients: number; accumulatedDemandKva: number; voltageV?: number; dvAccumPercent?: number; cqtStatus?: string }[];
    onKmlDrop?: (file: File) => void;
    mapStyle?: string;
    onMapStyleChange?: (style: string) => void;
    showAnalysis?: boolean;
    geojson?: GeoJsonObject | null;
}

type BtEdgeChangeFlag = NonNullable<BtEdge['edgeChangeFlag']>;
type BtPoleChangeFlag = NonNullable<BtPoleNode['nodeChangeFlag']>;
type BtTransformerChangeFlag = NonNullable<BtTransformer['transformerChangeFlag']>;

const getEdgeChangeFlag = (edge: BtEdge): BtEdgeChangeFlag => {
    if (edge.edgeChangeFlag) {
        return edge.edgeChangeFlag;
    }

    return edge.removeOnExecution ? 'remove' : 'existing';
};

const getEdgeVisualConfig = (edge: BtEdge) => {
    const flag = getEdgeChangeFlag(edge);

    if (flag === 'new') {
        return { color: '#22c55e', dashArray: '8 6', weight: 3 };
    }

    if (flag === 'remove') {
        return { color: '#ef4444', dashArray: '8 6', weight: 3 };
    }

    if (flag === 'replace') {
        return { color: '#facc15', dashArray: undefined as string | undefined, weight: 3 };
    }

    return { color: '#d946ef', dashArray: undefined as string | undefined, weight: 3 };
};

const getPoleChangeFlag = (pole: BtPoleNode): BtPoleChangeFlag => pole.nodeChangeFlag ?? 'existing';
const getTransformerChangeFlag = (transformer: BtTransformer): BtTransformerChangeFlag => transformer.transformerChangeFlag ?? 'existing';

const getFlagColor = (flag: 'existing' | 'new' | 'remove' | 'replace', fallback: string) => {
    if (flag === 'new') return '#22c55e';
    if (flag === 'remove') return '#ef4444';
    if (flag === 'replace') return '#facc15';
    return fallback;
};

interface SelectionManagerProps {
    center: GeoLocation;
    flyToEdgeTarget?: {lat: number; lng: number; token: number} | null;
    flyToPoleTarget?: {lat: number; lng: number; token: number} | null;
    flyToTransformerTarget?: {lat: number; lng: number; token: number} | null;
    radius: number;
    selectionMode: SelectionMode;
    polygonPoints: Array<[number, number]>;
    onLocationChange: (location: GeoLocation) => void;
    onPolygonChange: (points: Array<[number, number]>) => void;
    measurePath?: Array<[number, number]>;
    onMeasurePathChange?: (path: Array<[number, number]>) => void;
    btEditorMode?: BtEditorMode;
    onBtMapClick?: (location: GeoLocation) => void;
}

interface ViewportState {
    bounds: L.LatLngBounds;
    zoom: number;
}

interface ViewportTrackerProps {
    onViewportChange: (next: ViewportState) => void;
}

const ViewportTracker = ({ onViewportChange }: ViewportTrackerProps) => {
    const map = useMap();

    React.useEffect(() => {
        onViewportChange({ bounds: map.getBounds(), zoom: map.getZoom() });
    }, [map, onViewportChange]);

    useMapEvents({
        moveend: () => {
            onViewportChange({ bounds: map.getBounds(), zoom: map.getZoom() });
        },
        zoomend: () => {
            onViewportChange({ bounds: map.getBounds(), zoom: map.getZoom() });
        }
    });

    return null;
};

const SelectionManager = ({
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
    btEditorMode = 'none',
    onBtMapClick
}: SelectionManagerProps) => {
    const middlePanActiveRef = React.useRef(false);
    const middlePanMovedRef = React.useRef(false);
    const suppressNextClickRef = React.useRef(false);
    const middlePanLastPointRef = React.useRef<L.Point | null>(null);

    const map = useMapEvents({
        click(e) {
            if (suppressNextClickRef.current) {
                suppressNextClickRef.current = false;
                return;
            }

            if (btEditorMode !== 'none' && btEditorMode !== 'move-pole' && onBtMapClick) {
                onBtMapClick({
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                    label: `BT (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`
                });
                return;
            }

            if (selectionMode === 'circle') {
                onLocationChange({
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                    label: `Selecionado (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`
                });
            } else if (selectionMode === 'polygon') {
                onPolygonChange([...polygonPoints, [e.latlng.lat, e.latlng.lng]]);
            } else if (selectionMode === 'measure' && onMeasurePathChange) {
                // Measure mode uses 2 points
                if (measurePath.length >= 2) {
                    onMeasurePathChange([[e.latlng.lat, e.latlng.lng]]);
                } else {
                    onMeasurePathChange([...measurePath, [e.latlng.lat, e.latlng.lng]]);
                }
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
        }
    });

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

    // Fly to center when it changes
    React.useEffect(() => {
        flyToCenter(center);
    }, [center.lat, center.lng, map]);

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
    }, [flyToEdgeTarget?.token, map]);

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
    }, [flyToPoleTarget?.token, map]);

    React.useEffect(() => {
        if (!flyToTransformerTarget) {
            return;
        }

        const next = L.latLng(flyToTransformerTarget.lat, flyToTransformerTarget.lng);
        const current = map.getCenter();
        const distance = current.distanceTo(next);
        const zoom = map.getZoom();

        if (distance < 1) {
            map.setView(next, zoom, { animate: false });
            return;
        }

        const duration = distance > 5000 ? 1.8 : distance > 1000 ? 1.3 : 0.9;
        map.flyTo(next, zoom, { duration, easeLinearity: 0.2, noMoveStart: true });
    }, [flyToTransformerTarget?.token, map]);

    // Fix map size on mount and when window resizes
    React.useEffect(() => {
        const handleResize = () => {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        
        return () => window.removeEventListener('resize', handleResize);
    }, [map]);

    return (
        <>
            {selectionMode === 'circle' && (
                <>
                    <Marker position={[center.lat, center.lng]} />
                    <Circle
                        center={[center.lat, center.lng]}
                        radius={radius}
                        pathOptions={{
                            fillColor: '#3b82f6',
                            fillOpacity: 0.1,
                            color: '#60a5fa',
                            weight: 1,
                            dashArray: '5, 5'
                        }}
                    />
                </>
            )}
            {selectionMode === 'polygon' && polygonPoints.length > 0 && (
                <>
                    {polygonPoints.map((point: [number, number], i: number) => (
                        <Marker key={i} position={point} />
                    ))}
                    {polygonPoints.length > 1 && (
                        <Polyline
                            positions={polygonPoints}
                            pathOptions={{ color: '#a78bfa', weight: 2, dashArray: '5, 5' }}
                        />
                    )}
                    {polygonPoints.length > 2 && (
                        <Polygon
                            positions={polygonPoints}
                            pathOptions={{
                                fillColor: '#8b5cf6',
                                fillOpacity: 0.2,
                                color: '#a78bfa',
                                weight: 2
                            }}
                        />
                    )}
                </>
            )}
            {selectionMode === 'measure' && measurePath.length > 0 && (
                <>
                    {measurePath.map((point: [number, number], i: number) => (
                        <Marker key={`measure-${i}`} position={point} />
                    ))}
                    {measurePath.length > 1 && (
                        <Polyline
                            positions={measurePath}
                            pathOptions={{ color: 'orange', weight: 4, opacity: 0.8 }}
                        />
                    )}
                </>
            )}
        </>
    );
};

const MapSelector: React.FC<MapSelectorProps> = ({
    center,
    flyToEdgeTarget,
    flyToPoleTarget,
    flyToTransformerTarget,
    radius,
    selectionMode,
    polygonPoints,
    onLocationChange,
    onPolygonChange,
    measurePath,
    onMeasurePathChange,
    btTopology,
    btEditorMode = 'none',
    pendingBtEdgeStartPoleId,
    onBtMapClick,
    onBtDeletePole,
    onBtDeleteEdge,
    onBtSetEdgeChangeFlag,
    onBtDeleteTransformer,
    onBtToggleTransformerOnPole,
    onBtQuickAddPoleRamal,
    onBtQuickRemovePoleRamal,
    onBtQuickAddEdgeConductor,
    onBtQuickRemoveEdgeConductor,
    onBtSetEdgeReplacementFromConductors,
    onBtRenamePole,
    onBtRenameTransformer,
    onBtSetPoleVerified,
    onBtSetPoleChangeFlag,
    onBtTogglePoleCircuitBreak,
    onBtSetTransformerChangeFlag,
    onBtDragPole,
    onBtDragTransformer,
    criticalPoleId,
    accumulatedByPole = [],
    onKmlDrop,
    mapStyle = 'dark',
    onMapStyleChange,
    showAnalysis = false,
    geojson
}) => {
    const topology = btTopology ?? { poles: [], transformers: [], edges: [] };
    const polesById = React.useMemo(() => {
        return new Map(topology.poles.map((pole) => [pole.id, pole]));
    }, [topology.poles]);

    const accumulatedByPoleMap = React.useMemo(() => {
        return new Map(accumulatedByPole.map((entry) => [entry.poleId, entry]));
    }, [accumulatedByPole]);

    const [edgeConductorSelection, setEdgeConductorSelection] = React.useState<Record<string, string>>({});
    const [edgeReplacementFromSelection, setEdgeReplacementFromSelection] = React.useState<Record<string, string>>({});
    const [viewport, setViewport] = React.useState<ViewportState | null>(null);

    const handleViewportChange = React.useCallback((nextViewport: ViewportState) => {
        setViewport((current) => {
            if (
                current &&
                current.zoom === nextViewport.zoom &&
                current.bounds.equals(nextViewport.bounds)
            ) {
                return current;
            }
            return nextViewport;
        });
    }, []);

    const poleHasTransformer = React.useMemo(() => {
        const byPole = new Map<string, boolean>();
        const distanceThresholdMeters = 6;
        const transformers = topology.transformers || [];
        const poles = topology.poles || [];

        // O(T): index transformers with an explicit poleId for O(1) lookup
        const linkedPoleIdSet = new Set<string>(
            transformers.filter((t) => !!t.poleId).map((t) => t.poleId as string)
        );
        // Only check geo-distance for transformers without an explicit poleId
        const geoTransformers = transformers.filter((t) => !t.poleId);

        for (const pole of poles) {
            if (linkedPoleIdSet.has(pole.id)) {
                byPole.set(pole.id, true);
                continue;
            }
            if (geoTransformers.length === 0) {
                byPole.set(pole.id, false);
                continue;
            }
            const polePoint = L.latLng(pole.lat, pole.lng);
            byPole.set(
                pole.id,
                geoTransformers.some(
                    (t) => polePoint.distanceTo(L.latLng(t.lat, t.lng)) <= distanceThresholdMeters
                )
            );
        }

        return byPole;
    }, [topology.poles, topology.transformers]);

    // Pre-compute one L.divIcon per pole — avoids creating new icon objects on every render
    const poleIconsMap = React.useMemo(() => {
        const iconsMap = new Map<string, L.DivIcon>();
        for (const pole of topology.poles || []) {
            const hasTransformer = !!poleHasTransformer.get(pole.id);
            const isCritical = pole.id === criticalPoleId;
            const isPending = pole.id === pendingBtEdgeStartPoleId;
            const poleFlag = getPoleChangeFlag(pole);
            let icon: L.DivIcon;
            if (hasTransformer) {
                const bg = getFlagColor(poleFlag, pole.verified ? '#15803d' : '#7c3aed');
                const size = isCritical ? 18 : isPending ? 16 : 14;
                icon = L.divIcon({
                    className: 'bt-pole-transformer-icon',
                    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 0 ${bg}66);"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                });
            } else {
                let bg = '#2563eb';
                let size = 12;
                if (isCritical) { bg = '#ef4444'; size = 16; }
                else if (isPending) { bg = '#f59e0b'; size = 14; }
                else { bg = getFlagColor(poleFlag, pole.verified ? '#16a34a' : '#2563eb'); }
                icon = L.divIcon({
                    className: 'bt-pole-icon',
                    html: `<div style="background:${bg};border:2px solid #ffffff;width:${size}px;height:${size}px;border-radius:9999px;box-shadow:0 0 0 2px ${bg}40;"></div>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                });
            }
            iconsMap.set(pole.id, icon);
        }
        return iconsMap;
    }, [topology.poles, poleHasTransformer, criticalPoleId, pendingBtEdgeStartPoleId]);

    // Pre-compute one L.divIcon per transformer
    const transformerIconsMap = React.useMemo(() => {
        const iconsMap = new Map<string, L.DivIcon>();
        for (const transformer of topology.transformers || []) {
            const transformerFlag = getTransformerChangeFlag(transformer);
            const bg = getFlagColor(transformerFlag, transformer.verified ? '#15803d' : '#7c3aed');
            iconsMap.set(transformer.id, L.divIcon({
                className: 'bt-transformer-icon',
                html: `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            }));
        }
        return iconsMap;
    }, [topology.transformers]);

    // Pre-compute edge change flags and visual configs — avoids calling getEdgeChangeFlag twice per render
    const edgeRenderDataMap = React.useMemo(() => {
        const dataMap = new Map<string, { changeFlag: BtEdgeChangeFlag; visual: ReturnType<typeof getEdgeVisualConfig> }>();
        for (const edge of topology.edges || []) {
            dataMap.set(edge.id, { changeFlag: getEdgeChangeFlag(edge), visual: getEdgeVisualConfig(edge) });
        }
        return dataMap;
    }, [topology.edges]);

    const visiblePoleIdSet = React.useMemo(() => {
        if (!viewport) {
            return new Set((topology.poles || []).map((pole) => pole.id));
        }

        const paddedBounds = viewport.bounds.pad(VIEWPORT_PADDING_RATIO);
        const visibleIds = new Set<string>();

        for (const pole of topology.poles || []) {
            if (paddedBounds.contains([pole.lat, pole.lng])) {
                visibleIds.add(pole.id);
            }
        }

        return visibleIds;
    }, [topology.poles, viewport]);

    const visiblePoles = React.useMemo(() => {
        return (topology.poles || []).filter((pole) => visiblePoleIdSet.has(pole.id));
    }, [topology.poles, visiblePoleIdSet]);

    const visibleTransformers = React.useMemo(() => {
        if (!viewport) {
            return topology.transformers || [];
        }

        const paddedBounds = viewport.bounds.pad(VIEWPORT_PADDING_RATIO);
        return (topology.transformers || []).filter((transformer) => {
            if (transformer.poleId && visiblePoleIdSet.has(transformer.poleId)) {
                return true;
            }
            return paddedBounds.contains([transformer.lat, transformer.lng]);
        });
    }, [topology.transformers, viewport, visiblePoleIdSet]);

    const visibleEdges = React.useMemo(() => {
        if (!viewport) {
            return topology.edges || [];
        }

        return (topology.edges || []).filter((edge) => {
            return visiblePoleIdSet.has(edge.fromPoleId) || visiblePoleIdSet.has(edge.toPoleId);
        });
    }, [topology.edges, viewport, visiblePoleIdSet]);

    const shouldShowPoleTooltips =
        (viewport?.zoom ?? 15) >= TOOLTIP_MIN_ZOOM || visiblePoles.length <= DENSE_TOOLTIP_POLE_LIMIT;
    const shouldShowTransformerTooltips =
        (viewport?.zoom ?? 15) >= TOOLTIP_MIN_ZOOM || visibleTransformers.length <= DENSE_TOOLTIP_TRANSFORMER_LIMIT;

    const logMapLayersRender = React.useCallback<React.ProfilerOnRenderCallback>(
        (id, phase, actualDuration, baseDuration) => {
            if (!import.meta.env.DEV) {
                return;
            }
            if (actualDuration < 8) {
                return;
            }

            // Helps compare React DevTools Profiler data with runtime topology size on heavy scenes.
            console.debug('[MapSelectorProfiler]', {
                id,
                phase,
                actualDurationMs: Number(actualDuration.toFixed(2)),
                baseDurationMs: Number(baseDuration.toFixed(2)),
                visibleEdges: visibleEdges.length,
                visiblePoles: visiblePoles.length,
                visibleTransformers: visibleTransformers.length,
                zoom: viewport?.zoom ?? 15
            });
        },
        [visibleEdges.length, visiblePoles.length, visibleTransformers.length, viewport?.zoom]
    );

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onKmlDrop && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onKmlDrop(e.dataTransfer.files[0]);
        }
    };

    const tileConfig = React.useMemo(() => {
        if (mapStyle === 'satellite') {
            return {
                key: 'satellite',
                attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                maxNativeZoom: 19
            };
        }

        return {
            key: 'vector',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            maxNativeZoom: 19
        };
    }, [mapStyle]);

    const getRemovalMarkersForEdge = React.useCallback(
        (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
            const start = L.latLng(from.lat, from.lng);
            const end = L.latLng(to.lat, to.lng);
            const distanceMeters = Math.max(start.distanceTo(end), 1);
            const markerCount = Math.max(3, Math.min(12, Math.floor(distanceMeters / 6)));
            const points: Array<[number, number]> = [];

            for (let index = 1; index <= markerCount; index += 1) {
                const t = index / (markerCount + 1);
                points.push([
                    from.lat + (to.lat - from.lat) * t,
                    from.lng + (to.lng - from.lng) * t
                ]);
            }

            return points;
        },
        []
    );

    return (
        <div
            className="relative z-0 h-full min-h-[400px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-100 shadow-2xl"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={15}
                scrollWheelZoom={true}
                maxZoom={24}
                className="h-full min-h-[400px] w-full"
                whenReady={() => {
                    // Map ready
                }}
            >
                <TileLayer
                    key={tileConfig.key}
                    attribution={tileConfig.attribution}
                    url={tileConfig.url}
                    maxZoom={24}
                    maxNativeZoom={tileConfig.maxNativeZoom}
                    eventHandlers={{
                        tileerror: ((error: L.TileErrorEvent) => {
                            // Tile load error (expected for some tiles)
                        }) as L.TileErrorEventHandlerFn,
                        tileload: () => {
                            // Tile loaded successfully
                        }
                    }}
                />

                <SelectionManager
                    center={center}
                    flyToEdgeTarget={flyToEdgeTarget}
                    flyToPoleTarget={flyToPoleTarget}
                    flyToTransformerTarget={flyToTransformerTarget}
                    radius={radius}
                    selectionMode={selectionMode}
                    polygonPoints={polygonPoints}
                    onLocationChange={onLocationChange}
                    onPolygonChange={onPolygonChange}
                    measurePath={measurePath}
                    onMeasurePathChange={onMeasurePathChange}
                    btEditorMode={btEditorMode}
                    onBtMapClick={onBtMapClick}
                />

                <ViewportTracker onViewportChange={handleViewportChange} />

                <React.Profiler id="MapTopologyLayers" onRender={logMapLayersRender}>
                {visibleEdges.map((edge) => {
                    const from = polesById.get(edge.fromPoleId);
                    const to = polesById.get(edge.toPoleId);
                    if (!from || !to) {
                        return null;
                    }

                    const edgeRenderData = edgeRenderDataMap.get(edge.id);
                    const edgeChangeFlag = edgeRenderData?.changeFlag ?? getEdgeChangeFlag(edge);
                    const edgeVisual = edgeRenderData?.visual ?? getEdgeVisualConfig(edge);
                    const edgeFlagLabel =
                        edgeChangeFlag === 'remove'
                            ? 'Remoção'
                            : edgeChangeFlag === 'new'
                                ? 'Novo'
                                : edgeChangeFlag === 'replace'
                                    ? 'Substituição'
                                    : 'Existente';

                    const selectedConductor = edgeConductorSelection[edge.id]
                        ?? edge.conductors[edge.conductors.length - 1]?.conductorName
                        ?? CONDUCTOR_OPTIONS[0];
                    const selectedReplacementFromConductor = edgeReplacementFromSelection[edge.id]
                        ?? edge.replacementFromConductors?.[edge.replacementFromConductors.length - 1]?.conductorName
                        ?? CONDUCTOR_OPTIONS[0];

                    const edgePopup = (
                        <Popup>
                            <div className="text-xs">
                                <div><strong>{edge.id}</strong></div>
                                <div className="mt-0.5 text-slate-700">{from.title} {'<->'} {to.title}</div>
                                <div className="mt-1 text-slate-700">Flag: <strong>{edgeFlagLabel}</strong></div>
                                <div className="mt-1 text-slate-700">Condutor</div>
                                <div className="mt-0.5">
                                    <select
                                        value={selectedConductor}
                                        aria-label={`Condutor do trecho ${edge.id}`}
                                        title={`Condutor do trecho ${edge.id}`}
                                        onChange={(e) => {
                                            const conductorName = e.target.value;
                                            setEdgeConductorSelection((current) => ({
                                                ...current,
                                                [edge.id]: conductorName
                                            }));
                                        }}
                                        className={POPUP_SELECT_CLASS}
                                    >
                                        {CONDUCTOR_OPTIONS.map((name) => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mt-1.5 text-slate-700">
                                    Metragem: {typeof edge.lengthMeters === 'number' ? `${edge.lengthMeters} m` : '-'}
                                </div>
                                {edgeChangeFlag === 'replace' && (
                                    <>
                                        <div className="mt-1.5 text-slate-700">Condutor que sai</div>
                                        <div className="mt-0.5">
                                            <select
                                                value={selectedReplacementFromConductor}
                                                aria-label={`Condutor de saída do trecho ${edge.id}`}
                                                title={`Condutor de saída do trecho ${edge.id}`}
                                                onChange={(e) => {
                                                    const conductorName = e.target.value;
                                                    setEdgeReplacementFromSelection((current) => ({
                                                        ...current,
                                                        [edge.id]: conductorName
                                                    }));
                                                }}
                                                className={POPUP_SELECT_CLASS}
                                            >
                                                {CONDUCTOR_OPTIONS.map((name) => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {onBtSetEdgeReplacementFromConductors && (
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onBtSetEdgeReplacementFromConductors(edge.id, [{
                                                        id: `${ENTITY_ID_PREFIXES.CONDUCTOR_REPLACEMENT}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`,
                                                        quantity: 1,
                                                        conductorName: selectedReplacementFromConductor
                                                    }]);
                                                }}
                                                className="mt-1.5 h-6 w-full rounded border border-amber-500 bg-amber-50 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100"
                                            >
                                                Definir condutor que sai
                                            </button>
                                        )}
                                    </>
                                )}
                                {edge.conductors.length > 0 ? (
                                    <div className="mt-0.5 text-slate-700">
                                        {edge.conductors.map((entry) => (
                                            <div key={entry.id}>{entry.quantity} x {entry.conductorName}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-0.5 text-slate-500">Sem condutor informado</div>
                                )}
                                {edgeChangeFlag === 'replace' && (
                                    <div className="mt-0.5 text-amber-900">
                                        {(edge.replacementFromConductors ?? []).length > 0
                                            ? (edge.replacementFromConductors ?? []).map((entry) => (
                                                <div key={entry.id}>Sai: {entry.quantity} x {entry.conductorName}</div>
                                            ))
                                            : <div>Sem condutor de saída definido</div>}
                                    </div>
                                )}
                                <div className={`mt-0.5 font-semibold ${edge.verified ? 'text-green-600' : 'text-amber-600'}`}>{edge.verified ? '✓ Verificado' : '○ Não verificado'}</div>
                                {onBtSetEdgeChangeFlag && (
                                    <div className={POPUP_FLAG_GRID_CLASS}>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'existing');
                                            }}
                                            className={getFlagButtonClass(edgeChangeFlag === 'existing', 'existing')}
                                        >
                                            Existente
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'new');
                                            }}
                                            className={getFlagButtonClass(edgeChangeFlag === 'new', 'new')}
                                        >
                                            Novo
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'replace');
                                            }}
                                            className={getFlagButtonClass(edgeChangeFlag === 'replace', 'replace')}
                                        >
                                            Substituição
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'remove');
                                            }}
                                            className={getFlagButtonClass(edgeChangeFlag === 'remove', 'remove')}
                                        >
                                            Remoção
                                        </button>
                                    </div>
                                )}
                                <div className={POPUP_TOOLBAR_CLASS}>
                                    {onBtDeleteEdge && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtDeleteEdge(edge.id);
                                            }}
                                            title="Deletar trecho"
                                            aria-label="Deletar trecho"
                                            className={getIconActionButtonClass('danger')}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                    {onBtQuickAddEdgeConductor && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtQuickAddEdgeConductor(edge.id, selectedConductor);
                                            }}
                                            title="Informar condutor"
                                            aria-label="Informar condutor"
                                            className={getIconActionButtonClass('sky')}
                                        >
                                            <Plus size={12} />
                                        </button>
                                    )}
                                    {onBtQuickRemoveEdgeConductor && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtQuickRemoveEdgeConductor(edge.id, selectedConductor);
                                            }}
                                            title="Retirar condutor"
                                            aria-label="Retirar condutor"
                                            className={getIconActionButtonClass('slate')}
                                        >
                                            <Minus size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    );

                    return (
                        <React.Fragment key={edge.id}>
                            {/* Invisible hit-area to make conductor selection easy on dense maps */}
                            <Polyline
                                positions={[[from.lat, from.lng], [to.lat, to.lng]]}
                                pathOptions={{
                                    color: '#000000',
                                    weight: EDGE_HIT_AREA_WEIGHT,
                                    // Keep it practically invisible but still reliably clickable in Leaflet.
                                    opacity: 0.01,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                                }}
                            >
                                {edgePopup}
                            </Polyline>
                            <Polyline
                                positions={[[from.lat, from.lng], [to.lat, to.lng]]}
                                pathOptions={{
                                    color: edgeVisual.color,
                                    weight: edgeVisual.weight,
                                    opacity: 0.9,
                                    dashArray: edgeVisual.dashArray,
                                    interactive: false
                                }}
                            />
                            {edgeChangeFlag === 'remove' && (
                                <>
                                    {getRemovalMarkersForEdge(from, to).map((position, markerIndex) => (
                                        <Marker
                                            key={`${edge.id}-removal-x-${markerIndex}`}
                                            position={position}
                                            icon={L.divIcon({
                                                className: 'bt-edge-remove-label',
                                                html: '<div class="bt-edge-remove-glyph">X</div>',
                                                iconSize: [12, 12],
                                                iconAnchor: [6, 6]
                                            })}
                                            interactive={false}
                                        />
                                    ))}
                                </>
                            )}
                        </React.Fragment>
                    );
                })}

                {visiblePoles.map((pole) => (
                    <Marker
                        key={`${pole.id}-${pole.verified ? 'v' : 'u'}-${pole.id === criticalPoleId ? 'c' : 'n'}-${pole.id === pendingBtEdgeStartPoleId ? 'p' : 'x'}-${poleHasTransformer.get(pole.id) ? 't' : 'nt'}`}
                        position={[pole.lat, pole.lng]}
                        icon={poleIconsMap.get(pole.id) ?? DefaultIcon}
                        draggable={btEditorMode !== 'add-edge' && btEditorMode !== 'add-transformer'}
                        eventHandlers={{
                            click: () => {
                                if ((btEditorMode === 'add-edge' || btEditorMode === 'add-transformer') && onBtMapClick) {
                                    onBtMapClick({
                                        lat: pole.lat,
                                        lng: pole.lng,
                                        label: pole.title
                                    });
                                }
                            },
                            dragend: (e) => {
                                const { lat, lng } = (e.target as L.Marker).getLatLng();
                                onBtDragPole?.(pole.id, lat, lng);
                            }
                        }}
                    >
                        {shouldShowPoleTooltips && (
                            <Tooltip permanent direction="top" offset={[0, -8]} opacity={0.85}>
                                <span className="text-[10px] font-semibold">{pole.title}</span>
                            </Tooltip>
                        )}
                        <Popup>
                            <div className="text-xs">
                                <strong>{pole.title}</strong>
                                <div>{pole.id}</div>
                                {onBtRenamePole && (
                                    <input
                                        type="text"
                                        value={pole.title}
                                        title={`Nome do poste ${pole.id}`}
                                        placeholder="Nome do poste"
                                        onChange={(e) => onBtRenamePole(pole.id, e.target.value)}
                                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                                    />
                                )}
                                {pole.id === criticalPoleId && <div className="mt-0.5 font-bold text-red-500">⚠ Ponto crítico</div>}
                                {accumulatedByPoleMap.has(pole.id) && (
                                    <div className="mt-1 text-slate-700">
                                        <div>CLT acum.: {accumulatedByPoleMap.get(pole.id)!.accumulatedClients}</div>
                                        <div>Demanda acum.: {accumulatedByPoleMap.get(pole.id)!.accumulatedDemandKva.toFixed(2)} kVA</div>
                                        {accumulatedByPoleMap.get(pole.id)!.voltageV !== undefined && (
                                            <div className="mt-0.5 flex items-center gap-1">
                                                <span>Tensão: {accumulatedByPoleMap.get(pole.id)!.voltageV!.toFixed(1)} V</span>
                                                <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                                                    accumulatedByPoleMap.get(pole.id)!.cqtStatus === 'CRÍTICO'
                                                        ? 'bg-red-100 text-red-700'
                                                        : accumulatedByPoleMap.get(pole.id)!.cqtStatus === 'ATENÇÃO'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-green-100 text-green-700'
                                                }`}>
                                                    ΔV {accumulatedByPoleMap.get(pole.id)!.dvAccumPercent!.toFixed(2)}% {accumulatedByPoleMap.get(pole.id)!.cqtStatus}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className={`mt-0.5 font-semibold ${pole.verified ? 'text-green-600' : 'text-amber-600'}`}>
                                    {pole.verified ? '✓ Verificado' : '○ Não verificado'}
                                </div>
                                <div className="mt-0.5 text-slate-700">
                                    Flag: <strong>{getPoleChangeFlag(pole) === 'new' ? 'Novo' : getPoleChangeFlag(pole) === 'remove' ? 'Remoção' : getPoleChangeFlag(pole) === 'replace' ? 'Substituição' : 'Existente'}</strong>
                                </div>
                                {(pole.circuitBreakPoint ?? false) && (
                                    <div className="mt-0.5 font-bold text-sky-700">
                                        Separação física ativa: circuito interrompido neste poste.
                                    </div>
                                )}
                                {onBtSetPoleChangeFlag && (
                                    <div className={POPUP_FLAG_GRID_CLASS}>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'existing'); }} className={getFlagButtonClass(getPoleChangeFlag(pole) === 'existing', 'existing')}>Existente</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'new'); }} className={getFlagButtonClass(getPoleChangeFlag(pole) === 'new', 'new')}>Novo</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'replace'); }} className={getFlagButtonClass(getPoleChangeFlag(pole) === 'replace', 'replace')}>Substituição</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'remove'); }} className={getFlagButtonClass(getPoleChangeFlag(pole) === 'remove', 'remove')}>Remoção</button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtTogglePoleCircuitBreak?.(pole.id, !(pole.circuitBreakPoint ?? false));
                                            }}
                                            title="Separa fisicamente o circuito neste poste"
                                            className={`h-6 rounded border text-[10px] font-bold tracking-[-0.2px] ${pole.circuitBreakPoint ? 'border-sky-400 bg-sky-100 font-mono text-sky-700' : 'border-slate-400 bg-white font-mono text-slate-600 hover:bg-slate-50'}`}
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
                                        className={getIconActionButtonClass('danger')}
                                        title="Deletar poste"
                                        aria-label="Deletar poste"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onBtToggleTransformerOnPole?.(pole.id);
                                        }}
                                        title={poleHasTransformer.get(pole.id) ? 'Remover transformador do poste' : 'Adicionar transformador ao poste'}
                                        aria-label={poleHasTransformer.get(pole.id) ? 'Remover transformador do poste' : 'Adicionar transformador ao poste'}
                                        className={getIconActionButtonClass('violet', poleHasTransformer.get(pole.id) ?? false)}
                                    >
                                        <Triangle size={12} className="rotate-180 fill-current" />
                                    </button>
                                    {onBtQuickAddPoleRamal && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtQuickAddPoleRamal(pole.id);
                                            }}
                                            title="Informar ramais"
                                            aria-label="Informar ramais"
                                            className={getIconActionButtonClass('sky')}
                                        >
                                            <Plus size={12} />
                                        </button>
                                    )}
                                    {onBtQuickRemovePoleRamal && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtQuickRemovePoleRamal(pole.id);
                                            }}
                                            title="Reduzir ramais"
                                            aria-label="Reduzir ramais"
                                            className={getIconActionButtonClass('slate')}
                                        >
                                            <Minus size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {visibleTransformers.map((transformer) => (
                    <Marker
                        key={`${transformer.id}-${transformer.verified ? 'v' : 'u'}`}
                        position={[transformer.lat, transformer.lng]}
                        icon={transformerIconsMap.get(transformer.id) ?? DefaultIcon}
                        draggable={false}
                        eventHandlers={{
                            click: () => {
                                if ((btEditorMode === 'add-edge' || btEditorMode === 'add-transformer') && onBtMapClick) {
                                    const linkedPole = transformer.poleId ? polesById.get(transformer.poleId) : null;
                                    if (linkedPole) {
                                        onBtMapClick({
                                            lat: linkedPole.lat,
                                            lng: linkedPole.lng,
                                            label: linkedPole.title
                                        });
                                        return;
                                    }

                                    onBtMapClick({
                                        lat: transformer.lat,
                                        lng: transformer.lng,
                                        label: transformer.title
                                    });
                                }
                            },
                            dragend: (e) => {
                                const { lat, lng } = (e.target as L.Marker).getLatLng();
                                onBtDragTransformer?.(transformer.id, lat, lng);
                            }
                        }}
                    >
                        {shouldShowTransformerTooltips && (
                            <Tooltip permanent direction="bottom" offset={[0, 8]} opacity={0.85}>
                                <span className="text-[10px] font-semibold">{transformer.title}</span>
                            </Tooltip>
                        )}
                        <Popup>
                            <div className="text-xs">
                                <strong>{transformer.title}</strong>
                                <div>{transformer.id}</div>
                                {onBtRenameTransformer && (
                                    <input
                                        type="text"
                                        value={transformer.title}
                                        onChange={(e) => onBtRenameTransformer(transformer.id, e.target.value)}
                                        title="Nome do transformador"
                                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                                    />
                                )}
                                <div>Demanda: {transformer.demandKw} kW</div>
                                <div className={`mt-0.5 font-semibold ${transformer.verified ? 'text-green-600' : 'text-amber-600'}`}>{transformer.verified ? '✓ Verificado' : '○ Não verificado'}</div>
                                <div className="mt-0.5 text-slate-700">
                                    Flag: <strong>{getTransformerChangeFlag(transformer) === 'new' ? 'Novo' : getTransformerChangeFlag(transformer) === 'remove' ? 'Remoção' : getTransformerChangeFlag(transformer) === 'replace' ? 'Substituição' : 'Existente'}</strong>
                                </div>
                                {onBtSetTransformerChangeFlag && (
                                    <div className={POPUP_FLAG_GRID_CLASS}>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'existing'); }} className={getFlagButtonClass(getTransformerChangeFlag(transformer) === 'existing', 'existing')}>Existente</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'new'); }} className={getFlagButtonClass(getTransformerChangeFlag(transformer) === 'new', 'new')}>Novo</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'replace'); }} className={getFlagButtonClass(getTransformerChangeFlag(transformer) === 'replace', 'replace')}>Substituição</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'remove'); }} className={getFlagButtonClass(getTransformerChangeFlag(transformer) === 'remove', 'remove')}>Remoção</button>
                                    </div>
                                )}
                                {onBtDeleteTransformer && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onBtDeleteTransformer(transformer.id);
                                        }}
                                        className="mt-1 inline-flex h-6 items-center rounded border border-red-500 bg-red-500/10 px-2 text-[11px] text-red-500 transition-colors hover:bg-red-100"
                                    >
                                        Deletar trafo
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}
                </React.Profiler>

                {geojson && (
                    <GeoJSON data={geojson} />
                )}

            </MapContainer>

            {/* Overlay Controls could go here */}
            <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/80 backdrop-blur text-xs p-2 rounded text-slate-400 border border-slate-700">
                {btEditorMode !== 'none'
                    ? btEditorMode === 'add-pole'
                        ? 'Editor BT: clique para inserir poste'
                        : btEditorMode === 'add-transformer'
                            ? 'Editor BT: clique para inserir transformador'
                            : pendingBtEdgeStartPoleId
                                ? `Editor BT: selecione destino (origem ${pendingBtEdgeStartPoleId})`
                                : 'Editor BT: selecione poste de origem'
                    : selectionMode === 'circle'
                        ? 'Clique para definir o centro'
                        : selectionMode === 'measure'
                            ? 'Clique em dois pontos para o perfil'
                            : 'Clique para adicionar pontos ao polígono'}
            </div>
        </div>
    );
};

export default MapSelector;
