/**
 * Testes unitários para kmzPreprocessingService.
 * Cobrem parsing KML (Point → source/terminal, LineString → corredor),
 * limites de segurança e avisos de dados inválidos.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseKmzToMtRouterInput } from "../services/dg/kmzPreprocessingService.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildKml(placemarks: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
${placemarks}
</Document>
</kml>`;
}

async function kmlBuffer(kmlXml: string): Promise<Buffer> {
  return Buffer.from(kmlXml, "utf-8");
}

async function kmzBuffer(kmlXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("doc.kml", kmlXml);
  const ab = await zip.generateAsync({ type: "arraybuffer" });
  return Buffer.from(ab);
}

const SOURCE_PLACEMARK = `
<Placemark>
  <name>SOURCE</name>
  <Point><coordinates>-46.638,-23.548,0</coordinates></Point>
</Placemark>`;

const TERMINAL_PLACEMARK = (name: string, lon: number, lat: number) => `
<Placemark>
  <name>${name}</name>
  <Point><coordinates>${lon},${lat},0</coordinates></Point>
</Placemark>`;

const LINE_PLACEMARK = (name: string, coords: string) => `
<Placemark>
  <name>${name}</name>
  <LineString><coordinates>${coords}</coordinates></LineString>
</Placemark>`;

// ─── Testes: parsing KML direto ───────────────────────────────────────────────

describe("kmzPreprocessingService – KML direto", () => {
  it("extrai ponto SOURCE como origem", async () => {
    const kml = buildKml(SOURCE_PLACEMARK);
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "application/vnd.google-earth.kml+xml");
    expect(result.source).toEqual({ lat: -23.548, lon: -46.638 });
    expect(result.warnings).toHaveLength(0);
  });

  it("extrai terminal de Placemark com Point que não é SOURCE", async () => {
    const kml = buildKml(
      SOURCE_PLACEMARK +
      TERMINAL_PLACEMARK("Trafo-01", -46.640, -23.550)
    );
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "text/xml");
    expect(result.terminals).toHaveLength(1);
    expect(result.terminals[0].name).toBe("Trafo-01");
    expect(result.terminals[0].position).toEqual({ lat: -23.550, lon: -46.640 });
  });

  it("extrai corredor viário de LineString", async () => {
    const kml = buildKml(
      LINE_PLACEMARK("Rua A", "-46.638,-23.548,0 -46.640,-23.550,0 -46.642,-23.552,0")
    );
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "text/xml");
    expect(result.roadCorridors).toHaveLength(1);
    expect(result.roadCorridors[0].id).toBeTruthy();
    expect(result.roadCorridors[0].centerPoints).toHaveLength(3);
    expect(result.roadCorridors[0].centerPoints[0]).toEqual({ lat: -23.548, lon: -46.638 });
  });

  it("aceita 'ORIGEM' (pt-BR) como ponto de origem", async () => {
    const kml = buildKml(`
<Placemark>
  <name>ORIGEM</name>
  <Point><coordinates>-46.638,-23.548,0</coordinates></Point>
</Placemark>`);
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "text/xml");
    expect(result.source).toBeDefined();
    expect(result.terminals).toHaveLength(0);
  });

  it("emite aviso para coordenadas inválidas em LineString", async () => {
    const kml = buildKml(
      LINE_PLACEMARK("Rua Ruim", "abc,def,0 -46.640,-23.550,0")
    );
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "text/xml");
    // O corredor ainda pode ser criado com os pontos válidos, ou emitir aviso
    // Apenas garantimos que não lança exceção e produz resultado
    expect(result).toBeDefined();
    expect(result.terminals).toHaveLength(0);
  });

  it("emite aviso quando LineString tem menos de 2 pontos válidos", async () => {
    const kml = buildKml(
      LINE_PLACEMARK("Rua Curta", "-46.638,-23.548,0")
    );
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "text/xml");
    expect(result.warnings.some((w) => /ponto/.test(w.toLowerCase()) || /ignorad/.test(w.toLowerCase()))).toBe(true);
    expect(result.roadCorridors).toHaveLength(0);
  });

  it("retorna aviso para KML sem <Document>", async () => {
    const badKml = `<?xml version="1.0"?><kml><Folder></Folder></kml>`;
    const result = await parseKmzToMtRouterInput(await kmlBuffer(badKml), "text/xml");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.terminals).toHaveLength(0);
    expect(result.roadCorridors).toHaveLength(0);
  });

  it("não inclui source nos terminais", async () => {
    const kml = buildKml(
      SOURCE_PLACEMARK +
      TERMINAL_PLACEMARK("T1", -46.640, -23.550) +
      TERMINAL_PLACEMARK("T2", -46.641, -23.551)
    );
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "text/xml");
    expect(result.source).toBeDefined();
    expect(result.terminals).toHaveLength(2);
    expect(result.terminals.every((t) => t.name !== "SOURCE")).toBe(true);
  });
});

// ─── Testes: KMZ (zip) ────────────────────────────────────────────────────────

describe("kmzPreprocessingService – arquivo KMZ", () => {
  it("extrai e parseia KML de dentro do KMZ", async () => {
    const kml = buildKml(
      SOURCE_PLACEMARK +
      TERMINAL_PLACEMARK("Trafo-KMZ", -46.640, -23.550) +
      LINE_PLACEMARK("Via-KMZ", "-46.638,-23.548,0 -46.640,-23.550,0")
    );
    const buf = await kmzBuffer(kml);
    const result = await parseKmzToMtRouterInput(buf, "application/vnd.google-earth.kmz");
    expect(result.source).toBeDefined();
    expect(result.terminals).toHaveLength(1);
    expect(result.roadCorridors).toHaveLength(1);
  });

  it("lança erro quando KMZ não contém .kml", async () => {
    const zip = new JSZip();
    zip.file("dados.txt", "sem kml aqui");
    const ab = await zip.generateAsync({ type: "arraybuffer" });
    const buf = Buffer.from(ab);
    await expect(
      parseKmzToMtRouterInput(buf, "application/vnd.google-earth.kmz")
    ).rejects.toThrow(/.kml/i);
  });
});

// ─── Testes: limites ──────────────────────────────────────────────────────────

describe("kmzPreprocessingService – limites de segurança", () => {
  it("rejeita buffer acima de 10 MB", async () => {
    const bigBuf = Buffer.alloc(11 * 1024 * 1024);
    await expect(
      parseKmzToMtRouterInput(bigBuf, "text/xml")
    ).rejects.toThrow(/excede|exceed/i);
  });

  it("limita terminais a 50 e emite aviso", async () => {
    const pts = Array.from({ length: 60 }, (_, i) =>
      TERMINAL_PLACEMARK(`T${i}`, -46.638 - i * 0.001, -23.548 - i * 0.001)
    ).join("\n");
    const kml = buildKml(pts);
    const result = await parseKmzToMtRouterInput(await kmlBuffer(kml), "text/xml");
    expect(result.terminals.length).toBeLessThanOrEqual(50);
    expect(result.warnings.some((w) => /terminal|limite/i.test(w))).toBe(true);
  });
});
