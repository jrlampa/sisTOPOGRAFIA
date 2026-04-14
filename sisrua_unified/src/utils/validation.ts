/**
 * Frontend input validation using Zod.
 * Ensures data integrity before sending to backend.
 */
import { z } from "zod";

export type InlineValidationState = "default" | "success" | "error";

export type InlineValidationResult = {
  state: InlineValidationState;
  message: string;
  isValid: boolean;
};

const LAT_LNG_INPUT_REGEX = /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/;
const UTM_INPUT_REGEX = /^\d{2}[C-HJ-NP-X]\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/i;
const BATCH_FILE_EXTENSIONS = new Set(["csv", "xlsx", "xlsm"]);

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().optional(),
});

export const RadiusSchema = z.number().min(10).max(50000).int();

export const PolygonSchema = z.array(LatLngSchema).max(1000);

export const LayerConfigSchema = z.record(z.string(), z.boolean());

export const ProjectionSchema = z.enum(["local", "utm"]);

export const ContourRenderModeSchema = z.enum(["spline", "polyline"]);

export const SelectionModeSchema = z.enum(["circle", "polygon", "measure"]);

export const DxfExportSchema = z.object({
  center: LatLngSchema,
  radius: RadiusSchema,
  selectionMode: SelectionModeSchema,
  polygon: z.array(LatLngSchema).default([]),
  layers: LayerConfigSchema,
  projection: ProjectionSchema.default("utm"),
  contourRenderMode: ContourRenderModeSchema.default("spline"),
});

export const AppSettingsSchema = z.object({
  enableAI: z.boolean().default(true),
  simplificationLevel: z.enum(["low", "medium", "high"]).default("low"),
  orthogonalize: z.boolean().default(true),
  contourRenderMode: ContourRenderModeSchema.default("spline"),
  projection: ProjectionSchema.default("utm"),
  theme: z.enum(["dark", "light"]).default("dark"),
  mapProvider: z.enum(["vector", "satellite"]).default("vector"),
  contourInterval: z.number().min(1).max(100).int().default(5),
  projectType: z.enum(["ramais", "clandestino"]).default("ramais"),
  btNetworkScenario: z
    .enum(["asis", "projeto", "proj1", "proj2"])
    .default("asis"),
  btEditorMode: z
    .enum(["none", "add-pole", "add-edge", "add-transformer", "move-pole"])
    .default("none"),
  btTransformerCalculationMode: z
    .enum(["automatic", "manual"])
    .default("automatic"),
  clandestinoAreaM2: z.number().nonnegative().int().default(0),
});

export function parseAndValidateCoordinates(
  input: string,
): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  const latLngMatch = trimmed.match(LAT_LNG_INPUT_REGEX);

  if (!latLngMatch) {
    return null;
  }

  const lat = parseFloat(latLngMatch[1]);
  const lng = parseFloat(latLngMatch[2]);

  try {
    LatLngSchema.parse({ lat, lng });
    return { lat, lng };
  } catch {
    return null;
  }
}

export function isCoordinateInputSyntaxValid(input: string): boolean {
  const trimmed = input.trim();

  if (!trimmed) {
    return false;
  }

  return (
    Boolean(parseAndValidateCoordinates(trimmed)) ||
    UTM_INPUT_REGEX.test(trimmed)
  );
}

export function getCoordinateInputFeedback(
  input: string,
): InlineValidationResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      state: "default",
      message:
        "Use latitude/longitude ou UTM para inserir o poste com precisão.",
      isValid: false,
    };
  }

  if (parseAndValidateCoordinates(trimmed)) {
    return {
      state: "success",
      message:
        "Coordenadas geográficas válidas. O poste será inserido no ponto informado.",
      isValid: true,
    };
  }

  if (UTM_INPUT_REGEX.test(trimmed)) {
    return {
      state: "success",
      message:
        "Formato UTM reconhecido. O backend converterá as coordenadas antes da inserção.",
      isValid: true,
    };
  }

  if (LAT_LNG_INPUT_REGEX.test(trimmed)) {
    return {
      state: "error",
      message:
        "Latitude deve ficar entre -90 e 90 e longitude entre -180 e 180.",
      isValid: false,
    };
  }

  return {
    state: "error",
    message:
      'Formato inválido. Use "-22.9068 -43.1729" ou "23K 635806 7462003".',
    isValid: false,
  };
}

export function getSearchQueryFeedback(query: string): InlineValidationResult {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      state: "default",
      message:
        "Digite cidade, endereço ou coordenadas para centralizar a análise.",
      isValid: false,
    };
  }

  if (isCoordinateInputSyntaxValid(trimmed)) {
    return {
      state: "success",
      message:
        "Coordenadas reconhecidas. A centralização pode ser executada imediatamente.",
      isValid: true,
    };
  }

  if (trimmed.length < 3) {
    return {
      state: "error",
      message: "Digite ao menos 3 caracteres ou informe coordenadas completas.",
      isValid: false,
    };
  }

  return {
    state: "success",
    message:
      "Consulta válida. A busca será disparada automaticamente enquanto você digita.",
    isValid: true,
  };
}

export function shouldAutoSearch(query: string): boolean {
  const trimmed = query.trim();
  return isCoordinateInputSyntaxValid(trimmed) || trimmed.length >= 3;
}

const SafeFilenameSchema = z
  .string()
  .regex(/^[\w\-.]+$/)
  .max(255);

export function validateFilename(filename: string): boolean {
  return SafeFilenameSchema.safeParse(filename).success;
}

export function validateBatchUploadFile(
  file: Pick<File, "name" | "size"> | null | undefined,
): InlineValidationResult {
  if (!file) {
    return {
      state: "default",
      message:
        "Aceita CSV, XLSX ou XLSM com dados prontos para processamento em lote.",
      isValid: false,
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!BATCH_FILE_EXTENSIONS.has(extension)) {
    return {
      state: "error",
      message: "Formato inválido. Envie apenas arquivos CSV, XLSX ou XLSM.",
      isValid: false,
    };
  }

  if (file.size <= 0) {
    return {
      state: "error",
      message: "O arquivo está vazio. Selecione uma planilha com conteúdo.",
      isValid: false,
    };
  }

  return {
    state: "success",
    message: `Arquivo "${file.name}" pronto para envio.`,
    isValid: true,
  };
}

export function getPositiveIntegerFeedback(
  value: number,
  label = "quantidade",
): InlineValidationResult {
  if (Number.isInteger(value) && value > 0) {
    return {
      state: "success",
      message: `${label.charAt(0).toUpperCase() + label.slice(1)} válida para confirmar a ação.`,
      isValid: true,
    };
  }

  return {
    state: "error",
    message: `Informe ${label} maior que zero para continuar.`,
    isValid: false,
  };
}

export function validateDxfExportInputs(
  center: unknown,
  radius: unknown,
  selectionMode: unknown,
  polygon: unknown,
  layers: unknown,
): boolean {
  try {
    LatLngSchema.parse(center);
    RadiusSchema.parse(radius);
    SelectionModeSchema.parse(selectionMode);

    if (selectionMode === "polygon") {
      PolygonSchema.min(3).parse(polygon);
    } else {
      PolygonSchema.parse(polygon);
    }

    LayerConfigSchema.parse(layers);
    return true;
  } catch {
    return false;
  }
}

export function validateAppSettings(
  settings: unknown,
): settings is z.infer<typeof AppSettingsSchema> {
  return AppSettingsSchema.safeParse(settings).success;
}
