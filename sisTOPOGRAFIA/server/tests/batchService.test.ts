import { parseBatchCsv } from '../services/batchService';

describe('BatchService', () => {
  describe('parseBatchCsv', () => {
    it('should parse valid CSV with all required columns', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Location1,-23.5505,-46.6333,500,circle\n' +
        'Location2,-23.5618,-46.6565,300,polygon';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        line: 2,
        row: {
          name: 'Location1',
          lat: '-23.5505',
          lon: '-46.6333',
          radius: '500',
          mode: 'circle'
        }
      });
      expect(results[1]).toEqual({
        line: 3,
        row: {
          name: 'Location2',
          lat: '-23.5618',
          lon: '-46.6565',
          radius: '300',
          mode: 'polygon'
        }
      });
    });

    it('should trim whitespace from keys and values', async () => {
      const csvContent = 
        ' name , lat , lon , radius , mode \n' +
        ' Test Location , -23.5505 , -46.6333 , 500 , circle ';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].row.name).toBe('Test Location');
      expect(results[0].row.lat).toBe('-23.5505');
      expect(results[0].row.mode).toBe('circle');
    });

    it('should track line numbers correctly', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'First,-23.5505,-46.6333,500,circle\n' +
        'Second,-23.5618,-46.6565,300,circle\n' +
        'Third,-23.5873,-46.6573,1000,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results[0].line).toBe(2);
      expect(results[1].line).toBe(3);
      expect(results[2].line).toBe(4);
    });

    it('should handle empty CSV gracefully', async () => {
      const csvContent = 'name,lat,lon,radius,mode\n';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(0);
    });

    it('should return string values for numeric fields', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Test,-23.5505,-46.6333,1500,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      // parseBatchCsv returns raw strings; validation happens in the API layer
      expect(results[0].row.lat).toBe('-23.5505');
      expect(results[0].row.lon).toBe('-46.6333');
      expect(results[0].row.radius).toBe('1500');
      expect(typeof results[0].row.lat).toBe('string');
      expect(typeof results[0].row.lon).toBe('string');
      expect(typeof results[0].row.radius).toBe('string');
    });

    it('should handle different mode values', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Circle,-23.5505,-46.6333,500,circle\n' +
        'Polygon,-23.5618,-46.6565,300,polygon\n' +
        'BBox,-23.5873,-46.6573,1000,bbox';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results[0].row.mode).toBe('circle');
      expect(results[1].row.mode).toBe('polygon');
      expect(results[2].row.mode).toBe('bbox');
    });

    it('should skip empty rows', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'Location1,-23.5505,-46.6333,500,circle\n' +
        ',,,,\n' +
        'Location2,-23.5618,-46.6565,300,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(2);
      expect(results[0].row.name).toBe('Location1');
      expect(results[1].row.name).toBe('Location2');
    });

    it('should handle partial row data', async () => {
      const csvContent = 
        'name,lat,lon,radius,mode\n' +
        'PartialData,-23.5505,-46.6333,,circle';

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].row.name).toBe('PartialData');
      // Empty CSV fields become empty strings, not undefined
      expect(results[0].row.radius).toBe('');
    });

    it('should reject the promise on stream error', async () => {
      // Trigger the .on('error', reject) handler (line 46 of batchService.ts).
      // Use isolateModules + doMock + require to load a batchService with a csv-parser
      // that emits an error event on the piped transform stream.
      let isolatedParseFn: typeof parseBatchCsv | undefined;

      jest.isolateModules(() => {
        // jest.doMock is designed for dynamic per-test mocking inside isolateModules
        jest.doMock('csv-parser', () => {
          const { Transform } = require('stream');
          return jest.fn(() => {
            return new Transform({
              objectMode: true,
              transform(_chunk: any, _enc: any, cb: any) {
                // Call cb with an error to trigger the stream's 'error' event
                cb(new Error('CSV stream failure'));
              }
            });
          });
        });
        const mod = require('../services/batchService');
        isolatedParseFn = mod.parseBatchCsv;
      });

      const buffer = Buffer.from('name,lat,lon,radius,mode\nData,-23.5,-46.6,500,circle');
      await expect(isolatedParseFn!(buffer)).rejects.toThrow('CSV stream failure');
    });
  });
});
