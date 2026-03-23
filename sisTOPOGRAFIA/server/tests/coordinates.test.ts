import { LatLonCoordinate, UTMCoordinate } from '../domain/coordinates';

describe('LatLonCoordinate', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('construction - valid', () => {
        it('creates with valid lat/lon', () => {
            const c = new LatLonCoordinate(0, 0);
            expect(c.latitude).toBe(0);
            expect(c.longitude).toBe(0);
        });
        it('accepts lat=90 boundary', () => {
            expect(() => new LatLonCoordinate(90, 0)).not.toThrow();
        });
        it('accepts lat=-90 boundary', () => {
            expect(() => new LatLonCoordinate(-90, 0)).not.toThrow();
        });
        it('accepts lon=180 boundary', () => {
            expect(() => new LatLonCoordinate(0, 180)).not.toThrow();
        });
        it('accepts lon=-180 boundary', () => {
            expect(() => new LatLonCoordinate(0, -180)).not.toThrow();
        });
    });

    describe('construction - invalid', () => {
        it('throws on lat > 90', () => {
            expect(() => new LatLonCoordinate(90.001, 0)).toThrow('Invalid latitude');
        });
        it('throws on lat < -90', () => {
            expect(() => new LatLonCoordinate(-90.001, 0)).toThrow('Invalid latitude');
        });
        it('throws on lon > 180', () => {
            expect(() => new LatLonCoordinate(0, 180.001)).toThrow('Invalid longitude');
        });
        it('throws on lon < -180', () => {
            expect(() => new LatLonCoordinate(0, -180.001)).toThrow('Invalid longitude');
        });
    });

    describe('equals()', () => {
        it('returns true for same coordinates', () => {
            const a = new LatLonCoordinate(10.0, 20.0);
            const b = new LatLonCoordinate(10.0, 20.0);
            expect(a.equals(b)).toBe(true);
        });
        it('returns true within 0.00001 tolerance', () => {
            const a = new LatLonCoordinate(10.0, 20.0);
            const b = new LatLonCoordinate(10.000009, 20.000009);
            expect(a.equals(b)).toBe(true);
        });
        it('returns false for different lat', () => {
            const a = new LatLonCoordinate(10.0, 20.0);
            const b = new LatLonCoordinate(11.0, 20.0);
            expect(a.equals(b)).toBe(false);
        });
        it('returns false for different lon', () => {
            const a = new LatLonCoordinate(10.0, 20.0);
            const b = new LatLonCoordinate(10.0, 21.0);
            expect(a.equals(b)).toBe(false);
        });
    });
});

describe('UTMCoordinate', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('construction - valid zones', () => {
        it('accepts zone "23K"', () => {
            expect(() => new UTMCoordinate('23K', 714316, 7549084)).not.toThrow();
        });
        it('accepts zone "1C"', () => {
            expect(() => new UTMCoordinate('1C', 100000, 100000)).not.toThrow();
        });
        it('accepts zone "60N"', () => {
            expect(() => new UTMCoordinate('60N', 100000, 100000)).not.toThrow();
        });
        it('stores zone/easting/northing', () => {
            const c = new UTMCoordinate('23K', 714316, 7549084);
            expect(c.zone).toBe('23K');
            expect(c.easting).toBe(714316);
            expect(c.northing).toBe(7549084);
        });
    });

    describe('construction - invalid zone', () => {
        it('throws on zone "ABC" (no digit prefix)', () => {
            expect(() => new UTMCoordinate('ABC', 100000, 100000)).toThrow('Invalid UTM Zone');
        });
        it('throws on zone "999Z" (3-digit number)', () => {
            expect(() => new UTMCoordinate('999Z', 100000, 100000)).toThrow('Invalid UTM Zone');
        });
        it('throws on empty zone ""', () => {
            expect(() => new UTMCoordinate('', 100000, 100000)).toThrow('Invalid UTM Zone');
        });
        it('throws on lowercase zone "23k"', () => {
            expect(() => new UTMCoordinate('23k', 100000, 100000)).toThrow('Invalid UTM Zone');
        });
    });

    describe('construction - invalid easting/northing', () => {
        it('throws on easting <= 0', () => {
            expect(() => new UTMCoordinate('23K', 0, 100000)).toThrow('Invalid easting');
        });
        it('throws on negative easting', () => {
            expect(() => new UTMCoordinate('23K', -1, 100000)).toThrow('Invalid easting');
        });
        it('throws on northing <= 0', () => {
            expect(() => new UTMCoordinate('23K', 100000, 0)).toThrow('Invalid northing');
        });
        it('throws on negative northing', () => {
            expect(() => new UTMCoordinate('23K', 100000, -1)).toThrow('Invalid northing');
        });
    });

    describe('equals()', () => {
        it('returns true for same coordinates', () => {
            const a = new UTMCoordinate('23K', 714316, 7549084);
            const b = new UTMCoordinate('23K', 714316, 7549084);
            expect(a.equals(b)).toBe(true);
        });
        it('returns false for different zone', () => {
            const a = new UTMCoordinate('23K', 714316, 7549084);
            const b = new UTMCoordinate('24K', 714316, 7549084);
            expect(a.equals(b)).toBe(false);
        });
        it('returns false for different easting', () => {
            const a = new UTMCoordinate('23K', 714316, 7549084);
            const b = new UTMCoordinate('23K', 714317, 7549084);
            expect(a.equals(b)).toBe(false);
        });
        it('returns false for different northing', () => {
            const a = new UTMCoordinate('23K', 714316, 7549084);
            const b = new UTMCoordinate('23K', 714316, 7549085);
            expect(a.equals(b)).toBe(false);
        });
    });
});
