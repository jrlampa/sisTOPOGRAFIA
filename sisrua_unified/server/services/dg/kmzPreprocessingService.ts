/**
 * kmzPreprocessingService – Converte KMZ/KML em componentes de entrada do MT Router.
 *
 * Um arquivo KMZ é um ZIP contendo um arquivo .kml (XML).
 * O serviço extrai:
 *   – Placemarks com <Point> → candidatos a terminal (trafo) ou a source
 *   – Placemarks com <LineString> → corredores viários (roadCorridors)
 *
 * Convenções de uso no KML:
 *   – Placemark com name "SOURCE" (case-insensitive) → ponto de origem da MT
 *   – Demais Placemarks com <Point> → terminais (trafos)
 *   – Placemarks com <LineString> → segmentos de via
 *
 * Dependências: jszip (já presente), fast-xml-parser (instalado em fase 2)
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { DgLatLon, DgRoadCorridor } from "./dgTypes.js";

// ─── Tipos de saída ────────────────────────────────────────────────────────────

export interface KmzTerminal {
  id: string;
  name: string;
  position: DgLatLon;
}

export interface KmzParseResult {
  /** Ponto de origem da MT (Placemark com name = "SOURCE"). */
  source?: DgLatLon;
  /** Terminais candidatos (trafos). */
  terminals: KmzTerminal[];
  /** Corredores viários extraídos de LineStrings. */
  roadCorridors: DgRoadCorridor[];
  /** Alertas não-fatais (ex: placemarks ignorados). */
  warnings: string[];
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CORRIDORS = 200;
const MAX_TERMINALS = 50;
const DEFAULT_BUFFER_METERS = 15;

// ─── Utilidades ────────────────────────────────────────────────────────────────

/**
 * Parseia string "lon,lat,alt" ou "lon,lat" do formato KML para DgLatLon.
 * KML usa ordem lon,lat (ao contrário de lat,lon).
 */
function parseKmlCoord(raw: string): DgLatLon | null {
  const parts = raw.trim().split(",");
  const lon = parseFloat(parts[0] ?? "");
  const lat = parseFloat(parts[1] ?? "");
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Parseia string de coordenadas de uma LineString KML.
 * Cada ponto separado por espaço/newline, formato "lon,lat,alt".
 */
function parseKmlLineString(raw: string): DgLatLon[] {
  return raw
    .trim()
    .split(/\s+/)
    .map(parseKmlCoord)
    .filter((p): p is DgLatLon => p !== null);
}

/**
 * Normaliza nome para id (remove espaços, maiúsculas, caracteres especiais).
 */
function toId(name: string, idx: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `item-${idx}`;
}

// ─── Parser XML de KML ─────────────────────────────────────────────────────────

interface KmlPlacemark {
  name?: string | number;
  Point?: { coordinates?: string };
  LineString?: { coordinates?: string };
  MultiGeometry?: {
    LineString?: Array<{ coordinates?: string }> | { coordinates?: string };
  };
  Style?: unknown;
  styleUrl?: unknown;
}

interface KmlDocument {
  Placemark?: KmlPlacemark | KmlPlacemark[];
  Folder?: KmlFolder | KmlFolder[];
  Document?: KmlDocument | KmlDocument[];
}

interface KmlFolder {
  Placemark?: KmlPlacemark | KmlPlacemark[];
  Folder?: KmlFolder | KmlFolder[];
}

interface KmlRoot {
  kml?: { Document?: KmlDocument | KmlDocument[] };
}

/**
 * Coleta todos os Placemarks recursivamente dentro de Document/Folder.
 */
function collectPlacemarks(node: KmlDocument | KmlFolder): KmlPlacemark[] {
  const result: KmlPlacemark[] = [];

  const pms = node.Placemark;
  if (pms) {
    if (Array.isArray(pms)) result.push(...pms);
    else result.push(pms);
  }

  const folders = (node as KmlDocument).Folder;
  if (folders) {
    const arr = Array.isArray(folders) ? folders : [folders];
    for (const f of arr) result.push(...collectPlacemarks(f));
  }

  const docs = (node as KmlDocument).Document;
  if (docs) {
    const arr = Array.isArray(docs) ? docs : [docs];
    for (const d of arr) result.push(...collectPlacemarks(d));
  }

  return result;
}

// ─── Extração de KML string ────────────────────────────────────────────────────

function parseKml(kmlXml: string): KmzParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  const root: KmlRoot = parser.parse(kmlXml);
  const warnings: string[] = [];

  const kmlDoc = root?.kml?.Document;
  if (!kmlDoc) {
    return { terminals: [], roadCorridors: [], warnings: ["KML sem <Document> raiz."] };
  }

  const docArr = Array.isArray(kmlDoc) ? kmlDoc : [kmlDoc];
  const allPlacemarks: KmlPlacemark[] = [];
  for (const doc of docArr) allPlacemarks.push(...collectPlacemarks(doc));

  if (allPlacemarks.length === 0) {
    warnings.push("Nenhum Placemark encontrado no KML.");
    return { terminals: [], roadCorridors: [], warnings };
  }

  let source: DgLatLon | undefined;
  const terminals: KmzTerminal[] = [];
  const roadCorridors: DgRoadCorridor[] = [];

  for (let i = 0; i < allPlacemarks.length; i++) {
    const pm = allPlacemarks[i];
    const rawName = pm.name != null ? String(pm.name) : `Placemark-${i}`;

    // ── LineString → corredor viário ──────────────────────────────────────────
    if (pm.LineString?.coordinates) {
      if (roadCorridors.length >= MAX_CORRIDORS) {
        warnings.push(`Limite de ${MAX_CORRIDORS} corredores atingido; Placemarks restantes ignorados.`);
        continue;
      }
      const pts = parseKmlLineString(pm.LineString.coordinates);
      if (pts.length < 2) {
        warnings.push(`LineString "${rawName}" com menos de 2 pontos válidos; ignorada.`);
        continue;
      }
      roadCorridors.push({
        id: `corridor-${toId(rawName, i)}`,
        label: rawName,
        centerPoints: pts,
        bufferMeters: DEFAULT_BUFFER_METERS,
      });
      continue;
    }

    // ── MultiGeometry com LineStrings ─────────────────────────────────────────
    if (pm.MultiGeometry?.LineString) {
      const lss = pm.MultiGeometry.LineString;
      const arr = Array.isArray(lss) ? lss : [lss];
      for (let j = 0; j < arr.length; j++) {
        if (roadCorridors.length >= MAX_CORRIDORS) break;
        const pts = parseKmlLineString(arr[j].coordinates ?? "");
        if (pts.length < 2) continue;
        roadCorridors.push({
          id: `corridor-${toId(rawName, i)}-${j}`,
          label: `${rawName} [${j}]`,
          centerPoints: pts,
          bufferMeters: DEFAULT_BUFFER_METERS,
        });
      }
      continue;
    }

    // ── Point → source ou terminal ────────────────────────────────────────────
    if (pm.Point?.coordinates) {
      const pos = parseKmlCoord(pm.Point.coordinates);
      if (!pos) {
        warnings.push(`Placemark "${rawName}" com coordenada inválida; ignorado.`);
        continue;
      }
      if (rawName.toLowerCase() === "source" || rawName.toLowerCase() === "origem") {
        source = pos;
        continue;
      }
      if (terminals.length >= MAX_TERMINALS) {
        warnings.push(`Limite de ${MAX_TERMINALS} terminais atingido; "${rawName}" ignorado.`);
        continue;
      }
      terminals.push({
        id: `terminal-${toId(rawName, i)}`,
        name: rawName,
        position: pos,
      });
      continue;
    }

    warnings.push(`Placemark "${rawName}" sem geometria reconhecida; ignorado.`);
  }

  return { source, terminals, roadCorridors, warnings };
}

// ─── Função principal exportada ────────────────────────────────────────────────

/**
 * Parseia um buffer KMZ (zip) ou KML (xml) e retorna os componentes para o MT Router.
 *
 * @param buffer  Buffer do arquivo enviado via upload
 * @param mimeType  MIME type do arquivo (para distinguir KMZ de KML)
 */
export async function parseKmzToMtRouterInput(
  buffer: Buffer,
  mimeType: string,
): Promise<KmzParseResult> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Arquivo excede o limite de ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
  }

  let kmlXml: string;

  const isKmz =
    mimeType === "application/vnd.google-earth.kmz" ||
    mimeType === "application/zip" ||
    mimeType === "application/octet-stream";

  if (isKmz) {
    const zip = await JSZip.loadAsync(buffer);
    // Busca o primeiro .kml dentro do ZIP
    const kmlEntry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.toLowerCase().endsWith(".kml"),
    );
    if (!kmlEntry) {
      throw new Error("KMZ não contém arquivo .kml.");
    }
    kmlXml = await kmlEntry.async("string");
  } else {
    // KML direto
    kmlXml = buffer.toString("utf-8");
  }

  return parseKml(kmlXml);
}
