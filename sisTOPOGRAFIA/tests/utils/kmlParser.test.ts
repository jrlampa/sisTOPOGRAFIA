import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseKml } from '../../src/utils/kmlParser';

// Helper to create a File with KML content
const makeKmlFile = (content: string, filename = 'test.kml'): File => {
  return new File([content], filename, { type: 'application/vnd.google-earth.kml+xml' });
};

// Minimal valid KML with a polygon (4 points = 3 unique + close)
const VALID_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>
            -42.92185,-22.15018,0
            -42.91185,-22.15018,0
            -42.91185,-22.16018,0
            -42.92185,-22.16018,0
            -42.92185,-22.15018,0
          </coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>`;

const KML_NO_COORDINATES = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark><name>Sem coordenadas</name></Placemark>
</kml>`;

const KML_EMPTY_COORDINATES = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates></coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>`;

const KML_TOO_FEW_POINTS = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>
            -42.92185,-22.15018,0
            -42.91185,-22.15018,0
          </coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>`;

describe('kmlParser — parseKml', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('analisa KML válido e retorna pontos [lat, lon]', async () => {
    const file = makeKmlFile(VALID_KML);
    const points = await parseKml(file);

    expect(points.length).toBeGreaterThanOrEqual(3);
    // First point: lon=-42.92185, lat=-22.15018 → [lat, lon] = [-22.15018, -42.92185]
    expect(points[0][0]).toBeCloseTo(-22.15018, 4);
    expect(points[0][1]).toBeCloseTo(-42.92185, 4);
  });

  it('rejeita quando não há elemento <coordinates> no KML', async () => {
    const file = makeKmlFile(KML_NO_COORDINATES);
    await expect(parseKml(file)).rejects.toThrow('No coordinates found in KML.');
  });

  it('rejeita quando elemento <coordinates> está vazio', async () => {
    const file = makeKmlFile(KML_EMPTY_COORDINATES);
    await expect(parseKml(file)).rejects.toThrow('Empty coordinates tag.');
  });

  it('rejeita quando há menos de 3 pontos válidos', async () => {
    const file = makeKmlFile(KML_TOO_FEW_POINTS);
    await expect(parseKml(file)).rejects.toThrow('Valid polygon needs at least 3 points.');
  });

  it('rejeita quando FileReader emite erro', async () => {
    const file = makeKmlFile(VALID_KML);

    // Spy on FileReader to simulate a read error
    const origFileReader = globalThis.FileReader;
    const MockFileReader = class {
      onload: ((e: any) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() {
        // Trigger error asynchronously
        setTimeout(() => this.onerror?.(), 0);
      }
    };
    (globalThis as any).FileReader = MockFileReader;

    try {
      await expect(parseKml(file)).rejects.toThrow('Failed to read file.');
    } finally {
      (globalThis as any).FileReader = origFileReader;
    }
  });

  it('filtra pares de coordenadas inválidas (NaN) sem lançar erro', async () => {
    const kmlWithNaN = VALID_KML.replace(
      '-42.92185,-22.15018,0',
      'invalid,coords,0\n            -42.92185,-22.15018,0'
    );
    const file = makeKmlFile(kmlWithNaN);
    // Should still succeed since remaining points provide a valid polygon
    const points = await parseKml(file);
    expect(points.length).toBeGreaterThanOrEqual(3);
  });

  it('rejeita quando o parsing interno do KML lança exceção (lines 47-48)', async () => {
    const file = makeKmlFile(VALID_KML);

    // Patch DOMParser to throw inside the FileReader onload callback
    const origDOMParser = globalThis.DOMParser;
    (globalThis as any).DOMParser = class {
      parseFromString() {
        throw new Error('XML parse error');
      }
    };

    try {
      await expect(parseKml(file)).rejects.toThrow('XML parse error');
    } finally {
      (globalThis as any).DOMParser = origDOMParser;
    }
  });
});
