import { GeoLocation, TerrainGrid } from '../types';
import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;

type DxfQueueResponse = {
  status: 'queued';
  jobId: string | number;
};

type DxfCachedResponse = {
  status: 'success';
  url: string;
  message?: string;
  btContextUrl?: string;
};

type DxfJobResult = {
  url: string;
  filename?: string;
  btContextUrl?: string;
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
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const rawText = await response.text();

  if (!rawText || rawText.trim().length === 0) {
    return { data: null, rawText, contentType };
  }

  if (!contentType.includes('application/json')) {
    return { data: null, rawText, contentType };
  }

  try {
    return {
      data: JSON.parse(rawText),
      rawText,
      contentType
    };
  } catch {
    throw new Error(`Server returned invalid JSON (HTTP ${response.status})`);
  }
};

const buildHttpErrorMessage = (
  parsed: ParsedApiBody,
  status: number,
  fallback: string
): string => {
  if (parsed.data && typeof parsed.data === 'object') {
    const payload = parsed.data as Record<string, unknown>;
    if (typeof payload.details === 'string' && payload.details.trim().length > 0) {
      return payload.details;
    }
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message;
    }
  }

  if (parsed.rawText.trim().length > 0) {
    return `HTTP ${status}: ${parsed.rawText.trim()}`;
  }

  return `${fallback} (HTTP ${status}, empty response body)`;
};

const requireJsonBody = <T>(parsed: ParsedApiBody, status: number, context: string): T => {
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
  projection: 'local' | 'utm' = 'local',
  contourRenderMode: 'spline' | 'polyline' = 'spline',
  btContext?: Record<string, unknown>
): Promise<DxfQueueResponse | DxfCachedResponse> => {

  const response = await fetch(`${API_URL}/dxf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, radius, mode, polygon, layers, projection, contourRenderMode, btContext })
  });

  const parsed = await parseApiBody(response);

  if (!response.ok) {
    throw new Error(buildHttpErrorMessage(parsed, response.status, 'Backend generation failed'));
  }

  return requireJsonBody<DxfQueueResponse | DxfCachedResponse>(parsed, response.status, 'DXF generation');
};

export const getDxfJobStatus = async (jobId: string): Promise<DxfJobStatus> => {
  const response = await fetch(`${API_URL}/jobs/${jobId}`);

  const parsed = await parseApiBody(response);

  if (!response.ok) {
    throw new Error(buildHttpErrorMessage(parsed, response.status, 'Failed to load job status'));
  }

  return requireJsonBody<DxfJobStatus>(parsed, response.status, 'DXF job status');
};