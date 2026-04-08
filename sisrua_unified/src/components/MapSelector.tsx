import React from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, GeoJSON, Polygon, Polyline, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GeoJsonObject, FeatureCollection } from 'geojson';
import { BtEditorMode, BtEdge, BtPoleNode, BtRamalEntry, BtTopology, BtTransformer, SelectionMode } from '../types';
import { Minus, Plus, Trash2, Triangle } from 'lucide-react';

const CONDUCTOR_OPTIONS = [
    'FLY2',
    'FLY 2',
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

// Fix for default marker icon in React Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
    accumulatedByPole?: { poleId: string; accumulatedClients: number; accumulatedDemandKva: number }[];
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
}: any) => {
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
                    {polygonPoints.map((point: any, i: number) => (
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
                    {measurePath.map((point: any, i: number) => (
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

    const poleHasTransformer = React.useMemo(() => {
        const byPole = new Map<string, boolean>();
        const distanceThresholdMeters = 6;

        for (const pole of topology.poles || []) {
            const hasTransformer = (topology.transformers || []).some((transformer) => {
                if (transformer.poleId) {
                    return transformer.poleId === pole.id;
                }
                const polePoint = L.latLng(pole.lat, pole.lng);
                const transformerPoint = L.latLng(transformer.lat, transformer.lng);
                return polePoint.distanceTo(transformerPoint) <= distanceThresholdMeters;
            });
            byPole.set(pole.id, hasTransformer);
        }

        return byPole;
    }, [topology.poles, topology.transformers]);

    const makePoleIcon = (poleId: string, verified: boolean) => {
        const hasTransformer = !!poleHasTransformer.get(poleId);
        const isCritical = poleId === criticalPoleId;
        const isPending = poleId === pendingBtEdgeStartPoleId;
        const pole = topology.poles.find((item) => item.id === poleId);
        const poleFlag = pole ? getPoleChangeFlag(pole) : 'existing';

        if (hasTransformer) {
            const bg = getFlagColor(poleFlag, verified ? '#15803d' : '#7c3aed');
            const size = isCritical ? 18 : isPending ? 16 : 14;
            return L.divIcon({
                className: 'bt-pole-transformer-icon',
                html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 0 ${bg}66);"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2]
            });
        }

        let bg = '#2563eb';
        let size = 12;
        if (isCritical) { bg = '#ef4444'; size = 16; }
        else if (isPending) { bg = '#f59e0b'; size = 14; }
        else { bg = getFlagColor(poleFlag, verified ? '#16a34a' : '#2563eb'); }
        return L.divIcon({
            className: 'bt-pole-icon',
            html: `<div style="background:${bg};border:2px solid #ffffff;width:${size}px;height:${size}px;border-radius:9999px;box-shadow:0 0 0 2px ${bg}40;"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    };

    const makeTransformerIcon = (verified: boolean, transformerFlag: BtTransformerChangeFlag) => {
        const bg = getFlagColor(transformerFlag, verified ? '#15803d' : '#7c3aed');
        return L.divIcon({
            className: 'bt-transformer-icon',
            html: `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21L2 3h20L12 21Z" fill="${bg}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    };

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
            className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 relative z-0"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ minHeight: '400px', backgroundColor: '#f1f5f9' }}
        >
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={15}
                scrollWheelZoom={true}
                maxZoom={24}
                style={{ height: '100%', width: '100%', minHeight: '400px' }}
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
                        tileerror: (error: any) => {
                            // Tile load error (expected for some tiles)
                        },
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

                {(topology.edges || []).map((edge) => {
                    const from = polesById.get(edge.fromPoleId);
                    const to = polesById.get(edge.toPoleId);
                    if (!from || !to) {
                        return null;
                    }

                    const edgeChangeFlag = getEdgeChangeFlag(edge);
                    const edgeVisual = getEdgeVisualConfig(edge);
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
                                <div style={{marginTop: 2, color: '#334155'}}>{from.title} {'<->'} {to.title}</div>
                                <div style={{marginTop: 4, color: '#334155'}}>Flag: <strong>{edgeFlagLabel}</strong></div>
                                <div style={{marginTop: 4, color: '#334155'}}>Condutor</div>
                                <div style={{marginTop: 2}}>
                                    <select
                                        value={selectedConductor}
                                        onChange={(e) => {
                                            const conductorName = e.target.value;
                                            setEdgeConductorSelection((current) => ({
                                                ...current,
                                                [edge.id]: conductorName
                                            }));
                                        }}
                                        style={{width: '100%', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#334155', background: '#ffffff'}}
                                    >
                                        {CONDUCTOR_OPTIONS.map((name) => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{marginTop: 6, color: '#334155'}}>
                                    Metragem: {typeof edge.lengthMeters === 'number' ? `${edge.lengthMeters} m` : '-'}
                                </div>
                                {edgeChangeFlag === 'replace' && (
                                    <>
                                        <div style={{marginTop: 6, color: '#334155'}}>Condutor que sai</div>
                                        <div style={{marginTop: 2}}>
                                            <select
                                                value={selectedReplacementFromConductor}
                                                onChange={(e) => {
                                                    const conductorName = e.target.value;
                                                    setEdgeReplacementFromSelection((current) => ({
                                                        ...current,
                                                        [edge.id]: conductorName
                                                    }));
                                                }}
                                                style={{width: '100%', border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#334155', background: '#ffffff'}}
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
                                                        id: `RC${Date.now()}${Math.floor(Math.random() * 1000)}`,
                                                        quantity: 1,
                                                        conductorName: selectedReplacementFromConductor
                                                    }]);
                                                }}
                                                style={{marginTop: 6, height: 24, width: '100%', border: '1px solid #f59e0b', borderRadius: 4, color: '#92400e', background: '#fffbeb', cursor: 'pointer', fontSize: 11, fontWeight: 700}}
                                            >
                                                Definir condutor que sai
                                            </button>
                                        )}
                                    </>
                                )}
                                {edge.conductors.length > 0 ? (
                                    <div style={{marginTop: 2, color: '#374151'}}>
                                        {edge.conductors.map((entry) => (
                                            <div key={entry.id}>{entry.quantity} x {entry.conductorName}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{marginTop: 2, color: '#6b7280'}}>Sem condutor informado</div>
                                )}
                                {edgeChangeFlag === 'replace' && (
                                    <div style={{marginTop: 2, color: '#7c2d12'}}>
                                        {(edge.replacementFromConductors ?? []).length > 0
                                            ? (edge.replacementFromConductors ?? []).map((entry) => (
                                                <div key={entry.id}>Sai: {entry.quantity} x {entry.conductorName}</div>
                                            ))
                                            : <div>Sem condutor de saída definido</div>}
                                    </div>
                                )}
                                <div style={{color: edge.verified ? '#16a34a' : '#d97706', fontWeight: 600, marginTop: 2}}>{edge.verified ? '✓ Verificado' : '○ Não verificado'}</div>
                                {onBtSetEdgeChangeFlag && (
                                    <div style={{marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6}}>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'existing');
                                            }}
                                            style={{height: 24, border: '1px solid #d946ef', borderRadius: 4, color: '#a21caf', background: edgeChangeFlag === 'existing' ? '#fae8ff' : '#ffffff', cursor: 'pointer', fontSize: 11, fontWeight: 700}}
                                        >
                                            Existente
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'new');
                                            }}
                                            style={{height: 24, border: '1px solid #22c55e', borderRadius: 4, color: '#15803d', background: edgeChangeFlag === 'new' ? '#dcfce7' : '#ffffff', cursor: 'pointer', fontSize: 11, fontWeight: 700}}
                                        >
                                            Novo
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'replace');
                                            }}
                                            style={{height: 24, border: '1px solid #facc15', borderRadius: 4, color: '#a16207', background: edgeChangeFlag === 'replace' ? '#fef9c3' : '#ffffff', cursor: 'pointer', fontSize: 11, fontWeight: 700}}
                                        >
                                            Substituição
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtSetEdgeChangeFlag(edge.id, 'remove');
                                            }}
                                            style={{height: 24, border: '1px solid #ef4444', borderRadius: 4, color: '#b91c1c', background: edgeChangeFlag === 'remove' ? '#fee2e2' : '#ffffff', cursor: 'pointer', fontSize: 11, fontWeight: 700}}
                                        >
                                            Remoção
                                        </button>
                                    </div>
                                )}
                                <div style={{marginTop: 6, display: 'flex', gap: 8, alignItems: 'center'}}>
                                    {onBtDeleteEdge && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtDeleteEdge(edge.id);
                                            }}
                                            title="Deletar trecho"
                                            aria-label="Deletar trecho"
                                            style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, border: '1px solid #ef4444', borderRadius: 4, color: '#ef4444', background: '#ef444420', cursor: 'pointer'}}
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
                                            style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, border: '1px solid #0ea5e9', borderRadius: 4, color: '#0284c7', background: '#0ea5e914', cursor: 'pointer'}}
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
                                            style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, border: '1px solid #64748b', borderRadius: 4, color: '#334155', background: '#f1f5f9', cursor: 'pointer'}}
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
                                                html: '<div style="color:#dc2626;font-weight:900;font-size:13px;line-height:1;text-shadow:0 0 2px #fff;">X</div>',
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

                {(topology.poles || []).map((pole) => (
                    <Marker
                        key={`${pole.id}-${pole.verified ? 'v' : 'u'}-${pole.id === criticalPoleId ? 'c' : 'n'}-${pole.id === pendingBtEdgeStartPoleId ? 'p' : 'x'}-${poleHasTransformer.get(pole.id) ? 't' : 'nt'}`}
                        position={[pole.lat, pole.lng]}
                        icon={makePoleIcon(pole.id, !!pole.verified)}
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
                        <Tooltip permanent direction="top" offset={[0, -8]} opacity={0.85}>
                            <span style={{ fontSize: 10, fontWeight: 600 }}>{pole.title}</span>
                        </Tooltip>
                        <Popup>
                            <div className="text-xs">
                                <strong>{pole.title}</strong>
                                <div>{pole.id}</div>
                                {onBtRenamePole && (
                                    <input
                                        type="text"
                                        value={pole.title}
                                        onChange={(e) => onBtRenamePole(pole.id, e.target.value)}
                                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                                    />
                                )}
                                {pole.id === criticalPoleId && <div style={{ color: '#ef4444', fontWeight: 700, marginTop: 2 }}>⚠ Ponto crítico</div>}
                                {accumulatedByPoleMap.has(pole.id) && (
                                    <div style={{ marginTop: 3, color: '#374151' }}>
                                        <div>CLT acum.: {accumulatedByPoleMap.get(pole.id)!.accumulatedClients}</div>
                                        <div>Demanda acum.: {accumulatedByPoleMap.get(pole.id)!.accumulatedDemandKva.toFixed(2)} kVA</div>
                                    </div>
                                )}
                                <div style={{ color: pole.verified ? '#16a34a' : '#d97706', fontWeight: 600, marginTop: 2 }}>
                                    {pole.verified ? '✓ Verificado' : '○ Não verificado'}
                                </div>
                                <div style={{ marginTop: 2, color: '#334155' }}>
                                    Flag: <strong>{getPoleChangeFlag(pole) === 'new' ? 'Novo' : getPoleChangeFlag(pole) === 'remove' ? 'Remoção' : getPoleChangeFlag(pole) === 'replace' ? 'Substituição' : 'Existente'}</strong>
                                </div>
                                {(pole.circuitBreakPoint ?? false) && (
                                    <div style={{ marginTop: 2, color: '#0369a1', fontWeight: 700 }}>
                                        Separação física ativa: circuito interrompido neste poste.
                                    </div>
                                )}
                                {onBtSetPoleChangeFlag && (
                                    <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'existing'); }} style={{ height: 22, border: '1px solid #d946ef', borderRadius: 4, color: '#a21caf', background: getPoleChangeFlag(pole) === 'existing' ? '#fae8ff' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Existente</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'new'); }} style={{ height: 22, border: '1px solid #22c55e', borderRadius: 4, color: '#15803d', background: getPoleChangeFlag(pole) === 'new' ? '#dcfce7' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Novo</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'replace'); }} style={{ height: 22, border: '1px solid #facc15', borderRadius: 4, color: '#a16207', background: getPoleChangeFlag(pole) === 'replace' ? '#fef9c3' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Substituição</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetPoleChangeFlag(pole.id, 'remove'); }} style={{ height: 22, border: '1px solid #ef4444', borderRadius: 4, color: '#b91c1c', background: getPoleChangeFlag(pole) === 'remove' ? '#fee2e2' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Remoção</button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBtTogglePoleCircuitBreak?.(pole.id, !(pole.circuitBreakPoint ?? false));
                                            }}
                                            title="Separa fisicamente o circuito neste poste"
                                            style={{
                                                height: 22,
                                                border: `1px solid ${(pole.circuitBreakPoint ?? false) ? '#38bdf8' : '#94a3b8'}`,
                                                borderRadius: 4,
                                                color: (pole.circuitBreakPoint ?? false) ? '#0369a1' : '#475569',
                                                background: (pole.circuitBreakPoint ?? false) ? '#e0f2fe' : '#ffffff',
                                                cursor: 'pointer',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                fontFamily: 'monospace',
                                                letterSpacing: '-0.2px'
                                            }}
                                        >
                                            -| |-
                                        </button>
                                    </div>
                                )}
                                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onBtDeletePole?.(pole.id);
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, background: '#ef444420', border: '1px solid #ef4444', borderRadius: 4, color: '#ef4444', cursor: 'pointer' }}
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
                                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, border: `1px solid ${poleHasTransformer.get(pole.id) ? '#7c3aed' : '#64748b'}`, borderRadius: 4, color: poleHasTransformer.get(pole.id) ? '#7c3aed' : '#475569', background: poleHasTransformer.get(pole.id) ? '#7c3aed14' : '#f1f5f9', cursor: 'pointer' }}
                                    >
                                        <Triangle size={12} style={{ transform: 'rotate(180deg)', fill: 'currentColor' }} />
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
                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, border: '1px solid #0ea5e9', borderRadius: 4, color: '#0284c7', background: '#0ea5e914', cursor: 'pointer' }}
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
                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, border: '1px solid #64748b', borderRadius: 4, color: '#334155', background: '#f1f5f9', cursor: 'pointer' }}
                                        >
                                            <Minus size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {(topology.transformers || []).map((transformer) => (
                    <Marker
                        key={`${transformer.id}-${transformer.verified ? 'v' : 'u'}`}
                        position={[transformer.lat, transformer.lng]}
                        icon={makeTransformerIcon(!!transformer.verified, getTransformerChangeFlag(transformer))}
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
                        <Tooltip permanent direction="bottom" offset={[0, 8]} opacity={0.85}>
                            <span style={{fontSize: 10, fontWeight: 600}}>{transformer.title}</span>
                        </Tooltip>
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
                                <div style={{color: transformer.verified ? '#16a34a' : '#d97706', fontWeight: 600, marginTop: 2}}>{transformer.verified ? '✓ Verificado' : '○ Não verificado'}</div>
                                <div style={{ marginTop: 2, color: '#334155' }}>
                                    Flag: <strong>{getTransformerChangeFlag(transformer) === 'new' ? 'Novo' : getTransformerChangeFlag(transformer) === 'remove' ? 'Remoção' : getTransformerChangeFlag(transformer) === 'replace' ? 'Substituição' : 'Existente'}</strong>
                                </div>
                                {onBtSetTransformerChangeFlag && (
                                    <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'existing'); }} style={{ height: 22, border: '1px solid #d946ef', borderRadius: 4, color: '#a21caf', background: getTransformerChangeFlag(transformer) === 'existing' ? '#fae8ff' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Existente</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'new'); }} style={{ height: 22, border: '1px solid #22c55e', borderRadius: 4, color: '#15803d', background: getTransformerChangeFlag(transformer) === 'new' ? '#dcfce7' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Novo</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'replace'); }} style={{ height: 22, border: '1px solid #facc15', borderRadius: 4, color: '#a16207', background: getTransformerChangeFlag(transformer) === 'replace' ? '#fef9c3' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Substituição</button>
                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBtSetTransformerChangeFlag(transformer.id, 'remove'); }} style={{ height: 22, border: '1px solid #ef4444', borderRadius: 4, color: '#b91c1c', background: getTransformerChangeFlag(transformer) === 'remove' ? '#fee2e2' : '#ffffff', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Remoção</button>
                                    </div>
                                )}
                                {onBtDeleteTransformer && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onBtDeleteTransformer(transformer.id);
                                        }}
                                        style={{marginTop: 4, padding: '2px 8px', background: '#ef444420', border: '1px solid #ef4444', borderRadius: 4, color: '#ef4444', cursor: 'pointer', fontSize: 11}}
                                    >
                                        Deletar trafo
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}

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
