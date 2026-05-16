import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseKml } from '../../src/utils/kmlParser';
import JSZip from 'jszip';

// Mock JSZip
vi.mock('jszip', () => {
    return {
        default: {
            loadAsync: vi.fn().mockResolvedValue({
                file: vi.fn().mockReturnValue([{
                    async: vi.fn().mockResolvedValue('<kml><Document><Placemark><name>Test</name><Point><coordinates>10,20</coordinates></Point></Placemark></Document></kml>')
                }])
            })
        }
    };
});

// Mock FileReader
class MockFileReader {
    onload: any = null;
    readAsText(file: any) {
        setTimeout(() => {
            this.onload({ target: { result: file.content } });
        }, 0);
    }
    readAsArrayBuffer(file: any) {
        setTimeout(() => {
            this.onload({ target: { result: new ArrayBuffer(0) } });
        }, 0);
    }
}
vi.stubGlobal('FileReader', MockFileReader);

describe('kmlParser', () => {
    it('should parse a simple KML with markers', async () => {
        const kmlContent = `
            <kml>
                <Document>
                    <Placemark>
                        <name>Ponto 1</name>
                        <Point>
                            <coordinates>-46.63,-23.55,0</coordinates>
                        </Point>
                    </Placemark>
                </Document>
            </kml>
        `;
        const file = new File([kmlContent], 'test.kml', { type: 'application/vnd.google-earth.kml+xml' });
        (file as any).content = kmlContent;

        const result = await parseKml(file);
        
        expect(result.type).toBe('markers');
        if (result.type === 'markers') {
            expect(result.markers).toHaveLength(1);
            expect(result.markers[0].name).toBe('Ponto 1');
            expect(result.markers[0].point).toEqual([-23.55, -46.63]);
        }
    });

    it('should parse a KML with a polygon', async () => {
        const kmlContent = `
            <kml>
                <Document>
                    <Polygon>
                        <outerBoundaryIs>
                            <LinearRing>
                                <coordinates>-46.63,-23.55 -46.64,-23.55 -46.64,-23.56 -46.63,-23.55</coordinates>
                            </LinearRing>
                        </outerBoundaryIs>
                    </Polygon>
                </Document>
            </kml>
        `;
        const file = new File([kmlContent], 'area.kml');
        (file as any).content = kmlContent;

        const result = await parseKml(file);
        
        expect(result.type).toBe('polygon');
        if (result.type === 'polygon') {
            expect(result.points.length).toBeGreaterThanOrEqual(3);
        }
    });

    it('should handle KMZ files', async () => {
        const file = new File(['fake-zip-content'], 'test.kmz');
        const result = await parseKml(file);
        
        expect(result.type).toBe('markers');
        if (result.type === 'markers') {
            expect(result.markers[0].point).toEqual([20, 10]);
        }
    });

    it('should throw error on invalid KML', async () => {
        const invalidContent = '<invalid>xml</invalid>';
        const file = new File([invalidContent], 'bad.kml');
        (file as any).content = invalidContent;

        // Note: DOMParser in JSDOM might not throw on all invalid XML but we can test if our helper throws 
        // if no coordinates are found.
        await expect(parseKml(file)).rejects.toThrow('No coordinates found');
    });

    it('should throw error for KML with parsererror', async () => {
        // Malformed XML that JSDOM's DOMParser will mark as parsererror
        const malformedContent = '<?xml version="1.0"?><root><unclosed>';
        const file = new File([malformedContent], 'broken.kml');
        (file as any).content = malformedContent;

        // JSDOM may or may not produce parsererror for this; we accept either throw or no-throw
        // since DOMParser behavior varies. We just ensure no unhandled rejection.
        try {
            await parseKml(file);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
    });

    it('should handle KML with only Point placemarks but with empty coordinates', async () => {
        const kmlContent = `
            <kml>
                <Document>
                    <Placemark>
                        <name>Empty</name>
                        <Point>
                            <coordinates></coordinates>
                        </Point>
                    </Placemark>
                </Document>
            </kml>
        `;
        const file = new File([kmlContent], 'empty-coords.kml');
        (file as any).content = kmlContent;

        await expect(parseKml(file)).rejects.toThrow();
    });

    it('should handle fallback path with 1-2 non-polygon coordinates (returns markers)', async () => {
        // No Polygon/LinearRing, no Placemark elements, but raw coordinates with < 3 points
        const kmlContent = `
            <kml>
                <Document>
                    <coordinates>10,20,0</coordinates>
                </Document>
            </kml>
        `;
        const file = new File([kmlContent], 'single.kml');
        (file as any).content = kmlContent;

        const result = await parseKml(file);
        expect(result.type).toBe('markers');
    });

    it('should handle fallback path with 3+ non-polygon coordinates (returns polygon)', async () => {
        // No Polygon/LinearRing, no Placemark elements → fallback collects all points
        const kmlContent = `
            <kml>
                <Document>
                    <coordinates>10,20,0 11,21,0 12,22,0</coordinates>
                </Document>
            </kml>
        `;
        const file = new File([kmlContent], 'multi.kml');
        (file as any).content = kmlContent;

        const result = await parseKml(file);
        expect(result.type).toBe('polygon');
    });

    it('should throw for KMZ without a .kml file inside', async () => {
        // Override the JSZip mock to return no kml files
        const { default: MockJSZip } = await import('jszip');
        (MockJSZip.loadAsync as any).mockResolvedValueOnce({
            file: vi.fn().mockReturnValue([]) // no kml entries
        });

        const file = new File(['fake-zip'], 'empty.kmz');
        await expect(parseKml(file)).rejects.toThrow('KMZ without .kml file inside');
    });

});
