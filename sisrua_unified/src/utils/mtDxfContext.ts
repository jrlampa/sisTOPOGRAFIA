import type { MtTopology } from "../types";

export interface MtDxfContextPayload {
  topology: {
    poles: Array<{
      id: string;
      lat: number;
      lng: number;
      title: string;
      verified: boolean;
      mtStructures?: {
        n1?: string;
        n2?: string;
        n3?: string;
        n4?: string;
      };
    }>;
    edges: Array<{
      id: string;
      fromPoleId: string;
      toPoleId: string;
      lengthMeters?: number;
      edgeChangeFlag?: "existing" | "new" | "remove" | "replace";
    }>;
  } | null;
}

export function buildMtDxfContext(
  mtTopology: MtTopology,
): MtDxfContextPayload {
  const poles = mtTopology.poles.map((pole) => {
    const s = pole.mtStructures ?? {};
    const n1 = s.n1?.trim() || undefined;
    const n2 = s.n2?.trim() || undefined;
    const n3 = s.n3?.trim() || undefined;
    const n4 = s.n4?.trim() || undefined;
    const hasStructures = !!(n1 || n2 || n3 || n4);

    return {
      id: pole.id,
      lat: pole.lat,
      lng: pole.lng,
      title: pole.title,
      verified: pole.verified ?? false,
      ...(hasStructures && { mtStructures: { n1, n2, n3, n4 } }),
    };
  });

  const edges = (mtTopology.edges || []).map((edge) => ({
    id: edge.id,
    fromPoleId: edge.fromPoleId,
    toPoleId: edge.toPoleId,
    lengthMeters: edge.lengthMeters,
    edgeChangeFlag: edge.edgeChangeFlag,
  }));

  const hasContent = poles.length > 0 || edges.length > 0;

  return {
    topology: hasContent ? { poles, edges } : null,
  };
}
