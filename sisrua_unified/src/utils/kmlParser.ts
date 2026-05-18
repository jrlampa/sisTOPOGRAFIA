import JSZip from 'jszip';
import { AppLocale } from '../types';
import { getUtilsText } from '../i18n/utilsText';

export interface KmlMarker {
    point: [number, number]; // [lat, lon]
    name?: string;
}

export type KmlParseResult =
    | { type: 'polygon'; points: [number, number][] }
    | { type: 'markers'; markers: KmlMarker[] };

const readFileAsText = async (file: File, locale: AppLocale): Promise<string> =>
    new Promise((resolve, reject) => {
        const t = getUtilsText(locale).kml;
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) ?? '');
        reader.onerror = () => reject(new Error(t.readTextError));
        reader.readAsText(file);
    });

const readFileAsArrayBuffer = async (file: File, locale: AppLocale): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const t = getUtilsText(locale).kml;
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as ArrayBuffer) ?? new ArrayBuffer(0));
        reader.onerror = () => reject(new Error(t.readBinaryError));
        reader.readAsArrayBuffer(file);
    });

const parseCoordText = (rawCoords: string): [number, number][] => {
    const points: [number, number][] = [];
    const pairs = rawCoords.trim().split(/\s+/);
    for (const pair of pairs) {
        const parts = pair.split(',');
        if (parts.length >= 2) {
            const lon = Number.parseFloat(parts[0]);
            const lat = Number.parseFloat(parts[1]);
            // KML is lon,lat. Leaflet is lat,lon.
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                points.push([lat, lon]);
            }
        }
    }
    return points;
};

const parseKmlText = (text: string, locale: AppLocale): KmlParseResult => {
    const t = getUtilsText(locale).kml;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror');

    if (parserError.length > 0) {
        throw new Error(t.invalidContent);
    }

    const coordinateTags = xmlDoc.getElementsByTagName('coordinates');
    if (coordinateTags.length === 0) {
        throw new Error(t.noCoords);
    }

    // Determine geometry type: if any Polygon or LinearRing exists → area boundary.
    const hasPolygon =
        xmlDoc.getElementsByTagName('Polygon').length > 0 ||
        xmlDoc.getElementsByTagName('LinearRing').length > 0;

    if (hasPolygon) {
        // Area boundary: flatten all coordinates into one array (existing behavior).
        const allPoints: [number, number][] = [];
        for (let i = 0; i < coordinateTags.length; i++) {
            const pts = parseCoordText(coordinateTags[i].textContent ?? '');
            allPoints.push(...pts);
        }
        if (allPoints.length === 0) throw new Error(t.noValidCoords);
        return { type: 'polygon', points: allPoints };
    }

    // Point placemarks: collect each <Point> coordinate with optional Placemark name.
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    if (placemarks.length > 0) {
        const markers: KmlMarker[] = [];
        for (let i = 0; i < placemarks.length; i++) {
            const pm = placemarks[i];
            const coordEl = pm.getElementsByTagName('coordinates')[0];
            if (!coordEl) continue;
            const pts = parseCoordText(coordEl.textContent ?? '');
            if (pts.length === 0) continue;
            const nameEl = pm.getElementsByTagName('name')[0];
            markers.push({ point: pts[0], name: nameEl?.textContent?.trim() ?? undefined });
        }
        if (markers.length === 0) throw new Error(t.noValidMarkers);
        return { type: 'markers', markers };
    }

    // Fallback: collect all points.
    const allPoints: [number, number][] = [];
    for (let i = 0; i < coordinateTags.length; i++) {
        const pts = parseCoordText(coordinateTags[i].textContent ?? '');
        allPoints.push(...pts);
    }
    if (allPoints.length === 0) throw new Error(t.noValidCoords);
    if (allPoints.length >= 3) return { type: 'polygon', points: allPoints };
    return { type: 'markers', markers: allPoints.map(p => ({ point: p })) };
};

const extractKmlFromKmz = async (file: File, locale: AppLocale): Promise<string> => {
    const t = getUtilsText(locale).kml;
    const binary = await readFileAsArrayBuffer(file, locale);
    const zip = await JSZip.loadAsync(binary);

    // Prefer standard doc.kml, fallback to first .kml found.
    const preferredEntry = zip.file(/(^|\/)doc\.kml$/i)?.[0];
    const firstKmlEntry = zip.file(/\.kml$/i)?.[0];
    const kmlEntry = preferredEntry ?? firstKmlEntry;

    if (!kmlEntry) {
        throw new Error(t.noInternalKml);
    }

    return kmlEntry.async('text');
};

export const parseKml = async (file: File, locale: AppLocale = 'pt-BR'): Promise<KmlParseResult> => {
    const fileName = file.name.toLowerCase();
    const kmlText = fileName.endsWith('.kmz')
        ? await extractKmlFromKmz(file, locale)
        : await readFileAsText(file, locale);

    return parseKmlText(kmlText, locale);
};
