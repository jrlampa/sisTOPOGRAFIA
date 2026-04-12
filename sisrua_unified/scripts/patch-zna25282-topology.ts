import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

type WorkbookSegment = {
  point: string;
  parent: string;
  lengthMeters: number;
  conductorName: string;
  lado: string;
};

const DEFAULT_WORKBOOK_PATH =
  "C:/Users/jonat/OneDrive - IM3 Brasil/LIGHT/PROJETOS/ZNA25282 - ROBUSTEZ DE BT/ZNA25282 - ROBUSTEZ DE BT_2.xlsx";
const DEFAULT_SRUA_PATH =
  "C:/Users/jonat/OneDrive - IM3 Brasil/LIGHT/PROJETOS/ZNA25282 - ROBUSTEZ DE BT/ZNA25282 - ROBUSTEZ DE BT.srua";

const workbookPath = process.env.WORKBOOK_PATH ?? DEFAULT_WORKBOOK_PATH;
const sruaPath = process.env.SRUA_PATH ?? DEFAULT_SRUA_PATH;
const writeInPlace = (process.env.IN_PLACE ?? "true").toLowerCase() === "true";

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[_.-]/g, "")
    .toUpperCase();

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractPointNumber = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/\d+/);
  return match ? String(Number.parseInt(match[0], 10)) : null;
};

const findSheetName = (sheetNames: string[], prefix: string): string => {
  const key = normalize(prefix);
  const found = sheetNames.find((name) => normalize(name).startsWith(key));
  if (!found) {
    throw new Error(`Sheet starting with '${prefix}' not found.`);
  }
  return found;
};

const readWorkbookSegments = (
  workbookFilePath: string,
): { segments: WorkbookSegment[]; trafoPoint: string | null } => {
  const wb = XLSX.readFile(workbookFilePath, {
    cellDates: false,
    cellNF: false,
    cellFormula: false,
  });
  const geralSheetName = findSheetName(wb.SheetNames, "GERAL");
  const ws = wb.Sheets[geralSheetName];

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });

  const headerRowIndex = rows.findIndex((row) => {
    const keys = row.map((cell) => normalize(cell));
    return (
      keys.includes("PONTO") &&
      keys.includes("TRECHO") &&
      keys.includes("M") &&
      keys.includes("LADO") &&
      keys.includes("CONDUTOR")
    );
  });

  if (headerRowIndex < 0) {
    throw new Error("Could not find GERAL header row for segment extraction.");
  }

  const headers = rows[headerRowIndex].map((h) => normalize(h));
  const pointIdx = headers.findIndex((h) => h === "PONTO");
  const parentIdx = headers.findIndex((h) => h === "TRECHO");
  const lengthIdx = headers.findIndex((h) => h === "M");
  const ladoIdx = headers.findIndex((h) => h === "LADO");
  const condIdx = headers.findIndex((h) => h === "CONDUTOR");

  if (
    pointIdx < 0 ||
    parentIdx < 0 ||
    lengthIdx < 0 ||
    ladoIdx < 0 ||
    condIdx < 0
  ) {
    throw new Error("Required columns not found in GERAL table.");
  }

  const segments: WorkbookSegment[] = [];
  let trafoPoint: string | null = null;

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const pointRaw = toNumber(row[pointIdx]);
    const parentRaw = toNumber(row[parentIdx]);
    if (pointRaw === null || parentRaw === null) {
      continue;
    }

    const point = String(Math.trunc(pointRaw));
    const parent = String(Math.trunc(parentRaw));
    const lado = String(row[ladoIdx] ?? "")
      .trim()
      .toUpperCase();
    const conductorName = String(row[condIdx] ?? "").trim();
    const lengthMeters = toNumber(row[lengthIdx]) ?? 0;

    if (lado === "TRAFO") {
      trafoPoint = point;
    }

    if (parent === "0") {
      continue;
    }

    if (!conductorName) {
      continue;
    }

    segments.push({
      point,
      parent,
      lengthMeters,
      conductorName,
      lado,
    });
  }

  return { segments, trafoPoint };
};

const nextEdgeIdFactory = (existingIds: string[]) => {
  let max = 0;
  for (const id of existingIds) {
    const m = id.match(/E(\d+)/i);
    if (!m) continue;
    max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return () => {
    max += 1;
    return `E${max}`;
  };
};

const main = () => {
  const { segments, trafoPoint } = readWorkbookSegments(workbookPath);

  const raw = fs.readFileSync(sruaPath, "utf8");
  const parsed = JSON.parse(raw);
  const state = parsed.state ?? {};
  const topology = state.btTopology ?? {
    poles: [],
    transformers: [],
    edges: [],
  };

  const pointToPoleId = new Map<string, string>();
  for (const pole of topology.poles ?? []) {
    const point = extractPointNumber(pole.title) ?? extractPointNumber(pole.id);
    if (point) {
      pointToPoleId.set(point, pole.id);
    }
  }

  const oldEdges = topology.edges ?? [];
  const oldByPair = new Map<string, any>();
  for (const edge of oldEdges) {
    const key = `${edge.fromPoleId}|${edge.toPoleId}`;
    oldByPair.set(key, edge);
  }

  const nextEdgeId = nextEdgeIdFactory(
    oldEdges.map((edge: any) => String(edge.id)),
  );
  const skipped: Array<{ point: string; parent: string; reason: string }> = [];
  const patchedEdges: any[] = [];

  for (const segment of segments) {
    const fromPoleId = pointToPoleId.get(segment.point);
    const toPoleId = pointToPoleId.get(segment.parent);

    if (!fromPoleId || !toPoleId) {
      skipped.push({
        point: segment.point,
        parent: segment.parent,
        reason: !fromPoleId
          ? `Point ${segment.point} not found in SRUA poles`
          : `Parent ${segment.parent} not found in SRUA poles`,
      });
      continue;
    }

    const directKey = `${fromPoleId}|${toPoleId}`;
    const reverseKey = `${toPoleId}|${fromPoleId}`;
    const oldEdge = oldByPair.get(directKey) ?? oldByPair.get(reverseKey);

    const conductorId =
      oldEdge?.conductors?.[0]?.id ??
      `C${Date.now()}${Math.floor(Math.random() * 100000)}`;

    patchedEdges.push({
      id: oldEdge?.id ?? nextEdgeId(),
      fromPoleId,
      toPoleId,
      lengthMeters:
        typeof oldEdge?.lengthMeters === "number"
          ? oldEdge.lengthMeters
          : Number(segment.lengthMeters.toFixed(2)),
      cqtLengthMeters: Number(segment.lengthMeters.toFixed(2)),
      conductors: [
        {
          id: conductorId,
          quantity: 1,
          conductorName: segment.conductorName,
        },
      ],
      replacementFromConductors: oldEdge?.replacementFromConductors ?? [],
      verified: oldEdge?.verified ?? false,
      removeOnExecution: false,
      edgeChangeFlag: "existing",
    });
  }

  const patchedTopology = {
    ...topology,
    edges: patchedEdges,
    transformers: (() => {
      if (!trafoPoint) {
        return topology.transformers ?? [];
      }
      const targetPoleId = pointToPoleId.get(trafoPoint);
      if (!targetPoleId) {
        return topology.transformers ?? [];
      }
      return (topology.transformers ?? []).map(
        (transformer: any, index: number) => {
          if (index !== 0) {
            return transformer;
          }
          const pole = (topology.poles ?? []).find(
            (p: any) => p.id === targetPoleId,
          );
          return {
            ...transformer,
            poleId: targetPoleId,
            lat: pole?.lat ?? transformer.lat,
            lng: pole?.lng ?? transformer.lng,
          };
        },
      );
    })(),
  };

  const patchedState = {
    ...state,
    btTopology: patchedTopology,
  };

  const nextRoot = {
    ...parsed,
    state: patchedState,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${sruaPath}.bak.${timestamp}`;
  fs.copyFileSync(sruaPath, backupPath);

  const outputPath = writeInPlace
    ? sruaPath
    : path.resolve(process.cwd(), "tmp-zna25282-patched.srua");

  fs.writeFileSync(outputPath, JSON.stringify(nextRoot, null, 2), "utf8");

  const summary = {
    workbookPath,
    sruaPath,
    outputPath,
    backupPath,
    workbookSegments: segments.length,
    patchedEdges: patchedEdges.length,
    skippedSegments: skipped.length,
    trafoPointFromWorkbook: trafoPoint,
  };

  console.log(
    JSON.stringify({ summary, skippedTop: skipped.slice(0, 30) }, null, 2),
  );
};

main();
