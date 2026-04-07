import { BtTopology, BtNetworkScenario, BtCqtComputationInputs, BtProjectType } from '../types';
import { CLANDESTINO_RAMAL_TYPE } from '../constants/btConstants';
import { inferBranchSide } from './appUtils';
import {
  calculateAccumulatedDemandByPole,
  calculateClandestinoDemandKvaByAreaAndClients
} from './btCalculations';

export interface BtContextParams {
  btTopology: BtTopology;
  projectType: BtProjectType;
  clandestinoAreaM2: number;
  btNetworkScenario: BtNetworkScenario;
  includeLayers: boolean;
}

export function buildBtContext({
  btTopology,
  projectType,
  clandestinoAreaM2,
  btNetworkScenario,
  includeLayers
}: BtContextParams) {
  const btAccumulated = calculateAccumulatedDemandByPole(btTopology, projectType, clandestinoAreaM2);
  const totalClientsX = btTopology.poles.reduce((sum, pole) => {
    const poleClients = (pole.ramais ?? []).reduce((poleSum, ramal) => {
      const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      if (projectType === 'clandestino') return isClandestino ? poleSum + ramal.quantity : poleSum;
      return isClandestino ? poleSum : poleSum + ramal.quantity;
    }, 0);
    return sum + poleClients;
  }, 0);
  const aa24DemandBase = btTopology.transformers.reduce((sum, t) => sum + (t.demandKw ?? 0), 0);
  const ab35LookupDmdi = calculateClandestinoDemandKvaByAreaAndClients(clandestinoAreaM2, totalClientsX);
  const cqtScenario = btNetworkScenario === 'proj1' || btNetworkScenario === 'proj2' ? btNetworkScenario : 'atual';
  const accumulatedByPoleMap = new Map(btAccumulated.map((item) => [item.poleId, item.accumulatedDemandKva]));
  const polesById = new Map(btTopology.poles.map((pole) => [pole.id, pole]));
  const cqtBranches = btTopology.edges
    .map((edge) => {
      const conductorName = edge.conductors[0]?.conductorName;
      if (!conductorName) return null;
      const fromAccumulatedKva = accumulatedByPoleMap.get(edge.fromPoleId) ?? 0;
      const toAccumulatedKva = accumulatedByPoleMap.get(edge.toPoleId) ?? 0;
      const acumuladaKva = Math.max(fromAccumulatedKva, toAccumulatedKva, 0);
      const fromPoleTitle = polesById.get(edge.fromPoleId)?.title ?? '';
      const toPoleTitle = polesById.get(edge.toPoleId)?.title ?? '';
      const inferredSide = inferBranchSide(edge.id) ?? inferBranchSide(fromPoleTitle) ?? inferBranchSide(toPoleTitle);
      return {
        trechoId: edge.id, ponto: edge.toPoleId, lado: inferredSide, fase: 'TRI' as const,
        acumuladaKva, eta: 1, tensaoTrifasicaV: 127, conductorName,
        lengthMeters: edge.lengthMeters ?? 0, temperatureC: 30
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const cqtComputationInputs: BtCqtComputationInputs = {
    scenario: cqtScenario,
    dmdi: { clandestinoEnabled: projectType === 'clandestino', aa24DemandBase, sumClientsX: totalClientsX, ab35LookupDmdi },
    db: { trAtual: btTopology.transformers.reduce((sum, t) => sum + (t.projectPowerKva ?? 0), 0), demAtual: aa24DemandBase, qtMt: 0 },
    branches: cqtBranches
  };
  return {
    projectType,
    btNetworkScenario,
    clandestinoAreaM2,
    totalTransformers: btTopology.transformers.length,
    totalPoles: btTopology.poles.length,
    totalEdges: btTopology.edges.length,
    verifiedTransformers: btTopology.transformers.filter((item) => item.verified).length,
    verifiedPoles: btTopology.poles.filter((item) => item.verified).length,
    verifiedEdges: btTopology.edges.filter((item) => item.verified).length,
    accumulatedByPole: btAccumulated,
    criticalPole: btAccumulated[0] ?? null,
    cqtComputationInputs,
    topology: includeLayers ? {
      poles: btTopology.poles.map((pole) => ({
        id: pole.id, lat: pole.lat, lng: pole.lng, title: pole.title,
        verified: pole.verified ?? false,
        ramais: (pole.ramais ?? []).map((ramal) => ({ id: ramal.id, quantity: ramal.quantity, ramalType: ramal.ramalType ?? '' }))
      })),
      transformers: btTopology.transformers.map((t) => ({
        id: t.id, poleId: t.poleId ?? '', lat: t.lat, lng: t.lng, title: t.title,
        projectPowerKva: t.projectPowerKva ?? 0, demandKw: t.demandKw, verified: t.verified ?? false
      })),
      edges: btTopology.edges.map((edge) => ({
        id: edge.id, fromPoleId: edge.fromPoleId, toPoleId: edge.toPoleId,
        lengthMeters: edge.lengthMeters ?? 0, verified: edge.verified ?? false,
        conductors: edge.conductors.map((c) => ({ id: c.id, quantity: c.quantity, conductorName: c.conductorName }))
      }))
    } : null
  };
}
