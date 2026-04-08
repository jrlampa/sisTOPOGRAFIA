import type { AppSettings, BtCqtComputationInputs, BtNetworkScenario, BtTopology } from '../types';
import {
  calculateAccumulatedDemandByPole,
  calculateClandestinoDemandKvaByAreaAndClients,
} from './btCalculations';
import {
  CLANDESTINO_RAMAL_TYPE,
  getEdgeChangeFlag,
  getPoleChangeFlag,
  getTransformerChangeFlag,
} from './btNormalization';

const inferBranchSide = (rawLabel: string): 'ESQUERDO' | 'DIREITO' | undefined => {
  const label = rawLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (label.includes('ESQ') || label.includes('ESQUER')) {
    return 'ESQUERDO';
  }

  if (label.includes('DIR') || label.includes('DIREIT')) {
    return 'DIREITO';
  }

  return undefined;
};

interface BuildBtDxfContextParams {
  btTopology: BtTopology;
  settings: AppSettings;
  btNetworkScenario: BtNetworkScenario;
  includeTopology: boolean;
}

export function buildBtDxfContext({
  btTopology,
  settings,
  btNetworkScenario,
  includeTopology,
}: BuildBtDxfContextParams) {
  const btAccumulated = calculateAccumulatedDemandByPole(
    btTopology,
    settings.projectType ?? 'ramais',
    settings.clandestinoAreaM2 ?? 0
  );

  const totalClientsX = btTopology.poles.reduce((sum, pole) => {
    const poleClients = (pole.ramais ?? []).reduce((poleSum, ramal) => {
      const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      if ((settings.projectType ?? 'ramais') === 'clandestino') {
        return isClandestino ? poleSum + ramal.quantity : poleSum;
      }

      return isClandestino ? poleSum : poleSum + ramal.quantity;
    }, 0);

    return sum + poleClients;
  }, 0);

  const aa24DemandBase = btTopology.transformers.reduce((sum, transformer) => sum + (transformer.demandKw ?? 0), 0);
  const ab35LookupDmdi = calculateClandestinoDemandKvaByAreaAndClients(
    settings.clandestinoAreaM2 ?? 0,
    totalClientsX
  );

  const cqtScenario = btNetworkScenario === 'proj1' || btNetworkScenario === 'proj2' ? btNetworkScenario : 'atual';
  const accumulatedByPoleMap = new Map(btAccumulated.map((item) => [item.poleId, item.accumulatedDemandKva]));
  const polesById = new Map(btTopology.poles.map((pole) => [pole.id, pole]));

  const cqtBranches = btTopology.edges
    .filter((edge) => getEdgeChangeFlag(edge) !== 'remove')
    .map((edge) => {
      const conductorName = edge.conductors[0]?.conductorName;
      if (!conductorName) {
        return null;
      }

      const fromAccumulatedKva = accumulatedByPoleMap.get(edge.fromPoleId) ?? 0;
      const toAccumulatedKva = accumulatedByPoleMap.get(edge.toPoleId) ?? 0;
      const acumuladaKva = Math.max(fromAccumulatedKva, toAccumulatedKva, 0);
      const fromPoleTitle = polesById.get(edge.fromPoleId)?.title ?? '';
      const toPoleTitle = polesById.get(edge.toPoleId)?.title ?? '';
      const inferredSide =
        inferBranchSide(edge.id) ??
        inferBranchSide(fromPoleTitle) ??
        inferBranchSide(toPoleTitle);

      return {
        trechoId: edge.id,
        ponto: edge.toPoleId,
        lado: inferredSide,
        fase: 'TRI' as const,
        acumuladaKva,
        eta: 1,
        tensaoTrifasicaV: 127,
        conductorName,
        lengthMeters: edge.lengthMeters ?? 0,
        temperatureC: 30,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const cqtComputationInputs: BtCqtComputationInputs = {
    scenario: cqtScenario,
    dmdi: {
      clandestinoEnabled: (settings.projectType ?? 'ramais') === 'clandestino',
      aa24DemandBase,
      sumClientsX: totalClientsX,
      ab35LookupDmdi,
    },
    db: {
      trAtual: btTopology.transformers.reduce((sum, transformer) => sum + (transformer.projectPowerKva ?? 0), 0),
      demAtual: aa24DemandBase,
      qtMt: 0,
    },
    branches: cqtBranches,
  };

  return {
    projectType: settings.projectType ?? 'ramais',
    btNetworkScenario,
    clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
    totalTransformers: btTopology.transformers.length,
    totalPoles: btTopology.poles.length,
    totalEdges: btTopology.edges.length,
    verifiedTransformers: btTopology.transformers.filter((item) => item.verified).length,
    verifiedPoles: btTopology.poles.filter((item) => item.verified).length,
    verifiedEdges: btTopology.edges.filter((item) => item.verified).length,
    accumulatedByPole: btAccumulated,
    criticalPole: btAccumulated[0] ?? null,
    cqtComputationInputs,
    topology: includeTopology
      ? {
          poles: btTopology.poles.map((pole) => ({
            id: pole.id,
            lat: pole.lat,
            lng: pole.lng,
            title: pole.title,
            nodeChangeFlag: getPoleChangeFlag(pole),
            circuitBreakPoint: pole.circuitBreakPoint ?? false,
            verified: pole.verified ?? false,
            ramais: (pole.ramais ?? []).map((ramal) => ({
              id: ramal.id,
              quantity: ramal.quantity,
              ramalType: ramal.ramalType ?? '',
            })),
          })),
          transformers: btTopology.transformers.map((transformer) => ({
            id: transformer.id,
            poleId: transformer.poleId ?? '',
            lat: transformer.lat,
            lng: transformer.lng,
            title: transformer.title,
            transformerChangeFlag: getTransformerChangeFlag(transformer),
            projectPowerKva: transformer.projectPowerKva ?? 0,
            demandKw: transformer.demandKw,
            verified: transformer.verified ?? false,
          })),
          edges: btTopology.edges.map((edge) => ({
            id: edge.id,
            fromPoleId: edge.fromPoleId,
            toPoleId: edge.toPoleId,
            lengthMeters: edge.lengthMeters ?? 0,
            verified: edge.verified ?? false,
            edgeChangeFlag: getEdgeChangeFlag(edge),
            removeOnExecution: getEdgeChangeFlag(edge) === 'remove',
            replacementFromConductors: (edge.replacementFromConductors ?? []).map((conductor) => ({
              id: conductor.id,
              quantity: conductor.quantity,
              conductorName: conductor.conductorName,
            })),
            conductors: edge.conductors.map((conductor) => ({
              id: conductor.id,
              quantity: conductor.quantity,
              conductorName: conductor.conductorName,
            })),
          })),
        }
      : null,
  };
}
