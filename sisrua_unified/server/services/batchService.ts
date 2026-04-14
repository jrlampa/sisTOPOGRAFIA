import csvParser from 'csv-parser';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';

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
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        
        // Map common synonyms for coordinate headers
        let mappedKey = trimmedKey;
        if (['latitude', 'lat', 'y'].includes(trimmedKey)) mappedKey = 'lat';
        if (['longitude', 'lon', 'lng', 'x'].includes(trimmedKey)) mappedKey = 'lon';
        if (['nome', 'label', 'id'].includes(trimmedKey)) mappedKey = 'name';
        if (['raio', 'distancia'].includes(trimmedKey)) mappedKey = 'radius';

        normalized[mappedKey as keyof RawBatchRow] = typeof trimmedValue === 'string'
            ? trimmedValue
            : trimmedValue ? String(trimmedValue) : undefined;
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

const parseBatchExcel = (buffer: Buffer): ParsedBatchRow[] => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON with headers
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    
    return rawData.map((data, index) => ({
        line: index + 2, // Excel rows start at 1, header is 1
        row: normalizeRow(data)
    }));
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
        return parseBatchExcel(buffer);
    } catch {
        // Last resort: try CSV
        return parseBatchCsv(buffer);
    }
};

export type { RawBatchRow, ParsedBatchRow };
export { parseBatchCsv, parseBatchExcel, parseBatchFile };

