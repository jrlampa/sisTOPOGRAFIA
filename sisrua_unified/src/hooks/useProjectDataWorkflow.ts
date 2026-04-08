import { useFileOperations } from './useFileOperations';
import { useKmlImport } from './useKmlImport';
import { nextSequentialId } from '../utils/btNormalization';
import type { BtPoleNode, GlobalState } from '../types';

type Params = {
  appState: GlobalState;
  setAppState: (state: GlobalState, addToHistory: boolean) => void;
  clearData: () => void;
  clearPendingBtEdge: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
};

export function useProjectDataWorkflow({
  appState,
  setAppState,
  clearData,
  clearPendingBtEdge,
  showToast,
}: Params) {
  const btTopology = appState.btTopology ?? { poles: [], transformers: [], edges: [] };

  const { importKml } = useKmlImport({
    onImportSuccess: (result, filename) => {
      if (result.type === 'polygon') {
        setAppState({
          ...appState,
          selectionMode: 'polygon',
          polygon: result.points,
          center: { ...result.points[0], label: filename }
        }, true);
        clearData();
        showToast('KML/KMZ importado com sucesso', 'success');
        return;
      }

      let runningIds = btTopology.poles.map((pole) => pole.id);
      const newPoles: BtPoleNode[] = result.points.map((point, index) => {
        const id = nextSequentialId(runningIds, 'P');
        runningIds = [...runningIds, id];
        const name = result.names?.[index];

        return {
          id,
          lat: point.lat,
          lng: point.lng,
          title: name ?? `Poste ${id}`,
          ramais: []
        };
      });

      setAppState({
        ...appState,
        center: { ...result.points[0], label: filename },
        btTopology: {
          ...btTopology,
          poles: [...btTopology.poles, ...newPoles]
        }
      }, true);
      showToast(`${newPoles.length} poste(s) importado(s) do KMZ`, 'success');
    },
    onError: (message) => showToast(message, 'error')
  });

  const { saveProject, loadProject } = useFileOperations({
    appState,
    setAppState,
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error')
  });

  const handleKmlDrop = async (file: File) => {
    await importKml(file);
  };

  const handleSaveProject = () => {
    saveProject();
  };

  const handleLoadProject = (file: File) => {
    clearPendingBtEdge();
    loadProject(file);
  };

  return {
    handleKmlDrop,
    handleSaveProject,
    handleLoadProject,
  };
}