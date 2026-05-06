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
  dgResults?: Record<string, unknown>;
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
  dgResults,
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
      dgResults,
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

    const header = ["X", "Y", "Z", "Name"];
    const rows: string[][] = [];

    const resolveZ = (item: unknown): number => {
      if (!item || typeof item !== "object") {
        return 0;
      }
      const record = item as Record<string, unknown>;
      const candidates = [record.Z, record.z, record.altitude, record.elevation];
      for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          return candidate;
        }
      }
      return 0;
    };

    // Process Poles
    allPoles.forEach((pole) => {
      const utm = toUtm(pole.lat, pole.lng);
      const z = resolveZ(pole);
      rows.push([
        utm.easting.toFixed(10),
        utm.northing.toFixed(10),
        z.toFixed(10),
        pole.title || pole.id,
      ]);
    });

    // Process Transformers (if not on poles or if we want them separate)
    btTopology.transformers.forEach((trafo) => {
      // Check if trafo is already represented by a pole
      if (!allPoles.some(p => p.id === trafo.poleId)) {
        const utm = toUtm(trafo.lat, trafo.lng);
        const z = resolveZ(trafo);
        rows.push([
          utm.easting.toFixed(10),
          utm.northing.toFixed(10),
          z.toFixed(10),
          trafo.title || trafo.id,
        ]);
      }
    });

    const csvContent = [
      header.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const projectName = settings.projectMetadata.projectName || "sisRUA";
    const firstReference =
      allPoles[0] ?? btTopology.transformers[0] ?? { lat: center.lat, lng: center.lng };
    const firstUtm = toUtm(firstReference.lat, firstReference.lng);
    const hemisphere = firstUtm.isSouth ? "s" : "n";
    const filename = `${projectName}_utm_${firstUtm.zone}${hemisphere}.csv`;

    downloadCsv(csvContent, filename);
    showToast(`Coordenadas exportadas: ${filename}`, "success");
  }, [btTopology, center.lat, center.lng, settings.projectMetadata.projectName, showToast]);

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
