import { useCallback } from "react";
import { useDxfExport } from "./useDxfExport";
import { buildBtDxfContext } from "../utils/btDxfContext";
import type {
  AppSettings,
  BtNetworkScenario,
  BtTopology,
  GeoLocation,
  SelectionMode,
} from "../types";
import { fetchBtDerivedState } from "../services/btDerivedService";
import { calculateAccumulatedDemandByPole } from "../utils/btCalculations";

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
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
  ingestBtContextHistory: (
    btContextUrl: string,
    btContext: Record<string, unknown>,
  ) => Promise<void>;
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
  const handleDxfSuccess = useCallback(
    (message: string) => showToast(message, "success"),
    [showToast],
  );

  const handleDxfError = useCallback(
    (message: string) => showToast(message, "error"),
    [showToast],
  );

  const handleDxfWarning = useCallback(
    (message: string) => showToast(message, "warning"),
    [showToast],
  );

  const handleBtContextLoaded = useCallback(
    ({
      btContextUrl,
      btContext,
    }: {
      btContextUrl: string;
      btContext: Record<string, unknown>;
    }) => {
      void ingestBtContextHistory(btContextUrl, btContext);
    },
    [ingestBtContextHistory],
  );

  const { downloadDxf, isDownloading, jobId, jobStatus, jobProgress } =
    useDxfExport({
      onSuccess: handleDxfSuccess,
      onError: handleDxfError,
      onWarning: handleDxfWarning,
      onBtContextLoaded: handleBtContextLoaded,
    });

  const handleDownloadDxf = async () => {
    if (!hasOsmData) {
      showToast(
        "Sem dados no servidor, DXF será gerado com topologia BT.",
        "warning",
      );
    }

    if (!validateBtBeforeExport()) {
      return;
    }

    const fallbackAccumulatedByPole = calculateAccumulatedDemandByPole(
      btTopology,
      settings.projectType ?? "ramais",
      settings.clandestinoAreaM2 ?? 0,
    );

    const derivedState = await fetchBtDerivedState({
      topology: btTopology,
      projectType: settings.projectType ?? "ramais",
      clandestinoAreaM2: settings.clandestinoAreaM2 ?? 0,
    }).catch(() => null);

    const btContext = buildBtDxfContext({
      btTopology,
      settings,
      btNetworkScenario,
      includeTopology: settings.layers.btNetwork,
      accumulatedByPole:
        derivedState?.accumulatedByPole ?? fallbackAccumulatedByPole,
    });

    await downloadDxf(
      center,
      radius,
      selectionMode,
      polygon,
      settings.layers,
      settings.projection,
      settings.contourRenderMode,
      btContext,
      {
        projectName: settings.projectMetadata.projectName,
        companyName: settings.projectMetadata.companyName,
        engineerName: settings.projectMetadata.engineerName,
        revision: settings.projectMetadata.revision,
        date: settings.projectMetadata.date,
      },
    );
  };

  const handleDownloadGeoJSON = async () => {
    if (!hasOsmData) {
      return;
    }

    showToast("GeoJSON export not implemented in client yet.", "info");
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
