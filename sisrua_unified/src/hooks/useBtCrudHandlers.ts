import { useState } from 'react';
import {
  GlobalState,
  GeoLocation,
  BtTopology,
  BtPoleNode,
  BtTransformer,
  BtEdge,
  AppSettings
} from '../types';
import { ToastType } from '../components/Toast';
import {
  EMPTY_BT_TOPOLOGY,
  MAX_BT_EXPORT_HISTORY,
  NORMAL_CLIENT_RAMAL_TYPES,
  CLANDESTINO_RAMAL_TYPE,
  DEFAULT_EDGE_CONDUCTOR,
  CURRENT_TO_DEMAND_CONVERSION,
  DEFAULT_TEMPERATURE_FACTOR,
  BtEdgeChangeFlag,
  BtPoleChangeFlag,
  BtTransformerChangeFlag,
  PendingNormalClassificationPole,
  getEdgeChangeFlag,
  normalizeBtEdge,
  normalizeBtEdges,
  normalizeBtPole,
  normalizeBtPoles,
  normalizeBtTransformer,
  normalizeBtTransformers,
  distanceMeters,
  nextSequentialId
} from '../utils/btNormalization';
import { generateEntityId, ID_PREFIX } from '../utils/idGenerator';
import { debounce } from '../utils/debounce';
import {
  LEGACY_ID_ENTROPY,
  ENTITY_ID_PREFIXES,
} from '../constants/magicNumbers';
import {
  calculateSectioningImpact,
  getClandestinoAreaRange,
  getClandestinoClientsRange,
  getClandestinoKvaByArea,
  getClandestinoDiversificationFactorByClients,
  calculateClandestinoDemandKvaByAreaAndClients
} from '../utils/btCalculations';
import { parseLatLngQuery, parseUtmQuery } from '../utils/geo';

export type { PendingNormalClassificationPole };

// ─── Internal helpers (file-private) ─────────────────────────────────────────

const downloadBlob = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const escapeCsvCell = (value: string | number) => {
  const normalized = String(value).replace(/\r?\n/g, ' ');
  if (normalized.includes(';') || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

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

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
};

export function useBtCrudHandlers({ appState, setAppState, showToast }: Params) {
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const settings: AppSettings = appState.settings;
  const btExportSummary = appState.btExportSummary ?? null;
  const btExportHistory = appState.btExportHistory ?? [];

  // ── Internal UI state ─────────────────────────────────────────────────────

  const [btPoleCoordinateInput, setBtPoleCoordinateInput] = useState('');
  const [pendingBtEdgeStartPoleId, setPendingBtEdgeStartPoleId] = useState<string | null>(null);
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
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // ── Private helpers ───────────────────────────────────────────────────────

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

  // ── Public handlers ───────────────────────────────────────────────────────

  const clearPendingBtEdge = () => setPendingBtEdgeStartPoleId(null);

  const updateBtTopology = (nextTopology: BtTopology) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...nextTopology,
          poles: normalizeBtPoles(nextTopology.poles),
          transformers: normalizeBtTransformers(nextTopology.transformers),
          edges: normalizeBtEdges(nextTopology.edges)
        }
      },
      true
    );
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

  const updateClandestinoAreaM2 = (nextAreaM2: number) => {
    setAppState(
      { ...appState, settings: { ...settings, clandestinoAreaM2: nextAreaM2 } },
      true
    );
  };

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

  const handleBtMapClick = (location: GeoLocation) => {
    const btEditorMode = settings.btEditorMode ?? 'none';

    if (btEditorMode === 'none') {
      return;
    }

    if (btEditorMode === 'move-pole') {
      return;
    }

    if (btEditorMode === 'add-pole') {
      insertBtPoleAtLocation(location);
      return;
    }

    if (btEditorMode === 'add-transformer') {
      const nearestPole = findNearestPole(location);
      if (!nearestPole) {
        showToast('Trafo deve ser atrelado a um poste (clique em um poste)', 'error');
        return;
      }

      const existingOnPole = btTopology.transformers.find((transformer) => {
        if (transformer.poleId) {
          return transformer.poleId === nearestPole.id;
        }
        return distanceMeters(
          { lat: transformer.lat, lng: transformer.lng },
          { lat: nearestPole.lat, lng: nearestPole.lng }
        ) <= 6;
      });

      if (existingOnPole) {
        showToast(`${nearestPole.title} já possui transformador`, 'info');
        return;
      }

      const nextId = nextSequentialId(btTopology.transformers.map((transformer) => transformer.id), 'TR');
      const nextTransformer: BtTransformer = {
        id: nextId,
        poleId: nearestPole.id,
        lat: nearestPole.lat,
        lng: nearestPole.lng,
        title: `Transformador ${nextId}`,
        projectPowerKva: 0,
        monthlyBillBrl: 0,
        demandKw: 0,
        readings: [],
        transformerChangeFlag: 'existing'
      };

      setAppState(
        { ...appState, btTopology: { ...btTopology, transformers: [...btTopology.transformers, nextTransformer] } },
        true
      );
      showToast(`${nextTransformer.title} inserido em ${nearestPole.title}`, 'success');
      return;
    }

    if (btEditorMode === 'add-edge') {
      const nearestPole = findNearestPole(location);
      if (!nearestPole) {
        showToast('Nenhum poste próximo (raio de captura: 80m)', 'error');
        return;
      }

      if (!pendingBtEdgeStartPoleId) {
        setPendingBtEdgeStartPoleId(nearestPole.id);
        showToast(`Origem selecionada: ${nearestPole.title}`, 'info');
        return;
      }

      if (pendingBtEdgeStartPoleId === nearestPole.id) {
        showToast('Selecione um segundo poste para concluir o condutor', 'info');
        return;
      }

      const fromPole = btTopology.poles.find((pole) => pole.id === pendingBtEdgeStartPoleId);
      if (!fromPole) {
        setPendingBtEdgeStartPoleId(null);
        showToast('Poste de origem não encontrado', 'error');
        return;
      }

      const alreadyConnected = btTopology.edges.some(
        (edge) =>
          (edge.fromPoleId === fromPole.id && edge.toPoleId === nearestPole.id) ||
          (edge.fromPoleId === nearestPole.id && edge.toPoleId === fromPole.id)
      );

      if (alreadyConnected) {
        setPendingBtEdgeStartPoleId(nearestPole.id);
        showToast(`Já existe condutor entre ${fromPole.id} <-> ${nearestPole.id}. Nova origem: ${nearestPole.id}`, 'info');
        return;
      }

      const edgeId = nextSequentialId(btTopology.edges.map((edge) => edge.id), 'E');
      const lengthMeters = Math.round(
        distanceMeters(
          { lat: fromPole.lat, lng: fromPole.lng },
          { lat: nearestPole.lat, lng: nearestPole.lng }
        )
      );

      setAppState(
        {
          ...appState,
          btTopology: {
            ...btTopology,
            edges: [
              ...btTopology.edges,
              {
                id: edgeId,
                fromPoleId: fromPole.id,
                toPoleId: nearestPole.id,
                lengthMeters,
                conductors: [],
                replacementFromConductors: [],
                removeOnExecution: false,
                edgeChangeFlag: 'existing'
              }
            ]
          }
        },
        true
      );

      setPendingBtEdgeStartPoleId(nearestPole.id);
      showToast(`Condutor ${edgeId} criado (${lengthMeters}m). Nova origem: ${nearestPole.id}`, 'success');
    }
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

  const handleBtDeleteEdge = (edgeId: string) => {
    setAppState(
      { ...appState, btTopology: { ...btTopology, edges: btTopology.edges.filter((e) => e.id !== edgeId) } },
      true
    );
    showToast(`Condutor ${edgeId} removido`, 'info');
  };

  const handleBtSetEdgeChangeFlag = (edgeId: string, edgeChangeFlag: BtEdgeChangeFlag) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          edges: btTopology.edges.map((edge) => {
            if (edge.id !== edgeId) {
              return edge;
            }
            return normalizeBtEdge({ ...edge, edgeChangeFlag, removeOnExecution: edgeChangeFlag === 'remove' });
          })
        }
      },
      true
    );

    const statusLabel =
      edgeChangeFlag === 'remove'
        ? 'REMOÇÃO'
        : edgeChangeFlag === 'new'
          ? 'NOVO'
          : edgeChangeFlag === 'replace'
            ? 'SUBSTITUIÇÃO'
            : 'EXISTENTE';

    showToast(`Trecho ${edgeId} marcado como ${statusLabel}.`, 'info');
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

  const handleBtSetTransformerChangeFlag = (transformerId: string, transformerChangeFlag: BtTransformerChangeFlag) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          transformers: btTopology.transformers.map((transformer) =>
            transformer.id === transformerId
              ? normalizeBtTransformer({ ...transformer, transformerChangeFlag })
              : transformer
          )
        }
      },
      true
    );
  };

  const handleBtToggleEdgeRemoval = (edgeId: string, removeOnExecution: boolean) => {
    handleBtSetEdgeChangeFlag(edgeId, removeOnExecution ? 'remove' : 'existing');
  };

  const handleBtSetEdgeReplacementFromConductors = (edgeId: string, conductors: BtEdge['conductors']) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          edges: btTopology.edges.map((edge) =>
            edge.id !== edgeId ? edge : normalizeBtEdge({ ...edge, replacementFromConductors: conductors })
          )
        }
      },
      true
    );
  };

  const handleBtDeleteTransformer = (transformerId: string) => {
    setAppState(
      {
        ...appState,
        btTopology: { ...btTopology, transformers: btTopology.transformers.filter((t) => t.id !== transformerId) }
      },
      true
    );
    showToast(`Transformador ${transformerId} removido`, 'info');
  };

  const handleBtToggleTransformerOnPole = (poleId: string) => {
    const pole = btTopology.poles.find((candidate) => candidate.id === poleId);
    if (!pole) {
      showToast('Poste não encontrado', 'error');
      return;
    }

    const transformersOnPole = btTopology.transformers.filter((transformer) => {
      if (transformer.poleId) {
        return transformer.poleId === poleId;
      }
      return (
        distanceMeters(
          { lat: transformer.lat, lng: transformer.lng },
          { lat: pole.lat, lng: pole.lng }
        ) <= 6
      );
    });

    if (transformersOnPole.length === 0) {
      const nextId = nextSequentialId(btTopology.transformers.map((transformer) => transformer.id), 'TR');
      const nextTransformer: BtTransformer = {
        id: nextId,
        poleId,
        lat: pole.lat,
        lng: pole.lng,
        title: `Transformador ${nextId}`,
        projectPowerKva: 0,
        monthlyBillBrl: 0,
        demandKw: 0,
        readings: [],
        transformerChangeFlag: 'existing'
      };

      setAppState(
        { ...appState, btTopology: { ...btTopology, transformers: [...btTopology.transformers, nextTransformer] } },
        true
      );
      showToast(`Transformador adicionado em ${pole.title}`, 'success');
      return;
    }

    const removeIds = new Set(transformersOnPole.map((transformer) => transformer.id));
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          transformers: btTopology.transformers.filter((transformer) => !removeIds.has(transformer.id))
        }
      },
      true
    );
    showToast(`Transformador removido de ${pole.title}`, 'success');
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

  const handleBtDragTransformer = (transformerId: string, lat: number, lng: number) => {
    const nearestPole = findNearestPole({ lat, lng });
    if (!nearestPole) {
      showToast('Trafo deve permanecer atrelado a um poste', 'error');
      return;
    }

    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          transformers: btTopology.transformers.map((t) =>
            t.id === transformerId
              ? { ...t, poleId: nearestPole.id, lat: nearestPole.lat, lng: nearestPole.lng }
              : t
          )
        }
      },
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

  const handleBtRenameTransformer = (transformerId: string, title: string) => {
    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          transformers: btTopology.transformers.map((t) => (t.id === transformerId ? { ...t, title } : t))
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

  const handleBtQuickAddEdgeConductor = (edgeId: string, conductorName: string) => {
    const edge = btTopology.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      showToast('Condutor não encontrado', 'error');
      return;
    }

    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    const existingIndex = conductors.findIndex((entry) => entry.conductorName === selectedConductor);
    if (existingIndex === -1) {
      conductors.push({
        id: `${ENTITY_ID_PREFIXES.CONDUCTOR}${Date.now()}${Math.floor(Math.random() * LEGACY_ID_ENTROPY)}`,
        quantity: 1,
        conductorName: selectedConductor
      });
    } else {
      const target = conductors[existingIndex];
      conductors[existingIndex] = { ...target, quantity: target.quantity + 1 };
    }

    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          edges: btTopology.edges.map((candidate) =>
            candidate.id === edgeId ? { ...candidate, conductors } : candidate
          )
        }
      },
      true
    );
    showToast(`+1 ${selectedConductor} no trecho ${edgeId}.`, 'success');
  };

  const handleBtQuickRemoveEdgeConductor = (edgeId: string, conductorName: string) => {
    const edge = btTopology.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      showToast('Condutor não encontrado', 'error');
      return;
    }

    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    if (conductors.length === 0) {
      showToast(`Trecho ${edgeId} sem condutor para reduzir.`, 'info');
      return;
    }

    const targetIndex = [...conductors]
      .map((entry, index) => ({ entry, index }))
      .reverse()
      .find(({ entry }) => entry.conductorName === selectedConductor)?.index;

    if (targetIndex === undefined) {
      showToast(`Trecho ${edgeId} sem ${selectedConductor} para reduzir.`, 'info');
      return;
    }

    const target = conductors[targetIndex];
    if (target.quantity > 1) {
      conductors[targetIndex] = { ...target, quantity: target.quantity - 1 };
    } else {
      conductors.splice(targetIndex, 1);
    }

    setAppState(
      {
        ...appState,
        btTopology: {
          ...btTopology,
          edges: btTopology.edges.map((candidate) =>
            candidate.id === edgeId ? { ...candidate, conductors } : candidate
          )
        }
      },
      true
    );
    showToast(`-1 ${selectedConductor} no trecho ${edgeId}.`, 'success');
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

  const handleResetBtTopology = () => {
    const hasBtData =
      btTopology.poles.length > 0 || btTopology.edges.length > 0 || btTopology.transformers.length > 0;
    if (!hasBtData && btExportSummary === null && btExportHistory.length === 0) {
      showToast('Topologia BT já está vazia.', 'info');
      return;
    }

    setResetConfirmOpen(true);
  };

  const handleConfirmResetBtTopology = () => {
    setResetConfirmOpen(false);
    setPendingBtEdgeStartPoleId(null);
    setPendingNormalClassificationPoles([]);
    setClandestinoToNormalModal(null);
    setNormalToClandestinoModal(null);
    setAppState(
      { ...appState, btTopology: EMPTY_BT_TOPOLOGY, btExportSummary: null, btExportHistory: [] },
      true
    );
    showToast('Topologia BT zerada.', 'success');
  };

  const clearBtExportHistory = () => {
    setAppState({ ...appState, btExportSummary: null, btExportHistory: [] }, true);
    showToast('Histórico BT limpo.', 'info');
  };

  const exportBtHistoryJson = () => {
    if (btExportHistory.length === 0) {
      showToast('Não há histórico BT para exportar.', 'info');
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      projectName: settings.projectMetadata.projectName,
      projectType: settings.projectType ?? 'ramais',
      totalEntries: btExportHistory.length,
      latest: btExportHistory[0],
      entries: btExportHistory
    };

    downloadBlob(
      JSON.stringify(payload, null, 2),
      'application/json',
      `${settings.projectMetadata.projectName}_bt_history.json`
    );
    showToast('Histórico BT exportado em JSON.', 'success');
  };

  const exportBtHistoryCsv = () => {
    if (btExportHistory.length === 0) {
      showToast('Não há histórico BT para exportar.', 'info');
      return;
    }

    const header = [
      'exportedAt',
      'projectType',
      'criticalPoleId',
      'criticalAccumulatedClients',
      'criticalAccumulatedDemandKva',
      'cqtScenario',
      'cqtDmdi',
      'cqtP31',
      'cqtP32',
      'cqtK10QtMttr',
      'cqtParityStatus',
      'cqtParityPassed',
      'cqtParityFailed',
      'btContextUrl',
      'verifiedPoles',
      'totalPoles',
      'verifiedEdges',
      'totalEdges',
      'verifiedTransformers',
      'totalTransformers'
    ];

    const rows = btExportHistory.map((entry) => [
      entry.exportedAt,
      entry.projectType,
      entry.criticalPoleId,
      entry.criticalAccumulatedClients,
      entry.criticalAccumulatedDemandKva.toFixed(2),
      entry.cqt?.scenario ?? '',
      entry.cqt?.dmdi?.toFixed(6) ?? '',
      entry.cqt?.p31?.toFixed(6) ?? '',
      entry.cqt?.p32?.toFixed(6) ?? '',
      entry.cqt?.k10QtMttr?.toFixed(9) ?? '',
      entry.cqt?.parityStatus ?? '',
      entry.cqt?.parityPassed ?? '',
      entry.cqt?.parityFailed ?? '',
      entry.btContextUrl,
      entry.verifiedPoles ?? 0,
      entry.totalPoles ?? 0,
      entry.verifiedEdges ?? 0,
      entry.totalEdges ?? 0,
      entry.verifiedTransformers ?? 0,
      entry.totalTransformers ?? 0
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsvCell(value)).join(';'))
      .join('\n');

    downloadBlob(csv, 'text/csv;charset=utf-8', `${settings.projectMetadata.projectName}_bt_history.csv`);
    showToast('Histórico BT exportado em CSV.', 'success');
  };

  const validateBtBeforeExport = (): boolean => {
    if (!settings.layers.btNetwork) {
      return true;
    }

    if (settings.projectType === 'clandestino') {
      const area = settings.clandestinoAreaM2 ?? 0;
      const areaRange = getClandestinoAreaRange();
      const clientsRange = getClandestinoClientsRange();

      if (!Number.isInteger(area)) {
        showToast('A área clandestina deve ser inteira para casar com a tabela da planilha.', 'error');
        return false;
      }

      if (getClandestinoKvaByArea(area) === null) {
        showToast(`Área clandestina fora da tabela (${areaRange.min}-${areaRange.max} m²).`, 'error');
        return false;
      }

      const totalClandestinoClients = btTopology.poles.reduce(
        (acc, pole) => acc + getPoleClandestinoClients(pole),
        0
      );

      if (getClandestinoDiversificationFactorByClients(totalClandestinoClients) === null) {
        showToast(
          `Total de clientes/ramais fora da tabela (${clientsRange.min}-${clientsRange.max}). Atual: ${totalClandestinoClients}.`,
          'error'
        );
        return false;
      }
    }

    const edgeWithoutConductors = btTopology.edges.find(
      (edge) => getEdgeChangeFlag(edge) !== 'remove' && edge.conductors.length === 0
    );
    if (edgeWithoutConductors) {
      showToast(`Trecho ${edgeWithoutConductors.id} sem condutores definidos.`, 'error');
      return false;
    }

    const replacementWithoutOutgoing = btTopology.edges.find(
      (edge) =>
        getEdgeChangeFlag(edge) === 'replace' &&
        (!edge.replacementFromConductors || edge.replacementFromConductors.length === 0)
    );
    if (replacementWithoutOutgoing) {
      showToast(`Trecho ${replacementWithoutOutgoing.id} em substituição sem condutor de saída definido.`, 'error');
      return false;
    }

    if (settings.projectType !== 'clandestino') {
      if (pendingNormalClassificationPoles.length > 0) {
        showToast('Existem postes com classificação de ramal pendente. Conclua antes de gerar DXF.', 'error');
        return false;
      }

      if (btTopology.transformers.length === 0) {
        showToast(
          'Adicione ao menos um transformador com leituras para calcular demanda de clientes normais.',
          'error'
        );
        return false;
      }

      const transformerWithoutReadings = btTopology.transformers.find(
        (transformer) => transformer.readings.length === 0
      );
      if (transformerWithoutReadings) {
        showToast(`Transformador ${transformerWithoutReadings.id} sem leituras.`, 'error');
        return false;
      }
    }

    return true;
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
    // ── State (needed by JSX) ──────────────────────────────────────────────
    btPoleCoordinateInput,
    setBtPoleCoordinateInput,
    pendingBtEdgeStartPoleId,
    clearPendingBtEdge,
    pendingNormalClassificationPoles,
    clandestinoToNormalModal,
    setClandestinoToNormalModal,
    normalToClandestinoModal,
    setNormalToClandestinoModal,
    normalRamalModal,
    setNormalRamalModal,
    isSidebarDockedForRamalModal: Boolean(normalRamalModal),
    // ── Handlers ──────────────────────────────────────────────────────────
    updateBtTopology,
    updateProjectType,
    updateClandestinoAreaM2,
    handleBtInsertPoleByCoordinates,
    handleBtMapClick,
    handleBtDeletePole,
    handleBtDeleteEdge,
    handleBtSetEdgeChangeFlag,
    handleBtSetPoleChangeFlag,
    handleBtTogglePoleCircuitBreak,
    handleBtSetTransformerChangeFlag,
    handleBtToggleEdgeRemoval,
    handleBtSetEdgeReplacementFromConductors,
    handleBtDeleteTransformer,
    handleBtToggleTransformerOnPole,
    handleBtDragPole,
    handleBtDragTransformer,
    handleBtRenamePole,
    handleBtRenameTransformer,
    handleBtSetPoleVerified,
    handleBtQuickAddPoleRamal,
    handleBtQuickRemovePoleRamal,
    handleBtQuickAddEdgeConductor,
    handleBtQuickRemoveEdgeConductor,
    handleConfirmNormalRamalModal,
    handleResetBtTopology,
    resetConfirmOpen,
    setResetConfirmOpen,
    handleConfirmResetBtTopology,
    clearBtExportHistory,
    exportBtHistoryJson,
    exportBtHistoryCsv,
    validateBtBeforeExport,
    handleClandestinoToNormalClassifyLater,
    handleClandestinoToNormalConvertNow,
    handleNormalToClandestinoKeepClients,
    handleNormalToClandestinoZeroNormalClients,
    // ── CQT helpers (re-exported for handleDownloadDxf in App) ────────────
    getPoleClandestinoClients,
    calculateClandestinoDemandKvaByAreaAndClients
  };
}
