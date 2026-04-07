import { useState, useMemo } from 'react';
import {
  GlobalState, BtTopology, BtPoleNode, BtTransformer, BtExportSummary,
  BtExportHistoryEntry, GeoLocation, BtNetworkScenario, BtEditorMode, BtCqtComputationInputs
} from '../types';
import { ToastType } from '../components/Toast';
import {
  EMPTY_BT_TOPOLOGY, MAX_BT_EXPORT_HISTORY, NORMAL_CLIENT_RAMAL_TYPES,
  CLANDESTINO_RAMAL_TYPE, DEFAULT_EDGE_CONDUCTOR, PendingNormalClassificationPole
} from '../constants/btConstants';
import { distanceMeters, inferBranchSide, nextSequentialId, downloadBlob } from '../utils/appUtils';
import { downloadBtHistoryCsv, downloadBtHistoryJson } from '../utils/btCsvExport';
import {
  calculateAccumulatedDemandByPole, calculateClandestinoDemandKvaByAreaAndClients,
  getClandestinoAreaRange, getClandestinoClientsRange,
  getClandestinoDiversificationFactorByClients, getClandestinoKvaByArea
} from '../utils/btCalculations';
import { parseLatLngQuery, parseUtmQuery } from '../utils/geo';

interface UseBtTopologyParams {
  appState: GlobalState;
  setAppState: (state: GlobalState, saveToHistory: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
}

export function useBtTopology({ appState, setAppState, showToast }: UseBtTopologyParams) {
  const { settings } = appState;
  const btTopology = appState.btTopology ?? EMPTY_BT_TOPOLOGY;
  const btExportSummary = appState.btExportSummary ?? null;
  const btExportHistory = appState.btExportHistory ?? [];
  const latestBtExport = btExportSummary ?? btExportHistory[0] ?? null;
  const btNetworkScenario: BtNetworkScenario = settings.btNetworkScenario ?? 'asis';
  const btEditorMode: BtEditorMode = settings.btEditorMode ?? 'none';

  const [pendingBtEdgeStartPoleId, setPendingBtEdgeStartPoleId] = useState<string | null>(null);
  const [pendingNormalClassificationPoles, setPendingNormalClassificationPoles] = useState<PendingNormalClassificationPole[]>([]);
  const [normalRamalModal, setNormalRamalModal] = useState<{
    poleId: string;
    poleTitle: string;
    ramalType: string;
    quantity: number;
  } | null>(null);
  const [clandestinoToNormalModal, setClandestinoToNormalModal] = useState<{
    poles: PendingNormalClassificationPole[];
  } | null>(null);
  const [normalToClandestinoModal, setNormalToClandestinoModal] = useState<{
    totalNormalClients: number;
  } | null>(null);
  const [btPoleCoordinateInput, setBtPoleCoordinateInput] = useState('');

  const btAccumulatedByPole = useMemo(
    () => calculateAccumulatedDemandByPole(btTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0),
    [btTopology, settings.projectType, settings.clandestinoAreaM2]
  );
  const btCriticalPoleId = btAccumulatedByPole[0]?.poleId ?? null;
  const isSidebarDockedForRamalModal = Boolean(normalRamalModal);

  // Internal helpers
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

  const findNearestPole = (location: GeoLocation, maxDistanceMeters = 80): BtPoleNode | null => {
    if (btTopology.poles.length === 0) return null;
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

  const applyProjectTypeSwitch = (nextProjectType: 'ramais' | 'clandestino', nextTopology: BtTopology = btTopology) => {
    setAppState({
      ...appState,
      btTopology: nextTopology,
      settings: { ...settings, projectType: nextProjectType }
    }, true);
  };

  // Public handlers
  const updateBtTopology = (nextTopology: BtTopology) => {
    setAppState({ ...appState, btTopology: nextTopology }, true);
  };

  const updateProjectType = (nextProjectType: 'ramais' | 'clandestino') => {
    const currentProjectType = settings.projectType ?? 'ramais';
    if (currentProjectType === nextProjectType) return;

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
    setAppState({ ...appState, settings: { ...settings, projectType: nextProjectType } }, true);
  };

  const updateClandestinoAreaM2 = (nextAreaM2: number) => {
    setAppState({ ...appState, settings: { ...settings, clandestinoAreaM2: nextAreaM2 } }, true);
  };

  const handleClandestinoToNormalClassifyLater = () => {
    if (!clandestinoToNormalModal) return;
    setPendingNormalClassificationPoles(clandestinoToNormalModal.poles);
    applyProjectTypeSwitch('ramais');
    setClandestinoToNormalModal(null);
    showToast('Projeto mudou para Normal. Classificação de ramais pendente (DXF bloqueado).', 'info');
  };

  const handleClandestinoToNormalConvertNow = () => {
    if (!clandestinoToNormalModal) return;
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
        ramais: (pole.ramais ?? []).filter((ramal) => (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE)
      }))
    };
    setPendingNormalClassificationPoles([]);
    applyProjectTypeSwitch('clandestino', cleanedTopology);
    setNormalToClandestinoModal(null);
    showToast('Clientes normais zerados. Apenas ramais clandestinos foram mantidos.', 'success');
  };

  const handleResetBtTopology = () => {
    const hasBtData = btTopology.poles.length > 0 || btTopology.edges.length > 0 || btTopology.transformers.length > 0;
    if (!hasBtData && btExportSummary === null && btExportHistory.length === 0) {
      showToast('Topologia BT já está vazia.', 'info');
      return;
    }
    const confirmed = window.confirm('Zerar toda a topologia BT? Isso removerá postes, condutores, trafos e histórico BT.');
    if (!confirmed) return;
    setPendingBtEdgeStartPoleId(null);
    setPendingNormalClassificationPoles([]);
    setClandestinoToNormalModal(null);
    setNormalToClandestinoModal(null);
    setAppState({ ...appState, btTopology: EMPTY_BT_TOPOLOGY, btExportSummary: null, btExportHistory: [] }, true);
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
    downloadBtHistoryJson(btExportHistory, settings.projectMetadata.projectName, settings.projectType ?? 'ramais');
    showToast('Histórico BT exportado em JSON.', 'success');
  };

  const exportBtHistoryCsv = () => {
    if (btExportHistory.length === 0) {
      showToast('Não há histórico BT para exportar.', 'info');
      return;
    }
    downloadBtHistoryCsv(btExportHistory, settings.projectMetadata.projectName);
    showToast('Histórico BT exportado em CSV.', 'success');
  };

  const validateBtBeforeExport = (): boolean => {
    if (!settings.layers.btNetwork) return true;

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
      const totalClandestinoClients = btTopology.poles.reduce((acc, pole) => acc + getPoleClandestinoClients(pole), 0);
      if (getClandestinoDiversificationFactorByClients(totalClandestinoClients) === null) {
        showToast(
          `Total de clientes/ramais fora da tabela (${clientsRange.min}-${clientsRange.max}). Atual: ${totalClandestinoClients}.`,
          'error'
        );
        return false;
      }
    }

    const edgeWithoutConductors = btTopology.edges.find((edge) => edge.conductors.length === 0);
    if (edgeWithoutConductors) {
      showToast(`Trecho ${edgeWithoutConductors.id} sem condutores definidos.`, 'error');
      return false;
    }

    if (settings.projectType !== 'clandestino') {
      if (pendingNormalClassificationPoles.length > 0) {
        showToast('Existem postes com classificação de ramal pendente. Conclua antes de gerar DXF.', 'error');
        return false;
      }
      if (btTopology.transformers.length === 0) {
        showToast('Adicione ao menos um transformador com leituras para calcular demanda de clientes normais.', 'error');
        return false;
      }
      const transformerWithoutReadings = btTopology.transformers.find((t) => t.readings.length === 0);
      if (transformerWithoutReadings) {
        showToast(`Transformador ${transformerWithoutReadings.id} sem leituras.`, 'error');
        return false;
      }
    }

    return true;
  };

  const insertBtPoleAtLocation = (location: GeoLocation) => {
    const nextId = nextSequentialId(btTopology.poles.map((pole) => pole.id), 'P');
    const nextPole: BtPoleNode = {
      id: nextId,
      lat: location.lat,
      lng: location.lng,
      title: `Poste ${nextId}`,
      ramais: []
    };
    setAppState({
      ...appState,
      center: { lat: location.lat, lng: location.lng, label: location.label ?? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` },
      btTopology: { ...btTopology, poles: [...btTopology.poles, nextPole] }
    }, true);
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
    if (btEditorMode === 'none' || btEditorMode === 'move-pole') return;

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
      const existingOnPole = btTopology.transformers.find((t) => {
        if (t.poleId) return t.poleId === nearestPole.id;
        return distanceMeters({ lat: t.lat, lng: t.lng }, { lat: nearestPole.lat, lng: nearestPole.lng }) <= 6;
      });
      if (existingOnPole) {
        showToast(`${nearestPole.title} já possui transformador`, 'info');
        return;
      }
      const nextId = nextSequentialId(btTopology.transformers.map((t) => t.id), 'TR');
      const nextTransformer: BtTransformer = {
        id: nextId,
        poleId: nearestPole.id,
        lat: nearestPole.lat,
        lng: nearestPole.lng,
        title: `Transformador ${nextId}`,
        projectPowerKva: 0,
        monthlyBillBrl: 0,
        demandKw: 0,
        readings: []
      };
      setAppState({ ...appState, btTopology: { ...btTopology, transformers: [...btTopology.transformers, nextTransformer] } }, true);
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
      const alreadyConnected = btTopology.edges.some((edge) =>
        (edge.fromPoleId === fromPole.id && edge.toPoleId === nearestPole.id) ||
        (edge.fromPoleId === nearestPole.id && edge.toPoleId === fromPole.id)
      );
      if (alreadyConnected) {
        setPendingBtEdgeStartPoleId(nearestPole.id);
        showToast(`Já existe condutor entre ${fromPole.id} <-> ${nearestPole.id}. Nova origem: ${nearestPole.id}`, 'info');
        return;
      }
      const edgeId = nextSequentialId(btTopology.edges.map((edge) => edge.id), 'E');
      const lengthMeters = Math.round(distanceMeters(
        { lat: fromPole.lat, lng: fromPole.lng },
        { lat: nearestPole.lat, lng: nearestPole.lng }
      ));
      setAppState({
        ...appState,
        btTopology: {
          ...btTopology,
          edges: [...btTopology.edges, { id: edgeId, fromPoleId: fromPole.id, toPoleId: nearestPole.id, lengthMeters, conductors: [] }]
        }
      }, true);
      setPendingBtEdgeStartPoleId(nearestPole.id);
      showToast(`Condutor ${edgeId} criado (${lengthMeters}m). Nova origem: ${nearestPole.id}`, 'success');
    }
  };

  const handleBtDeletePole = (poleId: string) => {
    const pole = btTopology.poles.find((c) => c.id === poleId);
    const transformerIdsToRemove = new Set(
      btTopology.transformers
        .filter((t) => {
          if (t.poleId) return t.poleId === poleId;
          if (!pole) return false;
          return distanceMeters({ lat: t.lat, lng: t.lng }, { lat: pole.lat, lng: pole.lng }) <= 6;
        })
        .map((t) => t.id)
    );
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.filter((p) => p.id !== poleId),
        edges: btTopology.edges.filter((e) => e.fromPoleId !== poleId && e.toPoleId !== poleId),
        transformers: btTopology.transformers.filter((t) => !transformerIdsToRemove.has(t.id))
      }
    }, true);
    showToast(`Poste ${poleId} removido`, 'info');
  };

  const handleBtDeleteEdge = (edgeId: string) => {
    setAppState({ ...appState, btTopology: { ...btTopology, edges: btTopology.edges.filter((e) => e.id !== edgeId) } }, true);
    showToast(`Condutor ${edgeId} removido`, 'info');
  };

  const handleBtDeleteTransformer = (transformerId: string) => {
    setAppState({ ...appState, btTopology: { ...btTopology, transformers: btTopology.transformers.filter((t) => t.id !== transformerId) } }, true);
    showToast(`Transformador ${transformerId} removido`, 'info');
  };

  const handleBtToggleTransformerOnPole = (poleId: string) => {
    const pole = btTopology.poles.find((c) => c.id === poleId);
    if (!pole) { showToast('Poste não encontrado', 'error'); return; }
    const transformersOnPole = btTopology.transformers.filter((t) => {
      if (t.poleId) return t.poleId === poleId;
      return distanceMeters({ lat: t.lat, lng: t.lng }, { lat: pole.lat, lng: pole.lng }) <= 6;
    });
    if (transformersOnPole.length === 0) {
      const nextId = nextSequentialId(btTopology.transformers.map((t) => t.id), 'TR');
      const nextTransformer: BtTransformer = {
        id: nextId, poleId, lat: pole.lat, lng: pole.lng,
        title: `Transformador ${nextId}`, projectPowerKva: 0, monthlyBillBrl: 0, demandKw: 0, readings: []
      };
      setAppState({ ...appState, btTopology: { ...btTopology, transformers: [...btTopology.transformers, nextTransformer] } }, true);
      showToast(`Transformador adicionado em ${pole.title}`, 'success');
      return;
    }
    const removeIds = new Set(transformersOnPole.map((t) => t.id));
    setAppState({ ...appState, btTopology: { ...btTopology, transformers: btTopology.transformers.filter((t) => !removeIds.has(t.id)) } }, true);
    showToast(`Transformador removido de ${pole.title}`, 'success');
  };

  const handleBtDragPole = (poleId: string, lat: number, lng: number) => {
    const updatedPoles = btTopology.poles.map((p) => p.id === poleId ? { ...p, lat, lng } : p);
    const updatedTransformers = btTopology.transformers.map((t) => t.poleId === poleId ? { ...t, lat, lng } : t);
    const updatedEdges = btTopology.edges.map((edge) => {
      const from = updatedPoles.find((p) => p.id === edge.fromPoleId);
      const to = updatedPoles.find((p) => p.id === edge.toPoleId);
      if (!from || !to) return edge;
      const newLength = Math.round(distanceMeters({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }));
      return { ...edge, lengthMeters: newLength };
    });
    setAppState({ ...appState, btTopology: { ...btTopology, poles: updatedPoles, transformers: updatedTransformers, edges: updatedEdges } }, true);
  };

  const handleBtDragTransformer = (transformerId: string, lat: number, lng: number) => {
    const nearestPole = findNearestPole({ lat, lng });
    if (!nearestPole) { showToast('Trafo deve permanecer atrelado a um poste', 'error'); return; }
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        transformers: btTopology.transformers.map((t) =>
          t.id === transformerId ? { ...t, poleId: nearestPole.id, lat: nearestPole.lat, lng: nearestPole.lng } : t
        )
      }
    }, true);
  };

  const handleBtRenamePole = (poleId: string, title: string) => {
    setAppState({ ...appState, btTopology: { ...btTopology, poles: btTopology.poles.map((p) => p.id === poleId ? { ...p, title } : p) } }, true);
  };

  const handleBtRenameTransformer = (transformerId: string, title: string) => {
    setAppState({ ...appState, btTopology: { ...btTopology, transformers: btTopology.transformers.map((t) => t.id === transformerId ? { ...t, title } : t) } }, true);
  };

  const handleBtSetPoleVerified = (poleId: string, verified: boolean) => {
    setAppState({ ...appState, btTopology: { ...btTopology, poles: btTopology.poles.map((p) => p.id === poleId ? { ...p, verified } : p) } }, true);
  };

  const handleBtQuickAddPoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((c) => c.id === poleId);
    if (!pole) { showToast('Poste não encontrado', 'error'); return; }
    if ((settings.projectType ?? 'ramais') !== 'clandestino') {
      setNormalRamalModal({ poleId, poleTitle: pole.title, ramalType: NORMAL_CLIENT_RAMAL_TYPES[0], quantity: 1 });
      return;
    }
    const nextRamalId = `RP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((c) =>
          c.id === poleId ? { ...c, ramais: [...(c.ramais ?? []), { id: nextRamalId, quantity: 1, ramalType: CLANDESTINO_RAMAL_TYPE }] } : c
        )
      }
    }, true);
    showToast(`+1 ramal em ${pole.title}.`, 'success');
  };

  const handleBtQuickRemovePoleRamal = (poleId: string) => {
    const pole = btTopology.poles.find((c) => c.id === poleId);
    if (!pole) { showToast('Poste não encontrado', 'error'); return; }
    const ramais = [...(pole.ramais ?? [])];
    if (ramais.length === 0) { showToast(`${pole.title} sem ramais para reduzir.`, 'info'); return; }
    const isClandestinoMode = (settings.projectType ?? 'ramais') === 'clandestino';
    const targetIndex = [...ramais].map((ramal, index) => ({ ramal, index })).reverse()
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
    setAppState({ ...appState, btTopology: { ...btTopology, poles: btTopology.poles.map((c) => c.id === poleId ? { ...c, ramais } : c) } }, true);
    showToast(`-1 ramal em ${pole.title}.`, 'success');
  };

  const handleBtQuickAddEdgeConductor = (edgeId: string, conductorName: string) => {
    const edge = btTopology.edges.find((c) => c.id === edgeId);
    if (!edge) { showToast('Condutor não encontrado', 'error'); return; }
    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    const existingIndex = conductors.findIndex((e) => e.conductorName === selectedConductor);
    if (existingIndex === -1) {
      conductors.push({ id: `C${Date.now()}${Math.floor(Math.random() * 1000)}`, quantity: 1, conductorName: selectedConductor });
    } else {
      const target = conductors[existingIndex];
      conductors[existingIndex] = { ...target, quantity: target.quantity + 1 };
    }
    setAppState({ ...appState, btTopology: { ...btTopology, edges: btTopology.edges.map((c) => c.id === edgeId ? { ...c, conductors } : c) } }, true);
    showToast(`+1 ${selectedConductor} no trecho ${edgeId}.`, 'success');
  };

  const handleBtQuickRemoveEdgeConductor = (edgeId: string, conductorName: string) => {
    const edge = btTopology.edges.find((c) => c.id === edgeId);
    if (!edge) { showToast('Condutor não encontrado', 'error'); return; }
    const selectedConductor = conductorName || DEFAULT_EDGE_CONDUCTOR;
    const conductors = [...edge.conductors];
    if (conductors.length === 0) { showToast(`Trecho ${edgeId} sem condutor para reduzir.`, 'info'); return; }
    const targetIndex = [...conductors].map((e, i) => ({ e, i })).reverse().find(({ e }) => e.conductorName === selectedConductor)?.i;
    if (targetIndex === undefined) { showToast(`Trecho ${edgeId} sem ${selectedConductor} para reduzir.`, 'info'); return; }
    const target = conductors[targetIndex];
    if (target.quantity > 1) {
      conductors[targetIndex] = { ...target, quantity: target.quantity - 1 };
    } else {
      conductors.splice(targetIndex, 1);
    }
    setAppState({ ...appState, btTopology: { ...btTopology, edges: btTopology.edges.map((c) => c.id === edgeId ? { ...c, conductors } : c) } }, true);
    showToast(`-1 ${selectedConductor} no trecho ${edgeId}.`, 'success');
  };

  const handleConfirmNormalRamalModal = () => {
    if (!normalRamalModal) return;
    const quantity = Math.max(1, Math.round(normalRamalModal.quantity));
    const nextRamalId = `RP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    setAppState({
      ...appState,
      btTopology: {
        ...btTopology,
        poles: btTopology.poles.map((c) =>
          c.id === normalRamalModal.poleId
            ? { ...c, ramais: [...(c.ramais ?? []), { id: nextRamalId, quantity, ramalType: normalRamalModal.ramalType }] }
            : c
        )
      }
    }, true);
    setPendingNormalClassificationPoles((current) => current.filter((e) => e.poleId !== normalRamalModal.poleId));
    showToast(`${quantity} ramal(is) ${normalRamalModal.ramalType} em ${normalRamalModal.poleTitle}.`, 'success');
    setNormalRamalModal(null);
  };

  const handleBtContextLoaded = ({ btContextUrl, btContext, cqtSummary: cqtSummaryRaw }: {
    btContextUrl: string;
    btContext: Record<string, unknown>;
    cqtSummary: unknown;
  }) => {
    const criticalPoleRaw = btContext.criticalPole;
    if (!criticalPoleRaw || typeof criticalPoleRaw !== 'object') return;
    const criticalPole = criticalPoleRaw as Record<string, unknown>;
    const poleId = typeof criticalPole.poleId === 'string' ? criticalPole.poleId : '';
    if (!poleId) return;
    const accumulatedClients = typeof criticalPole.accumulatedClients === 'number' ? criticalPole.accumulatedClients : 0;
    const accumulatedDemandKva = typeof criticalPole.accumulatedDemandKva === 'number' ? criticalPole.accumulatedDemandKva : 0;
    const verifiedPoles = typeof btContext.verifiedPoles === 'number' ? btContext.verifiedPoles : 0;
    const totalPoles = typeof btContext.totalPoles === 'number' ? btContext.totalPoles : 0;
    const verifiedEdges = typeof btContext.verifiedEdges === 'number' ? btContext.verifiedEdges : 0;
    const totalEdges = typeof btContext.totalEdges === 'number' ? btContext.totalEdges : 0;
    const verifiedTransformers = typeof btContext.verifiedTransformers === 'number' ? btContext.verifiedTransformers : 0;
    const totalTransformers = typeof btContext.totalTransformers === 'number' ? btContext.totalTransformers : 0;
    const cqtSnapshotRaw = btContext.cqtSnapshot;
    const cqtSnapshot = cqtSnapshotRaw && typeof cqtSnapshotRaw === 'object' ? cqtSnapshotRaw as Record<string, unknown> : null;
    const cqtGeral = cqtSnapshot?.geral && typeof cqtSnapshot.geral === 'object' ? cqtSnapshot.geral as Record<string, unknown> : null;
    const cqtDb = cqtSnapshot?.db && typeof cqtSnapshot.db === 'object' ? cqtSnapshot.db as Record<string, unknown> : null;
    const cqtDmdi = cqtSnapshot?.dmdi && typeof cqtSnapshot.dmdi === 'object' ? cqtSnapshot.dmdi as Record<string, unknown> : null;
    const cqtParity = cqtSnapshot?.parity && typeof cqtSnapshot.parity === 'object' ? cqtSnapshot.parity as Record<string, unknown> : null;
    const cqtSummaryFromResponse = cqtSummaryRaw && typeof cqtSummaryRaw === 'object' ? cqtSummaryRaw as Record<string, unknown> : null;
    const cqtSummaryFromSnapshot = cqtSnapshot ? {
      scenario: typeof cqtSnapshot.scenario === 'string' ? cqtSnapshot.scenario as 'atual' | 'proj1' | 'proj2' : undefined,
      dmdi: typeof cqtDmdi?.dmdi === 'number' ? cqtDmdi.dmdi : undefined,
      p31: typeof cqtGeral?.p31CqtNoPonto === 'number' ? cqtGeral.p31CqtNoPonto : undefined,
      p32: typeof cqtGeral?.p32CqtNoPonto === 'number' ? cqtGeral.p32CqtNoPonto : undefined,
      k10QtMttr: typeof cqtDb?.k10QtMttr === 'number' ? cqtDb.k10QtMttr : undefined,
      parityStatus: typeof cqtParity?.referenceStatus === 'string' ? cqtParity.referenceStatus as 'complete' | 'partial' | 'missing' : undefined,
      parityPassed: typeof cqtParity?.passed === 'number' ? cqtParity.passed : undefined,
      parityFailed: typeof cqtParity?.failed === 'number' ? cqtParity.failed : undefined
    } : undefined;
    const cqtSummary = cqtSnapshot || cqtSummaryFromResponse ? {
      scenario: cqtSummaryFromSnapshot?.scenario ?? (typeof cqtSummaryFromResponse?.scenario === 'string' ? cqtSummaryFromResponse.scenario as 'atual' | 'proj1' | 'proj2' : undefined),
      dmdi: cqtSummaryFromSnapshot?.dmdi ?? (typeof cqtSummaryFromResponse?.dmdi === 'number' ? cqtSummaryFromResponse.dmdi : undefined),
      p31: cqtSummaryFromSnapshot?.p31 ?? (typeof cqtSummaryFromResponse?.p31 === 'number' ? cqtSummaryFromResponse.p31 : undefined),
      p32: cqtSummaryFromSnapshot?.p32 ?? (typeof cqtSummaryFromResponse?.p32 === 'number' ? cqtSummaryFromResponse.p32 : undefined),
      k10QtMttr: cqtSummaryFromSnapshot?.k10QtMttr ?? (typeof cqtSummaryFromResponse?.k10QtMttr === 'number' ? cqtSummaryFromResponse.k10QtMttr : undefined),
      parityStatus: cqtSummaryFromSnapshot?.parityStatus ?? (typeof cqtSummaryFromResponse?.parityStatus === 'string' ? cqtSummaryFromResponse.parityStatus as 'complete' | 'partial' | 'missing' : undefined),
      parityPassed: cqtSummaryFromSnapshot?.parityPassed ?? (typeof cqtSummaryFromResponse?.parityPassed === 'number' ? cqtSummaryFromResponse.parityPassed : undefined),
      parityFailed: cqtSummaryFromSnapshot?.parityFailed ?? (typeof cqtSummaryFromResponse?.parityFailed === 'number' ? cqtSummaryFromResponse.parityFailed : undefined)
    } : undefined;
    const nextBtExportSummary: BtExportSummary = {
      btContextUrl, criticalPoleId: poleId, criticalAccumulatedClients: accumulatedClients,
      criticalAccumulatedDemandKva: accumulatedDemandKva, cqt: cqtSummary,
      verifiedPoles, totalPoles, verifiedEdges, totalEdges, verifiedTransformers, totalTransformers
    };
    const historyEntry: BtExportHistoryEntry = {
      ...nextBtExportSummary,
      exportedAt: new Date().toISOString(),
      projectType: settings.projectType ?? 'ramais'
    };
    const nextHistory = [historyEntry, ...(appState.btExportHistory ?? [])].slice(0, MAX_BT_EXPORT_HISTORY);
    setAppState({ ...appState, btExportSummary: nextBtExportSummary, btExportHistory: nextHistory }, false);
    const cqtScenarioLabel = cqtSummary?.scenario ? ` | CQT ${cqtSummary.scenario.toUpperCase()}` : '';
    showToast(`Resumo BT: ponto crítico ${poleId} (${accumulatedDemandKva.toFixed(2)})${cqtScenarioLabel}.`, 'info');
  };

  const buildBtContext = () => {
    const btAccumulated = calculateAccumulatedDemandByPole(btTopology, settings.projectType ?? 'ramais', settings.clandestinoAreaM2 ?? 0);
    const totalClientsX = btTopology.poles.reduce((sum, pole) => {
      const poleClients = (pole.ramais ?? []).reduce((poleSum, ramal) => {
        const isClandestino = (ramal.ramalType ?? CLANDESTINO_RAMAL_TYPE) === CLANDESTINO_RAMAL_TYPE;
        if ((settings.projectType ?? 'ramais') === 'clandestino') return isClandestino ? poleSum + ramal.quantity : poleSum;
        return isClandestino ? poleSum : poleSum + ramal.quantity;
      }, 0);
      return sum + poleClients;
    }, 0);
    const aa24DemandBase = btTopology.transformers.reduce((sum, t) => sum + (t.demandKw ?? 0), 0);
    const ab35LookupDmdi = calculateClandestinoDemandKvaByAreaAndClients(settings.clandestinoAreaM2 ?? 0, totalClientsX);
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
      dmdi: { clandestinoEnabled: (settings.projectType ?? 'ramais') === 'clandestino', aa24DemandBase, sumClientsX: totalClientsX, ab35LookupDmdi },
      db: { trAtual: btTopology.transformers.reduce((sum, t) => sum + (t.projectPowerKva ?? 0), 0), demAtual: aa24DemandBase, qtMt: 0 },
      branches: cqtBranches
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
      topology: settings.layers.btNetwork ? {
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
  };

  // Expose downloadBlob for use in App.tsx handleDownloadGeoJSON if needed
  void downloadBlob;

  return {
    btTopology, btExportSummary, btExportHistory, latestBtExport,
    btNetworkScenario, btEditorMode, btAccumulatedByPole, btCriticalPoleId,
    pendingBtEdgeStartPoleId, setPendingBtEdgeStartPoleId,
    pendingNormalClassificationPoles,
    normalRamalModal, setNormalRamalModal,
    clandestinoToNormalModal, setClandestinoToNormalModal,
    normalToClandestinoModal, setNormalToClandestinoModal,
    btPoleCoordinateInput, setBtPoleCoordinateInput,
    isSidebarDockedForRamalModal,
    updateBtTopology, updateProjectType, updateClandestinoAreaM2,
    handleClandestinoToNormalClassifyLater, handleClandestinoToNormalConvertNow,
    handleNormalToClandestinoKeepClients, handleNormalToClandestinoZeroNormalClients,
    handleResetBtTopology, clearBtExportHistory, exportBtHistoryJson, exportBtHistoryCsv,
    validateBtBeforeExport, insertBtPoleAtLocation, handleBtInsertPoleByCoordinates,
    handleBtMapClick, handleBtDeletePole, handleBtDeleteEdge, handleBtDeleteTransformer,
    handleBtToggleTransformerOnPole, handleBtDragPole, handleBtDragTransformer,
    handleBtRenamePole, handleBtRenameTransformer, handleBtSetPoleVerified,
    handleBtQuickAddPoleRamal, handleBtQuickRemovePoleRamal,
    handleBtQuickAddEdgeConductor, handleBtQuickRemoveEdgeConductor,
    handleConfirmNormalRamalModal, handleBtContextLoaded, buildBtContext
  };
}
