import { BtTopology, MtPoleNode, MtTopology } from "../types";

const EMPTY_MT_TOPOLOGY: MtTopology = {
  poles: [],
  edges: [],
};

const hasStructureValue = (value: string | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

export const isMtPoleConfigured = (pole: MtPoleNode): boolean => {
  const hasStructure = Boolean(
    pole.mtStructures &&
    (hasStructureValue(pole.mtStructures.n1) ||
      hasStructureValue(pole.mtStructures.n2) ||
      hasStructureValue(pole.mtStructures.n3) ||
      hasStructureValue(pole.mtStructures.n4)),
  );

  return (
    hasStructure ||
    Boolean(pole.verified) ||
    (pole.nodeChangeFlag ?? "existing") !== "existing"
  );
};

export const hasMeaningfulMtTopology = (mtTopology: MtTopology): boolean => {
  if (mtTopology.edges.length > 0) {
    return true;
  }

  return mtTopology.poles.some(isMtPoleConfigured);
};

export const mergeMtTopologyWithBtPoles = (
  btTopology: BtTopology | undefined,
  mtTopology: MtTopology | undefined,
): MtTopology => {
  const mtBase = mtTopology ?? EMPTY_MT_TOPOLOGY;
  const btPoles = btTopology?.poles ?? [];

  if (btPoles.length === 0) {
    return mtBase;
  }

  const mtById = new Map(mtBase.poles.map((pole) => [pole.id, pole]));
  const btPoleIds = new Set(btPoles.map((pole) => pole.id));

  const mergedBtPoles: MtPoleNode[] = btPoles.map((btPole) => {
    const current = mtById.get(btPole.id);

    return {
      id: btPole.id,
      lat: btPole.lat,
      lng: btPole.lng,
      title: btPole.title,
      mtStructures: current?.mtStructures,
      verified: current?.verified ?? false,
      nodeChangeFlag: current?.nodeChangeFlag ?? "existing",
    };
  });

  const legacyMtPoles = mtBase.poles.filter((pole) => !btPoleIds.has(pole.id));

  return {
    poles: [...mergedBtPoles, ...legacyMtPoles],
    edges: mtBase.edges,
  };
};
