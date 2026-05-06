import { BtPoleNode, BtTopology } from '../types';
import {
  CLANDESTINO_RAMAL_TYPE,
  PendingNormalClassificationPole,
} from './btNormalization';

export const getPoleClandestinoClients = (pole: BtPoleNode) =>
  (pole.ramais ?? []).reduce((acc, ramal) => {
    const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
    return isClandestino ? acc + ramal.quantity : acc;
  }, 0);

export const getPoleNormalClients = (pole: BtPoleNode) =>
  (pole.ramais ?? []).reduce((acc, ramal) => {
    const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
    return isClandestino ? acc : acc + ramal.quantity;
  }, 0);

export const getPolesPendingNormalClassification = (
  topology: BtTopology,
): PendingNormalClassificationPole[] =>
  topology.poles
    .map((pole) => ({
      poleId: pole.id,
      poleTitle: pole.title,
      clandestinoClients: getPoleClandestinoClients(pole),
    }))
    .filter((entry) => entry.clandestinoClients > 0);

export const migrateClandestinoToDefaultNormalType = (
  topology: BtTopology,
  normalType: string,
): BtTopology => ({
  ...topology,
  poles: topology.poles.map((pole) => {
    const ramais = (pole.ramais ?? []).map((ramal) => {
      const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      return isClandestino ? { ...ramal, ramalType: normalType } : ramal;
    });
    return { ...pole, ramais };
  }),
});