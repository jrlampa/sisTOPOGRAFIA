import csvParser from 'csv-parser';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';

type RawBatchRow = {
    name?: string;
    lat?: string;
    lon?: string;
    radius?: string;
    mode?: string;
};

type ParsedBatchRow = {
    line: number;
    row: RawBatchRow;
};

const normalizeRow = (row: Record<string, unknown>): RawBatchRow => {
    const normalized: RawBatchRow = {};
    Object.entries(row).forEach(([key, value]) => {
        const trimmedKey = key.trim().toLowerCase();
        let normalizedValue = value;
        
        // Handle ExcelJS cell objects if necessary (though usually it gives primitive values)
        if (value && typeof value === 'object' && 'result' in value) {
            normalizedValue = (value as any).result;
        }

        const trimmedValue = typeof normalizedValue === 'string' ? normalizedValue.trim() : normalizedValue;
        
        // Map common synonyms for coordinate headers
        let mappedKey = trimmedKey;
        if (['latitude', 'lat', 'y'].includes(trimmedKey)) mappedKey = 'lat';
        if (['longitude', 'lon', 'lng', 'x'].includes(trimmedKey)) mappedKey = 'lon';
        if (['nome', 'label', 'id'].includes(trimmedKey)) mappedKey = 'name';
        if (['raio', 'distancia'].includes(trimmedKey)) mappedKey = 'radius';

        normalized[mappedKey as keyof RawBatchRow] = typeof trimmedValue === 'string'
            ? trimmedValue
            : (trimmedValue !== null && trimmedValue !== undefined) ? String(trimmedValue) : undefined;
    });

    return normalized;
};

const parseBatchCsv = (buffer: Buffer): Promise<ParsedBatchRow[]> =>
    new Promise((resolve, reject) => {
        const rows: ParsedBatchRow[] = [];
        let currentLine = 1;

        const stream = Readable.from(buffer);
        stream
            .pipe(csvParser())
            .on('data', (data: Record<string, unknown>) => {
                currentLine += 1;
                const row = normalizeRow(data);
                const hasValues = Object.values(row).some((value) => value && value.length > 0);
                if (hasValues) {
                    rows.push({ line: currentLine, row });
                }
            })
            .on('error', (error) => reject(error))
            .on('end', () => resolve(rows));
    });

const parseBatchExcel = async (buffer: Buffer): Promise<ParsedBatchRow[]> => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    const worksheet = workbook.getWorksheet(1); // Get first sheet
    if (!worksheet) return [];

    const rows: ParsedBatchRow[] = [];
    
    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = cell.text ? cell.text.trim() : `column_${colNumber}`;
    });

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rowData: Record<string, unknown> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
                rowData[header] = cell.value;
            }
        });

        const normalized = normalizeRow(rowData);
        const hasValues = Object.values(normalized).some((value) => value && value.length > 0);
        if (hasValues) {
            rows.push({
                line: rowNumber,
                row: normalized
            });
        }
    });

    return rows;
};

/**
 * Universal parser for batch files (CSV or Excel)
 */
const parseBatchFile = async (buffer: Buffer, mimetype: string): Promise<ParsedBatchRow[]> => {
    if (mimetype === 'text/csv') {
        return parseBatchCsv(buffer);
    }
    
    // Check for Excel mimetypes
    if (
        mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
        mimetype === 'application/vnd.ms-excel.sheet.macroEnabled.12' || // .xlsm
        mimetype === 'application/vnd.ms-excel' // .xls (older)
    ) {
        return parseBatchExcel(buffer);
    }

    // Attempt Excel as fallback if mimetype is generic
    try {
        return await parseBatchExcel(buffer);
    } catch {
        // Last resort: try CSV
        return parseBatchCsv(buffer);
    }
};

export type { RawBatchRow, ParsedBatchRow };
export { parseBatchCsv, parseBatchExcel, parseBatchFile };

