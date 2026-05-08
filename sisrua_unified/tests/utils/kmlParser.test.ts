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
        await expect(parseKml(file)).rejects.toThrow('Nenhuma coordenada encontrada no KML/KMZ.');
        });
        });

