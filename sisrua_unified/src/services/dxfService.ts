import { API_BASE_URL } from "../config/api";
import { buildApiHeaders } from "./apiClient";
import Logger from "../utils/logger";
import { trackPerformance } from "../utils/analytics";

const API_URL = API_BASE_URL;

type DxfQueueResponse = {
  status: "queued";
  jobId: string | number;
};

type DxfCachedResponse = {
  status: "success";
  url: string;
  message?: string;
  btContextUrl?: string;
};

type DxfJobResult = {
  url: string;
  filename?: string;
  btContextUrl?: string;
  warning?: string;
};

type DxfJobStatus = {
  id: string | number;
  status: string;
  progress: number;
  result: DxfJobResult | null;
  error: string | null;
};

type ParsedApiBody = {
  data: unknown | null;
  rawText: string;
  contentType: string;
};

const parseApiBody = async (response: Response): Promise<ParsedApiBody> => {
  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  const rawText = await response.text();

  if (!rawText || rawText.trim().length === 0) {
    return { data: null, rawText, contentType };
  }

  if (!contentType.includes("application/json")) {
    return { data: null, rawText, contentType };
  }

  try {
    return {
      data: JSON.parse(rawText),
      rawText,
      contentType,
    };
  } catch {
    throw new Error(`Server returned invalid JSON (HTTP ${response.status})`);
  }
};

const buildHttpErrorMessage = (
  parsed: ParsedApiBody,
  status: number,
  fallback: string,
): string => {
  if (parsed.data && typeof parsed.data === "object") {
    const payload = parsed.data as Record<string, unknown>;
    if (
      typeof payload.details === "string" &&
      payload.details.trim().length > 0
    ) {
      return payload.details;
    }
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
    if (
      typeof payload.message === "string" &&
      payload.message.trim().length > 0
    ) {
      return payload.message;
    }
  }

  if (parsed.rawText.trim().length > 0) {
    return `HTTP ${status}: ${parsed.rawText.trim()}`;
  }

  return `${fallback} (HTTP ${status}, empty response body)`;
};

const requireJsonBody = <T>(
  parsed: ParsedApiBody,
  status: number,
  context: string,
): T => {
  if (parsed.data !== null) {
    return parsed.data as T;
  }

  if (parsed.rawText.trim().length > 0) {
    throw new Error(`${context} returned non-JSON response (HTTP ${status})`);
  }

  throw new Error(`${context} returned empty response body (HTTP ${status})`);
};

export const generateDXF = async (
  lat: number,
  lon: number,
  radius: number,
  mode: string,
  polygon: any[],
  layers: Record<string, boolean>,
  projection: "local" | "utm" = "local",
  contourRenderMode: "spline" | "polyline" = "spline",
  btContext?: Record<string, unknown>,
): Promise<DxfQueueResponse | DxfCachedResponse> => {
  const traceId = Logger.startTrace("generateDXF");
  const normalizedMode: "circle" | "polygon" | "bbox" =
    mode === "polygon" || mode === "bbox" ? mode : "circle";
  
  const normalizedPolygon = Array.isArray(polygon)
    ? polygon
        .map((point) => {
          if (
            Array.isArray(point) &&
            point.length >= 2 &&
            typeof point[0] === "number" &&
            typeof point[1] === "number"
          ) {
            return [point[0], point[1]] as [number, number];
          }

          if (!point || typeof point !== "object") {
            return null;
          }

          const source = point as {
            lng?: unknown;
            lon?: unknown;
            lat?: unknown;
          };
          const lng =
            typeof source.lng === "number"
              ? source.lng
              : typeof source.lon === "number"
                ? source.lon
                : null;
          const pointLat = typeof source.lat === "number" ? source.lat : null;

          if (lng === null || pointLat === null) {
            return null;
          }

          return [lng, pointLat] as [number, number];
        })
        .filter((point): point is [number, number] => point !== null)
    : [];

  try {
    const response = await fetch(`${API_URL}/dxf`, {
      method: "POST",
      headers: buildApiHeaders(),
      body: JSON.stringify({
        lat,
        lon,
        radius,
        mode: normalizedMode,
        polygon: normalizedPolygon,
        layers,
        projection,
        contourRenderMode,
        btContext,
      }),
    });

    const durationMs = Logger.endTrace(traceId);
    trackPerformance("generate_dxf_request", durationMs, { radius, mode: normalizedMode });

    const parsed = await parseApiBody(response);

    if (!response.ok) {
      throw new Error(
        buildHttpErrorMessage(
          parsed,
          response.status,
          "Backend generation failed",
        ),
      );
    }

    return requireJsonBody<DxfQueueResponse | DxfCachedResponse>(
      parsed,
      response.status,
      "DXF generation",
    );
  } catch (error) {
    Logger.endTrace(traceId);
    throw error;
  }
};

export const getDxfJobStatus = async (jobId: string): Promise<DxfJobStatus> => {
  const traceId = Logger.startTrace(`getDxfJobStatus_${jobId}`);
  try {
    const response = await fetch(`${API_URL}/jobs/${jobId}`, {
      headers: buildApiHeaders(),
    });

    const durationMs = Logger.endTrace(traceId);
    trackPerformance("get_dxf_job_status", durationMs, { jobId });

    const parsed = await parseApiBody(response);

    if (!response.ok) {
      throw new Error(
        buildHttpErrorMessage(
          parsed,
          response.status,
          "Failed to load job status",
        ),
      );
    }

    return requireJsonBody<DxfJobStatus>(
      parsed,
      response.status,
      "DXF job status",
    );
  } catch (error) {
    Logger.endTrace(traceId);
    throw error;
  }
};
