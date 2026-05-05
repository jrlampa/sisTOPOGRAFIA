/**
 * BT Bulk Import Routes
 *
 * Provides backend parsing of Excel files for bulk ramal import.
 * Moves ExcelJS dependency from frontend (browser bundle) to backend (Node.js).
 * Eliminates `eval` warnings in production build by using only backend parser.
 *
 * Endpoints:
 *   POST /api/bt/parse-bulk-excel  — Parse uploaded Excel → tab-delimited text
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { parseBatchExcel } from "../services/batchService.js";
import { logger } from "../utils/logger.js";

const router = Router();

// In-memory upload (Excel files are typically < 1MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Schema for Excel parsing response
const excelParseResponseSchema = z.object({
  success: z.boolean(),
  data: z.string().optional(), // Tab-delimited text
  error: z.string().optional(),
});

/**
 * POST /api/bt/parse-bulk-excel
 *
 * Parse uploaded Excel file and return tab-delimited text for bulk import.
 *
 * Request:
 *   multipart/form-data with "file" field
 *   file: .xlsx, .xlsm, or .xlsb
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": "POSTE\tCONDUTOR\t...\nP001\tAL95\t...\nP002\tAL95\t..."
 *   }
 */
router.post(
  "/parse-bulk-excel",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Validate file presence and type
      if (!req.file) {
        logger.warn("BT bulk import: no file uploaded");
        return res.status(400).json({
          success: false,
          error: "Nenhum arquivo enviado. Use o campo 'file'.",
        });
      }

      const { originalname, mimetype, buffer } = req.file;

      // Validate file extension
      const validExtensions = [".xlsx", ".xlsm", ".xlsb"];
      const fileExt = originalname.toLowerCase().slice(-5);
      const isValidExtension = validExtensions.some((ext) =>
        fileExt.endsWith(ext),
      );

      if (!isValidExtension) {
        logger.warn("BT bulk import: invalid file extension", { originalname });
        return res.status(400).json({
          success: false,
          error: "Extensão inválida. Envie .xlsx, .xlsm ou .xlsb.",
        });
      }

      // Parse the Excel file
      const rows = await parseBatchExcel(buffer);

      if (rows.length === 0) {
        logger.warn("BT bulk import: no rows parsed from Excel", {
          originalname,
        });
        return res.status(400).json({
          success: false,
          error: "Nenhuma linha de dados encontrada no arquivo.",
        });
      }

      // Convert parsed rows to tab-delimited text format
      // Row format from batchService: { line: number, row: Record<string, string | undefined> }
      const tabDelimitedText = convertRowsToTabDelimited(rows);

      logger.info("BT bulk import: Excel parsed successfully", {
        filename: originalname,
        rowCount: rows.length,
      });

      return res.status(200).json({
        success: true,
        data: tabDelimitedText,
      });
    } catch (err) {
      logger.error("BT bulk import: parsing error", {
        message: (err as Error).message,
        stack: (err as Error).stack,
      });

      return res.status(500).json({
        success: false,
        error: "Falha ao processar arquivo Excel. Verifique o formato.",
      });
    }
  },
);

/**
 * Convert parsed batch rows to tab-delimited format for bulk import text area.
 *
 * Input: Array of { line: number, row: Record<string, string | undefined> }
 * Output: String with header row + data rows, tab-separated
 *
 * Example output:
 *   POSTE\tCONDUTOR\tKVA
 *   P001\tAL95\t10
 *   P002\tAL95\t5
 */
function convertRowsToTabDelimited(
  rows: Array<{ line: number; row: Record<string, string | undefined> }>,
): string {
  if (rows.length === 0) {
    return "";
  }

  // Extract header from first row's keys
  const firstRow = rows[0].row;
  const headers = Object.keys(firstRow);

  // Build header line
  const headerLine = headers.join("\t");

  // Build data lines
  const dataLines = rows.map((item) =>
    headers.map((key) => item.row[key] || "").join("\t"),
  );

  // Combine header + data
  return [headerLine, ...dataLines].join("\n");
}

export default router;
