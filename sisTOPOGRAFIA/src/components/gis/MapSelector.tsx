import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, GeoJSON, Polygon, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GeoJsonObject, FeatureCollection } from 'geojson';

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
    selectionMode: 'circle' | 'polygon' | 'measure';
    polygonPoints: [number, number][];
    onLocationChange: (newCenter: { lat: number; lng: number; label?: string }) => void;
    onPolygonChange: (points: [number, number][]) => void;
    measurePath?: [number, number][]; // optional for now
    onMeasurePathChange?: (path: [number, number][]) => void;
    onKmlDrop?: (file: File) => void;
    mapStyle?: string;
    onMapStyleChange?: (style: string) => void;
    showAnalysis?: boolean;
    geojson?: GeoJsonObject | null;
    onFeatureSelect?: (feature: any) => void;
    activeHeatmap?: 'none' | 'slope' | 'solar';
    heatmapData?: {
        [key: string]: {
            metadata: {
                rows: number;
                cols: number;
                start_lat: number;
                start_lon: number;
                lat_step: number;
                lon_step: number;
            };
            data: number[][];
        };
    } | null;
}

const SelectionManager = ({
    center,
    radius,
    selectionMode,
    polygonPoints,
    onLocationChange,
    onPolygonChange,
    measurePath = [],
    onMeasurePathChange
}: any) => {
    const map = useMapEvents({
        click(e) {
            if (selectionMode === 'circle') {
                onLocationChange({
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                    label: `Selected (${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)})`
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

import { ImageOverlay } from 'react-leaflet';

const CanvasHeatmap = ({ data, metadata, type }: any) => {
    const [imgUrl, setImgUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!data || !metadata) return;

        const { rows, cols } = metadata;
        const canvas = document.createElement('canvas');
        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas just in case
        ctx.clearRect(0, 0, cols, rows);

        // We only want a bit of transparency
        ctx.globalAlpha = 0.65;

        // Use ImageData for extremely fast rendering
        const imgData = ctx.createImageData(cols, rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const val = data[r][c];
                // Invert Y index since r=0 is South, and canvas y=0 is North
                const y = rows - 1 - r;
                const idx = (y * cols + c) * 4;

                if (val <= 0.01) {
                    imgData.data[idx + 3] = 0; // Fully transparent
                    continue;
                }

                // HSL to RGB conversion inside loop for perf
                // Slope: Green (120) to Red (0)
                // Solar: Cyan (180) to Blue (240)
                let h, s, l;
                if (type === 'slope') {
                    h = (1 - Math.min(val, 1)) * 120 / 360;
                } else {
                    h = ((Math.min(val, 1) * 60) + 180) / 360;
                }
                s = 1;
                l = 0.5;

                let rC, gC, bC;
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                const hue2rgb = (p: number, q: number, t: number) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };

                rC = hue2rgb(p, q, h + 1 / 3);
                gC = hue2rgb(p, q, h);
                bC = hue2rgb(p, q, h - 1 / 3);

                imgData.data[idx] = Math.round(rC * 255);
                imgData.data[idx + 1] = Math.round(gC * 255);
                imgData.data[idx + 2] = Math.round(bC * 255);
                imgData.data[idx + 3] = 165; // ~0.65 alpha in bits
            }
        }

        ctx.putImageData(imgData, 0, 0);
        setImgUrl(canvas.toDataURL('image/png'));

    }, [data, metadata, type]);

    if (!imgUrl) return null;

    const { rows, cols, start_lat, start_lon, lat_step, lon_step } = metadata;
    // Bounds for ImageOverlay: [[south, west], [north, east]]
    const bounds: [number, number][] = [
        [start_lat, start_lon],
        [start_lat + (rows * lat_step), start_lon + (cols * lon_step)]
    ];

    return (
        <ImageOverlay
            url={imgUrl}
            bounds={bounds}
            zIndex={400}
        />
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
    onKmlDrop,
    mapStyle = 'dark',
    onMapStyleChange,
    showAnalysis = false,
    geojson,
    onFeatureSelect,
    activeHeatmap = 'none',
    heatmapData
}) => {

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
                />

                {geojson && (
                    <GeoJSON
                        data={geojson}
                        onEachFeature={(feature, layer) => {
                            layer.on({
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e);
                                    if (onFeatureSelect) onFeatureSelect(feature);
                                }
                            });
                        }}
                    />
                )}

                {activeHeatmap !== 'none' && heatmapData && heatmapData[activeHeatmap] && (
                    <CanvasHeatmap
                        data={heatmapData[activeHeatmap].data}
                        metadata={heatmapData[activeHeatmap].metadata}
                        type={activeHeatmap}
                    />
                )}

            </MapContainer>

            {/* Overlay Controls could go here */}
            <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/80 backdrop-blur text-[10px] font-black uppercase tracking-widest p-2 px-3 rounded-xl text-slate-400 border border-white/5 shadow-2xl">
                {selectionMode === 'circle' ? 'Clique para definir o centro' : 'Clique para adicionar pontos ao polígono'}
            </div>
        </div>
    );
};

export default MapSelector;
