import { BtTopology, BtProjectType, AppSettings } from '../types';
import { PendingNormalClassificationPole } from '../constants/btConstants';
import {
  getClandestinoAreaRange, getClandestinoClientsRange,
  getClandestinoDiversificationFactorByClients, getClandestinoKvaByArea
} from './btCalculations';

export interface BtValidationError {
  message: string;
  type: 'error';
}

export function validateBtTopologyForExport(
  btTopology: BtTopology,
  settings: AppSettings,
  pendingNormalClassificationPoles: PendingNormalClassificationPole[],
  getPoleClandestinoClients: (pole: { ramais?: { quantity: number; ramalType?: string }[] }) => number
): BtValidationError | null {
  if (!settings.layers.btNetwork) return null;

  if (settings.projectType === 'clandestino') {
    const area = settings.clandestinoAreaM2 ?? 0;
    const areaRange = getClandestinoAreaRange();
    const clientsRange = getClandestinoClientsRange();
    if (!Number.isInteger(area)) return { message: 'A área clandestina deve ser inteira para casar com a tabela da planilha.', type: 'error' };
    if (getClandestinoKvaByArea(area) === null) return { message: `Área clandestina fora da tabela (${areaRange.min}-${areaRange.max} m²).`, type: 'error' };
    const totalClandestinoClients = btTopology.poles.reduce((acc, pole) => acc + getPoleClandestinoClients(pole), 0);
    if (getClandestinoDiversificationFactorByClients(totalClandestinoClients) === null) {
      return { message: `Total de clientes/ramais fora da tabela (${clientsRange.min}-${clientsRange.max}). Atual: ${totalClandestinoClients}.`, type: 'error' };
    }
  }

  const edgeWithoutConductors = btTopology.edges.find((edge) => edge.conductors.length === 0);
  if (edgeWithoutConductors) return { message: `Trecho ${edgeWithoutConductors.id} sem condutores definidos.`, type: 'error' };

  if (settings.projectType !== 'clandestino') {
    if (pendingNormalClassificationPoles.length > 0) return { message: 'Existem postes com classificação de ramal pendente. Conclua antes de gerar DXF.', type: 'error' };
    if (btTopology.transformers.length === 0) return { message: 'Adicione ao menos um transformador com leituras para calcular demanda de clientes normais.', type: 'error' };
    const transformerWithoutReadings = btTopology.transformers.find((t) => t.readings.length === 0);
    if (transformerWithoutReadings) return { message: `Transformador ${transformerWithoutReadings.id} sem leituras.`, type: 'error' };
  }

  return null;
}
