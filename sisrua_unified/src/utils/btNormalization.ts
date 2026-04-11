import { BtTopology, BtPoleNode, BtTransformer, BtEdge, GeoLocation } from '../types';
import {
  LEGACY_ID_ENTROPY,
  ENTITY_ID_PREFIXES,
} from '../constants/magicNumbers';

// ─── Constants ───────────────────────────────────────────────────────────────

export const EMPTY_BT_TOPOLOGY: BtTopology = {
  poles: [],
  transformers: [],
  edges: []
};

export const MAX_BT_EXPORT_HISTORY = 20;

export const NORMAL_CLIENT_RAMAL_TYPES = [
  '5 CC',
  '8 CC',
  '13 CC',
  '21 CC',
  '33 CC',
  '53 CC',
  '67 CC',
  '85 CC',
  '107 CC',
  '127 CC',
  '253 CC',
  '13 DX 6 AWG',
  '13 TX 6 AWG',
  '13 QX 6 AWG',
  '21 QX 4 AWG',
  '53 QX 1/0',
  '85 QX 3/0',
  '107 QX 4/0',
  '70 MMX',
  '185 MMX'
];

export const CLANDESTINO_RAMAL_TYPE = 'Clandestino';
export const DEFAULT_EDGE_CONDUCTOR = '70 Al - MX';
export const CURRENT_TO_DEMAND_CONVERSION = 0.375;
export const DEFAULT_TEMPERATURE_FACTOR = 1.2;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BtEdgeChangeFlag = NonNullable<BtEdge['edgeChangeFlag']>;
export type BtPoleChangeFlag = NonNullable<BtPoleNode['nodeChangeFlag']>;
export type BtTransformerChangeFlag = NonNullable<BtTransformer['transformerChangeFlag']>;

export type PendingNormalClassificationPole = {
  poleId: string;
  poleTitle: string;
  clandestinoClients: number;
};

// ─── Flag helpers ─────────────────────────────────────────────────────────────

export const getEdgeChangeFlag = (edge: BtEdge): BtEdgeChangeFlag => {
  if (edge.edgeChangeFlag) {
    return edge.edgeChangeFlag;
  }
  return edge.removeOnExecution ? 'remove' : 'existing';
};

export const getPoleChangeFlag = (pole: BtPoleNode): BtPoleChangeFlag =>
  pole.nodeChangeFlag ?? 'existing';

export const getTransformerChangeFlag = (transformer: BtTransformer): BtTransformerChangeFlag =>
  transformer.transformerChangeFlag ?? 'existing';

// ─── Normalization ────────────────────────────────────────────────────────────

export const normalizeBtEdge = (edge: BtEdge): BtEdge => {
  const edgeChangeFlag = getEdgeChangeFlag(edge);
  const mustHaveConductor = edgeChangeFlag === 'replace' || edgeChangeFlag === 'new';
  const hasConductors = edge.conductors.length > 0;
  const replacementFromConductors = Array.isArray(edge.replacementFromConductors)
    ? edge.replacementFromConductors
    : [];
  const hasReplacementFrom = replacementFromConductors.length > 0;

  return {
    ...edge,
    edgeChangeFlag,
    removeOnExecution: edgeChangeFlag === 'remove',
    conductors: mustHaveConductor && !hasConductors
      ? [{ id: `${ENTITY_ID_PREFIXES.CONDUCTOR}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`, quantity: 1, conductorName: DEFAULT_EDGE_CONDUCTOR }]
      : edge.conductors,
    replacementFromConductors: mustHaveConductor && !hasReplacementFrom
      ? [{ id: `${ENTITY_ID_PREFIXES.CONDUCTOR_REPLACEMENT}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`, quantity: 1, conductorName: DEFAULT_EDGE_CONDUCTOR }]
      : replacementFromConductors
  };
};

export const normalizeBtEdges = (edges: BtEdge[]): BtEdge[] => edges.map(normalizeBtEdge);

export const normalizeBtPole = (pole: BtPoleNode): BtPoleNode => ({
  ...pole,
  nodeChangeFlag: getPoleChangeFlag(pole),
  circuitBreakPoint: pole.circuitBreakPoint ?? false
});

export const normalizeBtPoles = (poles: BtPoleNode[]): BtPoleNode[] => poles.map(normalizeBtPole);

export const normalizeBtTransformer = (transformer: BtTransformer): BtTransformer => ({
  ...transformer,
  transformerChangeFlag: getTransformerChangeFlag(transformer)
});

export const normalizeBtTransformers = (transformers: BtTransformer[]): BtTransformer[] =>
  transformers.map(normalizeBtTransformer);

// ─── Geometry ─────────────────────────────────────────────────────────────────

export const distanceMeters = (a: GeoLocation, b: GeoLocation): number => {
  const earthRadius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const nextSequentialId = (ids: string[], prefix: string): string => {
  const matcher = new RegExp(`^${prefix}(\\d+)$`);
  let maxSuffix = 0;

  for (const id of ids) {
    const match = id.match(matcher);
    if (!match) {
      continue;
    }

    const suffix = Number.parseInt(match[1], 10);
    if (Number.isFinite(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  return `${prefix}${maxSuffix + 1}`;
};
