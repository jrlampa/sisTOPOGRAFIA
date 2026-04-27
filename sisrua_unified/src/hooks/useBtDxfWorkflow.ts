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
import { toUtm } from "../utils/geo";
import { downloadCsv } from "../utils/downloads";

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
      settings.exportMemorialPdfWithDxf,
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

  const handleDownloadCoordinatesCsv = useCallback(() => {
    const allPoles = [...btTopology.poles];
    // Add MT poles if they are not already in BT poles (usually they are merged in derived state)
    // But for safety, let's just use what's in btTopology.
    
    if (allPoles.length === 0 && btTopology.transformers.length === 0) {
      showToast("Não há elementos na topologia para exportar.", "info");
      return;
    }

    const header = ["Nome", "Easting", "Northing", "Lat", "Lng", "Zona"];
    const rows: string[][] = [];

    // Process Poles
    allPoles.forEach((pole) => {
      const utm = toUtm(pole.lat, pole.lng);
      rows.push([
        pole.title || pole.id,
        utm.easting.toFixed(3),
        utm.northing.toFixed(3),
        pole.lat.toFixed(7),
        pole.lng.toFixed(7),
        `${utm.zone}${utm.band}${utm.isSouth ? "S" : "N"}`,
      ]);
    });

    // Process Transformers (if not on poles or if we want them separate)
    btTopology.transformers.forEach((trafo) => {
      // Check if trafo is already represented by a pole
      if (!allPoles.some(p => p.id === trafo.poleId)) {
        const utm = toUtm(trafo.lat, trafo.lng);
        rows.push([
          trafo.title || trafo.id,
          utm.easting.toFixed(3),
          utm.northing.toFixed(3),
          trafo.lat.toFixed(7),
          trafo.lng.toFixed(7),
          `${utm.zone}${utm.band}${utm.isSouth ? "S" : "N"}`,
        ]);
      }
    });

    const csvContent = [
      header.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const projectName = settings.projectMetadata.projectName || "sisRUA";
    const utmZone = rows.length > 0 ? rows[0][5].toLowerCase() : "utm";
    const filename = `${projectName}_${utmZone}.csv`;

    downloadCsv(csvContent, filename);
    showToast(`Coordenadas exportadas: ${filename}`, "success");
  }, [btTopology, settings.projectMetadata.projectName, showToast]);

  return {
    handleDownloadDxf,
    handleDownloadGeoJSON,
    handleDownloadCoordinatesCsv,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
  };
}
