import React from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, GeoJSON, Polygon, Polyline, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GeoJsonObject, FeatureCollection } from 'geojson';
import { BtEditorMode, BtTopology, SelectionMode } from '../types';

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
    onBtDeleteTransformer?: (id: string) => void;
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

const SelectionManager = ({
    center,
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
    const map = useMapEvents({
        click(e) {
            if (btEditorMode !== 'none' && onBtMapClick) {
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
    onBtDeleteTransformer,
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

    const makePoleIcon = (poleId: string, verified: boolean) => {
        const isCritical = poleId === criticalPoleId;
        const isPending = poleId === pendingBtEdgeStartPoleId;
        let bg = '#2563eb';
        let size = 12;
        if (isCritical) { bg = '#ef4444'; size = 16; }
        else if (isPending) { bg = '#f59e0b'; size = 14; }
        else if (verified) { bg = '#16a34a'; }
        return L.divIcon({
            className: 'bt-pole-icon',
            html: `<div style="background:${bg};border:2px solid #ffffff;width:${size}px;height:${size}px;border-radius:9999px;box-shadow:0 0 0 2px ${bg}40;"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
    };

    const makeTransformerIcon = (verified: boolean) => {
        const bg = verified ? '#15803d' : '#7c3aed';
        return L.divIcon({
            className: 'bt-transformer-icon',
            html: `<div style="background:${bg};border:2px solid #ffffff;width:14px;height:14px;transform:rotate(45deg);"></div>`,
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
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    maxZoom={24}
                    maxNativeZoom={19}
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

                    return (
                        <Polyline
                            key={edge.id}
                            positions={[[from.lat, from.lng], [to.lat, to.lng]]}
                            pathOptions={{ color: edge.verified ? '#22c55e' : '#f59e0b', weight: edge.verified ? 3 : 2, opacity: 0.9, dashArray: edge.verified ? undefined : '6 4' }}
                        >
                            <Popup>
                                <div className="text-xs">
                                    <div><strong>{edge.id}</strong></div>
                                    <div>{edge.fromPoleId}{' <-> '}{edge.toPoleId}</div>
                                    {typeof edge.lengthMeters === 'number' && <div>{edge.lengthMeters} m</div>}
                                    <div style={{color: edge.verified ? '#16a34a' : '#d97706', fontWeight: 600, marginTop: 2}}>{edge.verified ? '✓ Verificado' : '○ Não verificado'}</div>
                                    {onBtDeleteEdge && (
                                        <button
                                            onClick={() => onBtDeleteEdge(edge.id)}
                                            style={{marginTop: 4, padding: '2px 8px', background: '#ef444420', border: '1px solid #ef4444', borderRadius: 4, color: '#ef4444', cursor: 'pointer', fontSize: 11}}
                                        >
                                            Deletar condutor
                                        </button>
                                    )}
                                </div>
                            </Popup>
                        </Polyline>
                    );
                })}

                {(topology.poles || []).map((pole) => (
                    <Marker
                        key={`${pole.id}-${pole.verified ? 'v' : 'u'}-${pole.id === criticalPoleId ? 'c' : 'n'}-${pole.id === pendingBtEdgeStartPoleId ? 'p' : 'x'}`}
                        position={[pole.lat, pole.lng]}
                        icon={makePoleIcon(pole.id, !!pole.verified)}
                        draggable={btEditorMode === 'none'}
                        eventHandlers={{
                            click: () => {
                                if (btEditorMode === 'add-edge' && onBtMapClick) {
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
                            <span style={{fontSize: 10, fontWeight: 600}}>{pole.title}</span>
                        </Tooltip>
                        <Popup>
                            <div className="text-xs">
                                <strong>{pole.title}</strong>
                                <div>{pole.id}</div>
                                {pole.id === criticalPoleId && <div style={{color:'#ef4444', fontWeight:700, marginTop:2}}>⚠ Ponto crítico</div>}
                                {accumulatedByPoleMap.has(pole.id) && (
                                    <div style={{marginTop: 3, color: '#374151'}}>
                                        <div>CLT acum.: {accumulatedByPoleMap.get(pole.id)!.accumulatedClients}</div>
                                        <div>Dem. acum.: {accumulatedByPoleMap.get(pole.id)!.accumulatedDemandKva.toFixed(2)} kVA</div>
                                    </div>
                                )}
                                <div style={{color: pole.verified ? '#16a34a' : '#d97706', fontWeight: 600, marginTop: 2}}>{pole.verified ? '✓ Verificado' : '○ Não verificado'}</div>
                                {onBtDeletePole && (
                                    <button
                                        onClick={() => onBtDeletePole(pole.id)}
                                        style={{marginTop: 4, padding: '2px 8px', background: '#ef444420', border: '1px solid #ef4444', borderRadius: 4, color: '#ef4444', cursor: 'pointer', fontSize: 11}}
                                    >
                                        Deletar poste
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {(topology.transformers || []).map((transformer) => (
                    <Marker
                        key={`${transformer.id}-${transformer.verified ? 'v' : 'u'}`}
                        position={[transformer.lat, transformer.lng]}
                        icon={makeTransformerIcon(!!transformer.verified)}
                        draggable={btEditorMode === 'none'}
                        eventHandlers={{
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
                                <div>Demanda: {transformer.demandKw} kW</div>
                                <div style={{color: transformer.verified ? '#16a34a' : '#d97706', fontWeight: 600, marginTop: 2}}>{transformer.verified ? '✓ Verificado' : '○ Não verificado'}</div>
                                {onBtDeleteTransformer && (
                                    <button
                                        onClick={() => onBtDeleteTransformer(transformer.id)}
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
