import { MtTopology, MtPoleNode, MtEdge } from "../types";

export const EMPTY_MT_TOPOLOGY: MtTopology = {
  poles: [],
  edges: [],
};

export type MtEdgeChangeFlag = NonNullable<MtEdge["edgeChangeFlag"]>;
export type MtPoleChangeFlag = NonNullable<MtPoleNode["nodeChangeFlag"]>;

export const getMtEdgeChangeFlag = (edge: MtEdge): MtEdgeChangeFlag =>
  edge.edgeChangeFlag ?? "existing";

export const getMtPoleChangeFlag = (pole: MtPoleNode): MtPoleChangeFlag =>
  pole.nodeChangeFlag ?? "existing";

export const normalizeMtEdge = (edge: MtEdge): MtEdge => ({
  ...edge,
  edgeChangeFlag: getMtEdgeChangeFlag(edge),
});

export const normalizeMtEdges = (edges: MtEdge[]): MtEdge[] =>
  edges.map(normalizeMtEdge);

export const normalizeMtPole = (pole: MtPoleNode): MtPoleNode => ({
  ...pole,
  nodeChangeFlag: getMtPoleChangeFlag(pole),
});

export const normalizeMtPoles = (poles: MtPoleNode[]): MtPoleNode[] =>
  poles.map(normalizeMtPole);
