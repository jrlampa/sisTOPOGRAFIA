/**
 * useBtPoleOperations.ts
 * Encapsulates all BT Pole CRUD operations
 * Separated from useBtCrudHandlers for better SRP compliance
 * 
 * Operations:
 * - Insert pole via coordinates or map click
 * - Delete pole (with cascading transformers)
 * - Rename pole
 * - Move/drag pole
 * - Manage ramal (client) operations
 * - Toggle circuit break
 * - Set pole verification status
 * - Handle clandestino/normal classification
 */

import { useState } from 'react';
import {
  GlobalState,
  GeoLocation,
  BtTopology,
  BtPoleNode,
  AppSettings
} from '../types';
import { ToastType } from '../components/Toast';
import {
  EMPTY_BT_TOPOLOGY,
  NORMAL_CLIENT_RAMAL_TYPES,
  CLANDESTINO_RAMAL_TYPE,
  BtPoleChangeFlag,
  PendingNormalClassificationPole,
  normalizeBtPole,
  normalizeBtPoles,
  distanceMeters,
  nextSequentialId,
} from '../utils/btNormalization';
import { generateEntityId, ID_PREFIX } from '../utils/idGenerator';
import { parseLatLngQuery, parseUtmQuery } from '../utils/geo';
import { calculateSectioningImpact } from '../utils/btCalculations';

export type { PendingNormalClassificationPole };

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
};

// ─── Helper functions ──────────────────────────────────────────────────────

const getPoleClandestinoClients = (pole: BtPoleNode) =>
  (pole.ramais ?? []).reduce((acc, ramal) => {
    const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
    return isClandestino ? acc + ramal.quantity : acc;
  }, 0);

const getPoleNormalClients = (pole: BtPoleNode) =>
  (pole.ramais ?? []).reduce((acc, ramal) => {
    const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
    return isClandestino ? acc : acc + ramal.quantity;
  }, 0);

const getPolesPendingNormalClassification = (topology: BtTopology): PendingNormalClassificationPole[] =>
  topology.poles
    .map((pole) => ({
      poleId: pole.id,
      poleTitle: pole.title,
      clandestinoClients: getPoleClandestinoClients(pole)
    }))
    .filter((entry) => entry.clandestinoClients > 0);

const migrateClandestinoToDefaultNormalType = (topology: BtTopology, normalType: string): BtTopology => ({
  ...topology,
  poles: topology.poles.map((pole) => {
    const ramais = (pole.ramais ?? []).map((ramal) => {
      const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
      return isClandestino ? { ...ramal, ramalType: normalType } : ramal;
    });
    return { ...pole, ramais };
  })
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBtPoleOperations({ appState, setAppState, showToast }: Params) {
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const settings: AppSettings = appState.settings;

  // ── UI state for pole operations ──────────────────────────────────────────
  const [btPoleCoordinateInput, setBtPoleCoordinateInput] = useState('');
  const [pendingNormalClassificationPoles, setPendingNormalClassificationPoles] = useState<PendingNormalClassificationPole[]>([]);
  const [clandestinoToNormalModal, setClandestinoToNormalModal] = useState<{
    poles: PendingNormalClassificationPole[];
  } | null>(null);
  const [normalToClandestinoModal, setNormalToClandestinoModal] = useState<{
    totalNormalClients: number;
  } | null>(null);
  const [normalRamalModal, setNormalRamalModal] = useState<{
    poleId: string;
    poleTitle: string;
    ramalType: string;
    quantity: number;
  } | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const findNearestPole = (location: GeoLocation, maxDistanceMeters = 80): BtPoleNode | null => {
    if (btTopology.poles.length === 0) {
      return null;
    }

    let nearest = btTopology.poles[0];
    let nearestDistance = distanceMeters(location, { lat: nearest.lat, lng: nearest.lng });

    for (const pole of btTopology.poles.slice(1)) {
      const poleDistance = distanceMeters(location, { lat: pole.lat, lng: pole.lng });
      if (poleDistance < nearestDistance) {
        nearest = pole;
        nearestDistance = poleDistance;
      }
    }

    return nearestDistance <= maxDistanceMeters ? nearest : null;
  };

  const applyProjectTypeSwitch = (
    nextProjectType: 'ramais' | 'clandestino',
    nextTopology: BtTopology = btTopology
  ) => {
    setAppState(
      {
        ...appState,
        btTopology: nextTopology,
        settings: { ...settings, projectType: nextProjectType }
      },
      true
    );
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const insertBtPoleAtLocation = (location: GeoLocation) => {
    const nextId = nextSequentialId(btTopology.poles.map((pole) => pole.id), 'P');
    const nextPole: BtPoleNode = {
      id: nextId,
      lat: location.lat,
      lng: location.lng,
      title: `Poste ${nextId}`,
      ramais: [],
      nodeChangeFlag: 'existing'
    };

    setAppState(
      {
        ...appState,
        center: {
          lat: location.lat,
          lng: location.lng,
          label: location.label ?? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
        },
        btTopology: { ...btTopology, poles: [...btTopology.poles, nextPole] }
      },
      true
    );

    showToast(`${nextPole.title} inserido`, 'success');
  };

  const handleBtInsertPoleByCoordinates = () => {
    const query = btPoleCoordinateInput.trim();
    if (!query) {
      showToast('Informe as coordenadas do poste.', 'info');
      return;
    }

    const parsed = parseLatLngQuery(query) ?? parseUtmQuery(query);
    if (!parsed) {
      showToast('Formato inválido. Use: -22.9068 -43.1729 ou 23K 635806 7462003.', 'error');
      return;
    }

    insertBtPoleAtLocation(parsed);
    setBtPoleCoordinateInput('');
  };

  const handleBtDeletePole = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    const transformerIdsToRemove = new Set(
      btTopology.transformers
        .filter((transformer) => {
          if (transformer.poleId) {
            return transformer.poleId === poleId;
          }
          if (!pole) {
            return false;
          }
          return (
            distanceMeters(
              { lat: transformer.lat, lng: transformer.lng },
              { lat: pole.lat, lng: pole.lng }
            ) <= 6
          );
        })
        .map((transformer) => transformer.id)
    );

    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          poles: btTopology.poles.filter((p) => p.id !== poleId),
          edges: btTopology.edges.filter((e) => e.fromPoleId !== poleId && e.toPoleId !== poleId),
          transformers: btTopology.transformers.filter((transformer) => !transformerIdsToRemove.has(transformer.id))
        }
      },
      true
    );
    showToast(`Poste ${poleId} removido`, 'info');
  };

  const handleBtSetPoleChangeFlag = (poleId: string, nodeChangeFlag: BtPoleChangeFlag) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          poles: btTopology.poles.map((pole) =>
            pole.id === poleId ? normalizeBtPole({ ...pole, nodeChangeFlag }) : pole
          )
        }
      },
      true
    );
  };

  const handleBtTogglePoleCircuitBreak = (poleId: string, circuitBreakPoint: boolean) => {
    const nextTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) =>
        pole.id === poleId ? normalizeBtPole({ ...pole, circuitBreakPoint }) : pole
      )
    };

    const sectioningImpact = circuitBreakPoint
      ? calculateSectioningImpact(nextTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0)
      : null;
    const suggestedPole = sectioningImpact?.suggestedPoleId
      ? nextTopology.poles.find((pole) => pole.id === sectioningImpact.suggestedPoleId)
      : null;

    setAppState(
      {
        ...appState,
        center: suggestedPole
          ? { lat: suggestedPole.lat, lng: suggestedPole.lng, label: `Poste sugerido para novo trafo: ${suggestedPole.title}` }
          : appState.center,
        btTopology: nextTopology
      },
      true
    );

    if (!circuitBreakPoint) {
      showToast(`Separação física removida do poste ${poleId}.`, 'info');
      return;
    }

    if (sectioningImpact && sectioningImpact.unservedPoleIds.length > 0) {
      const suggestedLabel = suggestedPole ? `${suggestedPole.title} (${suggestedPole.id})` : 'não encontrado';
      showToast(
        `Seccionamento BT: ${sectioningImpact.unservedPoleIds.length} poste(s) sem trafo atendendo. ` +
          `Carga sobrante estimada: ${sectioningImpact.estimatedDemandKw.toFixed(2)} kVA para ${sectioningImpact.unservedClients} cliente(s). ` +
          `Poste sugerido: ${suggestedLabel}.`,
        'error'
      );
      return;
    }

    showToast(`Poste ${poleId} marcado com separação física do circuito.`, 'info');
  };

  const handleBtDragPole = (poleId: string, lat: number, lng: number) => {
    const updatedPoles = btTopology.poles.map((p) => (p.id === poleId ? { ...p, lat, lng } : p));
    const updatedTransformers = btTopology.transformers.map((transformer) =>
      transformer.poleId === poleId ? { ...transformer, lat, lng } : transformer
    );
    const updatedEdges = btTopology.edges.map((edge) => {
      const from = updatedPoles.find((p) => p.id === edge.fromPoleId);
      const to = updatedPoles.find((p) => p.id === edge.toPoleId);
      if (!from || !to) return edge;
      const newLength = Math.round(distanceMeters({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }));
      return { ...edge, lengthMeters: newLength };
    });

    setAppState(
      { ...appState, btTopology: { ...btTopology, poles: updatedPoles, transformers: updatedTransformers, edges: updatedEdges } },
      true
    );
  };

  const handleBtRenamePole = (poleId: string, title: string) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          poles: btTopology.poles.map((p) => (p.id === poleId ? { ...p, title } : p))
        }
      },
      true
    );
  };

  const handleBtSetPoleVerified = (poleId: string, verified: boolean) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          poles: btTopology.poles.map((pole) => (pole.id === poleId ? { ...pole, verified } : pole))
        }
      },
      true
    );
  };

  const handleBtQuickAddPoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast('Poste não encontrado', 'error');
      return;
    }

    if ((settings.projectType ?? 'ramais') !== 'clandestino') {
      setNormalRamalModal({
        poleId,
        poleTitle: pole.title,
        ramalType: NORMAL_CLIENT_RAMAL_TYPES[0],
        quantity: 1
      });
      return;
    }

    const nextRamalId = generateEntityId(ID_PREFIX.RAMAL_POLE);
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          poles: btTopology.poles.map((candidate) =>
            candidate.id === poleId
              ? {
                  ...candidate,
                  ramais: [
                    ...(candidate.ramais ?? []),
                    { id: nextRamalId, quantity: 1, ramalType: CLANDESTINO_RAMAL_TYPE }
                  ]
                }
              : candidate
          )
        }
      },
      true
    );
    showToast(`+1 ramal em ${pole.title}.`, 'success');
  };

  const handleBtQuickRemovePoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast('Poste não encontrado', 'error');
      return;
    }

    const ramais = [...(pole.ramais ?? [])];
    if (ramais.length === 0) {
      showToast(`${pole.title} sem ramais para reduzir.`, 'info');
      return;
    }

    const isClandestinoMode = (settings.projectType ?? 'ramais') === 'clandestino';
    const targetIndex = [...ramais]
      .map((ramal, index) => ({ ramal, index }))
      .reverse()
      .find(({ ramal }) => {
        const isClandestinoRamal = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
        return isClandestinoMode ? isClandestinoRamal : !isClandestinoRamal;
      })?.index;

    if (targetIndex === undefined) {
      showToast(
        isClandestinoMode
          ? `${pole.title} não possui ramais clandestinos para reduzir.`
          : `${pole.title} não possui ramais normais para reduzir.`,
        'info'
      );
      return;
    }

    const targetRamal = ramais[targetIndex];
    if (targetRamal.quantity > 1) {
      ramais[targetIndex] = { ...targetRamal, quantity: targetRamal.quantity - 1 };
    } else {
      ramais.splice(targetIndex, 1);
    }

    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          poles: btTopology.poles.map((candidate) =>
            candidate.id === poleId ? { ...candidate, ramais } : candidate
          )
        }
      },
      true
    );
    showToast(`-1 ramal em ${pole.title}.`, 'success');
  };

  const handleConfirmNormalRamalModal = () => {
    if (!normalRamalModal) {
      return;
    }

    const quantity = Math.max(1, Math.round(normalRamalModal.quantity));
    const nextRamalId = generateEntityId(ID_PREFIX.RAMAL_POLE);
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          poles: btTopology.poles.map((candidate) =>
            candidate.id === normalRamalModal.poleId
              ? {
                  ...candidate,
                  ramais: [
                    ...(candidate.ramais ?? []),
                    { id: nextRamalId, quantity, ramalType: normalRamalModal.ramalType }
                  ]
                }
              : candidate
          )
        }
      },
      true
    );

    setPendingNormalClassificationPoles((current) =>
      current.filter((entry) => entry.poleId !== normalRamalModal.poleId)
    );

    showToast(`${quantity} ramal(is) ${normalRamalModal.ramalType} em ${normalRamalModal.poleTitle}.`, 'success');
    setNormalRamalModal(null);
  };

  const updateProjectType = (nextProjectType: 'ramais' | 'clandestino') => {
    const currentProjectType = settings.projectType ?? 'ramais';
    if (currentProjectType === nextProjectType) {
      return;
    }

    if (currentProjectType === 'clandestino' && nextProjectType === 'ramais') {
      const pendingPoles = getPolesPendingNormalClassification(btTopology);
      if (pendingPoles.length > 0) {
        setClandestinoToNormalModal({ poles: pendingPoles });
        return;
      }
    }

    if (currentProjectType === 'ramais' && nextProjectType === 'clandestino') {
      const totalNormalClients = btTopology.poles.reduce((acc, pole) => acc + getPoleNormalClients(pole), 0);
      if (totalNormalClients > 0) {
        setNormalToClandestinoModal({ totalNormalClients });
        return;
      }
    }

    setPendingNormalClassificationPoles([]);
    setAppState(
      { ...appState, settings: { ...settings, projectType: nextProjectType } },
      true
    );
  };

  const handleClandestinoToNormalClassifyLater = () => {
    if (!clandestinoToNormalModal) {
      return;
    }

    setPendingNormalClassificationPoles(clandestinoToNormalModal.poles);
    applyProjectTypeSwitch('ramais');
    setClandestinoToNormalModal(null);
    showToast('Projeto mudou para Normal. Classificação de ramais pendente (DXF bloqueado).', 'info');
  };

  const handleClandestinoToNormalConvertNow = () => {
    if (!clandestinoToNormalModal) {
      return;
    }

    const migratedTopology = migrateClandestinoToDefaultNormalType(btTopology, NORMAL_CLIENT_RAMAL_TYPES[0]);
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch('ramais', migratedTopology);
    setClandestinoToNormalModal(null);
    showToast('Ramais clandestinos migrados para Ramal Monofasico.', 'success');
  };

  const handleNormalToClandestinoKeepClients = () => {
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch('clandestino');
    setNormalToClandestinoModal(null);
    showToast('Mudança para Clandestino mantendo clientes normais para possível retorno.', 'info');
  };

  const handleNormalToClandestinoZeroNormalClients = () => {
    const cleanedTopology: BtTopology = {
      ...btTopology,
      poles: btTopology.poles.map((pole) => ({
        ...pole,
        ramais: (pole.ramais ?? []).filter(
          (ramal) => (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE
        )
      }))
    };

    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch('clandestino', cleanedTopology);
    setNormalToClandestinoModal(null);
    showToast('Clientes normais zerados. Apenas ramais clandestinos foram mantidos.', 'success');
  };

  return {
    // ── UI State ───────────────────────────────────────────────────────────
    btPoleCoordinateInput,
    setBtPoleCoordinateInput,
    pendingNormalClassificationPoles,
    clandestinoToNormalModal,
    setClandestinoToNormalModal,
    normalToClandestinoModal,
    setNormalToClandestinoModal,
    normalRamalModal,
    setNormalRamalModal,
    isSidebarDockedForRamalModal: Boolean(normalRamalModal),

    // ── Handlers ───────────────────────────────────────────────────────────
    handleBtInsertPoleByCoordinates,
    handleBtDeletePole,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtDragPole,
    handleBtRenamePole,
    handleBtSetPoleVerified,
    handleBtQuickAddPoleRamal,
    handleBtQuickRemovePoleRamal,
    handleConfirmNormalRamalModal,
    updateProjectType,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
    findNearestPole,

    // ── Helpers ────────────────────────────────────────────────────────────
    getPoleClandestinoClients,
    getPoleNormalClients,
    insertBtPoleAtLocation
  };
}
