import { vi } from "vitest";
import ExcelJS from "exceljs";
import { Transform } from "stream";
import {
  parseBatchCsv,
  parseBatchExcel,
  parseBatchFile,
} from "../services/batchService";

describe("BatchService", () => {
  describe("parseBatchCsv", () => {
    it("should parse valid CSV with all required columns", async () => {
      const csvContent =
        "name,lat,lon,radius,mode\n" +
        "Location1,-23.5505,-46.6333,500,circle\n" +
        "Location2,-23.5618,-46.6565,300,polygon";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        line: 2,
        row: {
          name: "Location1",
          lat: "-23.5505",
          lon: "-46.6333",
          radius: "500",
          mode: "circle",
        },
      });
      expect(results[1]).toEqual({
        line: 3,
        row: {
          name: "Location2",
          lat: "-23.5618",
          lon: "-46.6565",
          radius: "300",
          mode: "polygon",
        },
      });
    });

    it("should trim whitespace from keys and values", async () => {
      const csvContent =
        " name , lat , lon , radius , mode \n" +
        " Test Location , -23.5505 , -46.6333 , 500 , circle ";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].row.name).toBe("Test Location");
      expect(results[0].row.lat).toBe("-23.5505");
      expect(results[0].row.mode).toBe("circle");
    });

    it("should track line numbers correctly", async () => {
      const csvContent =
        "name,lat,lon,radius,mode\n" +
        "First,-23.5505,-46.6333,500,circle\n" +
        "Second,-23.5618,-46.6565,300,circle\n" +
        "Third,-23.5873,-46.6573,1000,circle";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results[0].line).toBe(2);
      expect(results[1].line).toBe(3);
      expect(results[2].line).toBe(4);
    });

    it("should handle empty CSV gracefully", async () => {
      const csvContent = "name,lat,lon,radius,mode\n";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(0);
    });

    it("should return string values for numeric fields", async () => {
      const csvContent =
        "name,lat,lon,radius,mode\n" + "Test,-23.5505,-46.6333,1500,circle";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      // parseBatchCsv returns raw strings; validation happens in the API layer
      expect(results[0].row.lat).toBe("-23.5505");
      expect(results[0].row.lon).toBe("-46.6333");
      expect(results[0].row.radius).toBe("1500");
      expect(typeof results[0].row.lat).toBe("string");
      expect(typeof results[0].row.lon).toBe("string");
      expect(typeof results[0].row.radius).toBe("string");
    });

    it("should handle different mode values", async () => {
      const csvContent =
        "name,lat,lon,radius,mode\n" +
        "Circle,-23.5505,-46.6333,500,circle\n" +
        "Polygon,-23.5618,-46.6565,300,polygon\n" +
        "BBox,-23.5873,-46.6573,1000,bbox";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results[0].row.mode).toBe("circle");
      expect(results[1].row.mode).toBe("polygon");
      expect(results[2].row.mode).toBe("bbox");
    });

    it("should skip empty rows", async () => {
      const csvContent =
        "name,lat,lon,radius,mode\n" +
        "Location1,-23.5505,-46.6333,500,circle\n" +
        ",,,,\n" +
        "Location2,-23.5618,-46.6565,300,circle";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(2);
      expect(results[0].row.name).toBe("Location1");
      expect(results[1].row.name).toBe("Location2");
    });

    it("should handle partial row data", async () => {
      const csvContent =
        "name,lat,lon,radius,mode\n" + "PartialData,-23.5505,-46.6333,,circle";

      const buffer = Buffer.from(csvContent);
      const results = await parseBatchCsv(buffer);

      expect(results).toHaveLength(1);
      expect(results[0].row.name).toBe("PartialData");
      // Empty CSV fields become empty strings, not undefined
      expect(results[0].row.radius).toBe("");
    });

    it("should reject on CSV parse error", async () => {
      vi.resetModules();
      vi.doMock("csv-parser", () => ({
        default: () => {
          const t = new Transform({
            transform(
              _chunk: Buffer,
              _encoding: string,
              callback: (err?: Error) => void,
            ) {
              callback(new Error("CSV parse error"));
            },
          });
          return t;
        },
      }));
      const { parseBatchCsv: freshParse } =
        await import("../services/batchService");
      await expect(freshParse(Buffer.from("name,lat\n1,2"))).rejects.toThrow(
        "CSV parse error",
      );
      vi.resetModules();
    });
  });

  describe("parseBatchExcel", () => {
    async function makeXlsxBuffer(
      rows: Array<Record<string, string>>,
    ): Promise<Buffer> {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Sheet1");
      const headers =
        rows.length > 0
          ? Object.keys(rows[0] ?? {})
          : ["name", "lat", "lon", "radius", "mode"];

      ws.addRow(headers);
      for (const row of rows) {
        ws.addRow(headers.map((h) => row[h] ?? ""));
      }

      const buf = await wb.xlsx.writeBuffer();
      return Buffer.from(buf);
    }

    it("should parse Excel buffer with data rows", async () => {
      const buf = await makeXlsxBuffer([
        {
          name: "Loc1",
          lat: "-23.5505",
          lon: "-46.6333",
          radius: "500",
          mode: "circle",
        },
      ]);
      const results = await parseBatchExcel(buf);
      expect(results).toHaveLength(1);
      expect(results[0].line).toBe(2);
      expect(results[0].row.name).toBe("Loc1");
    });

    it("should return empty array for Excel with no data rows", async () => {
      const buf = await makeXlsxBuffer([]);
      const results = await parseBatchExcel(buf);
      expect(results).toHaveLength(0);
    });

    it("should assign correct line numbers (starting at 2)", async () => {
      const buf = await makeXlsxBuffer([
        {
          name: "A",
          lat: "-23.1",
          lon: "-46.1",
          radius: "100",
          mode: "circle",
        },
        {
          name: "B",
          lat: "-23.2",
          lon: "-46.2",
          radius: "200",
          mode: "polygon",
        },
      ]);
      const results = await parseBatchExcel(buf);
      expect(results[0].line).toBe(2);
      expect(results[1].line).toBe(3);
    });
  });

  describe("parseBatchFile", () => {
    async function makeXlsxBuffer(
      rows: Array<Record<string, string>>,
    ): Promise<Buffer> {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Sheet1");
      const headers =
        rows.length > 0
          ? Object.keys(rows[0] ?? {})
          : ["name", "lat", "lon", "radius", "mode"];

      ws.addRow(headers);
      for (const row of rows) {
        ws.addRow(headers.map((h) => row[h] ?? ""));
      }

      const buf = await wb.xlsx.writeBuffer();
      return Buffer.from(buf);
    }

    it("should route text/csv to parseBatchCsv", async () => {
      const csvContent =
        "name,lat,lon,radius,mode\nLoc,-23.5505,-46.6333,500,circle";
      const results = await parseBatchFile(Buffer.from(csvContent), "text/csv");
      expect(results).toHaveLength(1);
      expect(results[0].row.name).toBe("Loc");
    });

    it("should route xlsx mimetype to parseBatchExcel", async () => {
      const buf = await makeXlsxBuffer([
        {
          name: "Loc",
          lat: "-23.5505",
          lon: "-46.6333",
          radius: "500",
          mode: "circle",
        },
      ]);
      const results = await parseBatchFile(
        buf,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(results).toHaveLength(1);
    });

    it("should route xlsm mimetype to parseBatchExcel", async () => {
      const buf = await makeXlsxBuffer([
        {
          name: "Loc",
          lat: "-23.5505",
          lon: "-46.6333",
          radius: "500",
          mode: "circle",
        },
      ]);
      const results = await parseBatchFile(
        buf,
        "application/vnd.ms-excel.sheet.macroEnabled.12",
      );
      expect(results).toHaveLength(1);
    });

    it("should route xls mimetype to parseBatchExcel", async () => {
      const buf = await makeXlsxBuffer([
        {
          name: "Loc",
          lat: "-23.5505",
          lon: "-46.6333",
          radius: "500",
          mode: "circle",
        },
      ]);
      const results = await parseBatchFile(buf, "application/vnd.ms-excel");
      expect(results).toHaveLength(1);
    });

    it("should fallback to parseBatchExcel for unknown mimetype (valid xlsx buf)", async () => {
      const buf = await makeXlsxBuffer([
        {
          name: "Loc",
          lat: "-23.5505",
          lon: "-46.6333",
          radius: "500",
          mode: "circle",
        },
      ]);
      const results = await parseBatchFile(buf, "application/octet-stream");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should fallback to parseBatchCsv when Excel fails for unknown mimetype", async () => {
      // Pass a valid CSV buffer with unknown mimetype
      // parseBatchExcel will fail on non-xlsx data → fallback to parseBatchCsv
      const csvContent =
        "name,lat,lon,radius,mode\nLoc,-23.5505,-46.6333,500,circle";
      const results = await parseBatchFile(
        Buffer.from(csvContent),
        "application/octet-stream",
      );
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
