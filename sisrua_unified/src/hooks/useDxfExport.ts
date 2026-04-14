import { useEffect, useState } from "react";
import { z } from "zod";
import { generateDXF, getDxfJobStatus } from "../services/dxfService";
import { SelectionMode, GeoLocation, LayerConfig } from "../types";
import { validateDxfExportInputs } from "../utils/validation";

type ContourRenderMode = "spline" | "polyline";

const JOB_POLL_INTERVAL_MS = 2000;
const MAX_JOB_POLL_ATTEMPTS = 180;

interface UseDxfExportProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onBtContextLoaded?: (payload: {
    btContextUrl: string;
    btContext: Record<string, unknown>;
  }) => void;
}

interface BtContextPayload {
  [key: string]: unknown;
}

const btContextResponseSchema = z.object({
  btContext: z.record(z.unknown()),
});

export function useDxfExport({
  onSuccess,
  onError,
  onBtContextLoaded,
}: UseDxfExportProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [downloadCenter, setDownloadCenter] = useState<GeoLocation | null>(
    null,
  );

  const triggerDownload = (url: string, center: GeoLocation) => {
    const filename = `dxf_export_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}.dxf`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const tryLoadBtContext = async (btContextUrl?: string) => {
    if (!btContextUrl) {
      return;
    }

    try {
      const response = await fetch(btContextUrl);
      if (!response.ok) {
        return;
      }

      const rawPayload: unknown = await response.json();
      const parsed = btContextResponseSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return;
      }

      onBtContextLoaded?.({ btContextUrl, btContext: parsed.data.btContext });
    } catch {
      // Silent fail: DXF download must not be blocked by optional BT metadata retrieval.
    }
  };

  const downloadDxf = async (
    center: GeoLocation,
    radius: number,
    selectionMode: SelectionMode,
    polygon: GeoLocation[],
    layers: LayerConfig,
    projection: "local" | "utm" = "utm",
    contourRenderMode: ContourRenderMode = "spline",
    btContext?: BtContextPayload,
  ) => {
    // Validate inputs before sending to backend
    if (
      !validateDxfExportInputs(center, radius, selectionMode, polygon, layers)
    ) {
      onError("DXF Error: Invalid input parameters");
      return false;
    }

    setIsDownloading(true);
    setJobStatus("queued");
    setJobProgress(0);

    try {
      const result = await generateDXF(
        center.lat,
        center.lng,
        radius,
        selectionMode,
        polygon,
        layers,
        projection,
        contourRenderMode,
        btContext,
      );

      if (!result) {
        throw new Error("Backend failed to queue DXF generation");
      }

      if ("url" in result && result.url) {
        await tryLoadBtContext(result.btContextUrl);
        triggerDownload(result.url, center);
        onSuccess("DXF Downloaded");
        setIsDownloading(false);
        setJobStatus("completed");
        setJobProgress(100);
        return true;
      }

      if ("jobId" in result && result.jobId) {
        setDownloadCenter(center);
        setJobId(String(result.jobId));
        return true;
      }

      throw new Error("Backend failed to queue DXF generation");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "DXF generation failed";
      setIsDownloading(false);
      setJobStatus("failed");
      onError(`DXF Error: ${message}`);
      return false;
    }
  };

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let isActive = true;
    let attempts = 0;
    const intervalId = window.setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_JOB_POLL_ATTEMPTS) {
        onError("DXF Error: timeout aguardando processamento do job");
        clearInterval(intervalId);
        setJobId(null);
        setIsDownloading(false);
        setJobStatus("failed");
        setDownloadCenter(null);
        return;
      }

      try {
        const statusResponse = await getDxfJobStatus(jobId);
        if (!isActive) {
          return;
        }

        setJobStatus(statusResponse.status);
        if (typeof statusResponse.progress === "number") {
          setJobProgress(statusResponse.progress);
        }

        if (statusResponse.status === "completed") {
          if (!isActive) return;

          const url = statusResponse.result?.url;
          if (!url) {
            throw new Error("DXF job completed without a URL");
          }

          const center = downloadCenter || { lat: 0, lng: 0, label: "" };
          await tryLoadBtContext(statusResponse.result?.btContextUrl);

          if (!isActive) return;
          triggerDownload(url, center);
          onSuccess("DXF Downloaded");
          clearInterval(intervalId);
          setJobId(null);
          setIsDownloading(false);
          setJobProgress(100);
          setJobStatus("completed");
          setDownloadCenter(null);
          return;
        }

        if (statusResponse.status === "failed") {
          if (!isActive) return;

          const errorMessage = statusResponse.error || "DXF generation failed";
          onError(`DXF Error: ${errorMessage}`);
          clearInterval(intervalId);
          setJobId(null);
          setIsDownloading(false);
          setJobStatus("failed");
          setDownloadCenter(null);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "DXF generation failed";
        onError(`DXF Error: ${message}`);
        clearInterval(intervalId);
        setJobId(null);
        setIsDownloading(false);
        setJobStatus("failed");
        setDownloadCenter(null);
      }
    }, JOB_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [jobId, downloadCenter, onBtContextLoaded, onError, onSuccess]);

  return {
    downloadDxf,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
  };
}
