import { useDxfExport } from './useDxfExport';
import { buildBtDxfContext } from '../utils/btDxfContext';
import type { AppSettings, BtNetworkScenario, BtTopology, GeoLocation, SelectionMode } from '../types';
import { fetchBtDerivedState } from '../services/btDerivedService';
import { calculateAccumulatedDemandByPole } from '../utils/btCalculations';

type Params = {
  center: GeoLocation;
  radius: number;
  selectionMode: SelectionMode;
  polygon: GeoLocation[];
  settings: AppSettings;
  btTopology: BtTopology;
  btNetworkScenario: BtNetworkScenario;
  hasOsmData: boolean;
  validateBtBeforeExport: () => boolean;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  ingestBtContextHistory: (btContextUrl: string, btContext: Record<string, unknown>) => Promise<void>;
};

export function useBtDxfWorkflow({
  center,
  radius,
  selectionMode,
  polygon,
  settings,
  btTopology,
  btNetworkScenario,
  hasOsmData,
  validateBtBeforeExport,
  showToast,
  ingestBtContextHistory,
}: Params) {
  const { downloadDxf, isDownloading, jobId, jobStatus, jobProgress } = useDxfExport({
    onSuccess: (message) => showToast(message, 'success'),
    onError: (message) => showToast(message, 'error'),
    onBtContextLoaded: ({ btContextUrl, btContext }) => {
      void ingestBtContextHistory(btContextUrl, btContext);
    }
  });

  const handleDownloadDxf = async () => {
    if (!hasOsmData) {
      return;
    }

    if (!validateBtBeforeExport()) {
      return;
    }

    const fallbackAccumulatedByPole = calculateAccumulatedDemandByPole(
      btTopology,
      settings.projectType ?? 'ramais',
      settings.clandestinoAreaM2 ?? 0
    );

    const derivedState = await fetchBtDerivedState({
      topology: btTopology,
      projectType: settings.projectType ?? 'ramais',
      clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
    }).catch(() => null);

    const btContext = buildBtDxfContext({
      btTopology,
      settings,
      btNetworkScenario,
      includeTopology: settings.layers.btNetwork,
      accumulatedByPole: derivedState?.accumulatedByPole ?? fallbackAccumulatedByPole,
    });

    await downloadDxf(
      center,
      radius,
      selectionMode,
      polygon,
      settings.layers,
      settings.projection,
      settings.contourRenderMode,
      btContext
    );
  };

  const handleDownloadGeoJSON = async () => {
    if (!hasOsmData) {
      return;
    }

    showToast('GeoJSON export not implemented in client yet.', 'info');
  };

  return {
    handleDownloadDxf,
    handleDownloadGeoJSON,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
  };
}