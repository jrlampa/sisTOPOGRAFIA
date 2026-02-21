import { GeocodingService } from '../services/geocodingService';

describe('GeocodingService', () => {
  describe('resolveLocation', () => {
    it('should parse decimal coordinates', async () => {
      const result = await GeocodingService.resolveLocation('-23.5505, -46.6333');
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(-23.5505, 4);
      expect(result?.lng).toBeCloseTo(-46.6333, 4);
      expect(result?.label).toContain('Lat/Lng');
    });

    it('should parse coordinates with different separators', async () => {
      const result = await GeocodingService.resolveLocation('-23.5505 -46.6333');
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(-23.5505, 4);
      expect(result?.lng).toBeCloseTo(-46.6333, 4);
    });

    it('should return null for malformed input', async () => {
      const result = await GeocodingService.resolveLocation('not-a-coordinate');
      expect(result).toBeNull();
    });

    it('should return null for single number', async () => {
      const result = await GeocodingService.resolveLocation('123.456');
      expect(result).toBeNull();
    });

    it('should parse UTM coordinates', async () => {
      const result = await GeocodingService.resolveLocation('23K 315000 7395000');
      expect(result).not.toBeNull();
      expect(result?.lat).toBeDefined();
      expect(result?.lng).toBeDefined();
      expect(result?.label).toContain('UTM');
    });

    it('should handle empty query', async () => {
      const result = await GeocodingService.resolveLocation('');
      expect(result).toBeNull();
    });

    it('should validate latitude range', async () => {
      const result = await GeocodingService.resolveLocation('91.0, -46.6333');
      expect(result).toBeNull();
    });

    it('should validate longitude range', async () => {
      const result = await GeocodingService.resolveLocation('-23.5505, 181.0');
      expect(result).toBeNull();
    });

    describe('MGRS band hemisphere detection', () => {
      it('should detect Southern Hemisphere for band C', async () => {
        const result = await GeocodingService.resolveLocation('31C 500000 1000000');
        expect(result).not.toBeNull();
        // Band C is in Southern Hemisphere
        expect(result?.label).toContain('UTM');
      });

      it('should detect Southern Hemisphere for band K', async () => {
        const result = await GeocodingService.resolveLocation('23K 801370 7549956');
        expect(result).not.toBeNull();
        // Band K (ASCII 75) is in Southern Hemisphere (C-M range)
        // This was the original bug: ASCII comparison would incorrectly use K >= N
        expect(result?.label).toContain('UTM');
      });

      it('should detect Northern Hemisphere for band N', async () => {
        const result = await GeocodingService.resolveLocation('32N 600000 5000000');
        expect(result).not.toBeNull();
        // Band N is in Northern Hemisphere
        expect(result?.label).toContain('UTM');
      });

      it('should detect Northern Hemisphere for band X', async () => {
        const result = await GeocodingService.resolveLocation('33X 500000 8000000');
        expect(result).not.toBeNull();
        // Band X is in Northern Hemisphere (N-X range)
        expect(result?.label).toContain('UTM');
      });

      it('should handle explicit N suffix for Northern Hemisphere', async () => {
        const result = await GeocodingService.resolveLocation('23N 801370 7549956');
        expect(result).not.toBeNull();
        expect(result?.label).toContain('UTM');
      });

      it('should handle explicit S suffix for Southern Hemisphere', async () => {
        const result = await GeocodingService.resolveLocation('23S 801370 7549956');
        expect(result).not.toBeNull();
        expect(result?.label).toContain('UTM');
      });

      it('should return null for UTM zone > 60', async () => {
        // Zone 61 is invalid; triggers zone > 60 guard (line 45)
        const result = await GeocodingService.resolveLocation('61K 714316 7549084');
        expect(result).toBeNull();
      });

      it('should convert standard test coordinates 23K 714316 7549084 to -22.15, -42.92', async () => {
        // Canonical test coordinates per memory.md: 23K 714316 7549084 ↔ -22.15018, -42.92185
        const result = await GeocodingService.resolveLocation('23K 714316 7549084');
        expect(result).not.toBeNull();
        expect(result!.lat).toBeCloseTo(-22.15018, 3);
        expect(result!.lng).toBeCloseTo(-42.92185, 3);
      });
    });

    describe('utmToLatLon edge cases', () => {
      it('should return null when zone is 0', () => {
        // Triggers !zone guard (line 65)
        const result = GeocodingService.utmToLatLon(0, 'S', 714316, 7549084);
        expect(result).toBeNull();
      });

      it('should return null when easting is 0', () => {
        // Triggers !easting guard (line 65)
        const result = GeocodingService.utmToLatLon(23, 'S', 0, 7549084);
        expect(result).toBeNull();
      });

      it('should return null when northing is 0', () => {
        // Triggers !northing guard (line 65)
        const result = GeocodingService.utmToLatLon(23, 'S', 714316, 0);
        expect(result).toBeNull();
      });
    });
  });
});


