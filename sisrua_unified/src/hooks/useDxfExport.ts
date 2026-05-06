import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { generateDXF, getDxfJobStatus } from "../services/dxfService";
import { SelectionMode, GeoLocation, LayerConfig } from "../types";
import { validateDxfExportInputs } from "../utils/validation";
import {
  downloadMemorialDescritivo,
  MemorialDownloadMetadata,
} from "../utils/memorialDescritivo";

type ContourRenderMode = "spline" | "polyline";

const JOB_POLL_INTERVAL_MS = 2000;
const MAX_JOB_POLL_ATTEMPTS = 180;
const DXF_URL_PATTERN = /\.dxf(?:$|\?)/i;

interface UseDxfExportProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onWarning?: (message: string) => void;
  onBtContextLoaded?: (payload: {
    btContextUrl: string;
    btContext: Record<string, unknown>;
  }) => void;
}

interface BtContextPayload {
  [key: string]: unknown;
}

const btContextResponseSchema = z.object({
  btContext: z.record(z.string(), z.unknown()),
});

export function useDxfExport({
  onSuccess,
  onError,
  onWarning,
  onBtContextLoaded,
}: UseDxfExportProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobProgress, setJobProgress] = useState(0);
  const [downloadCenter, setDownloadCenter] = useState<GeoLocation | null>(
    null,
  );
  const [queuedBtContext, setQueuedBtContext] =
    useState<BtContextPayload | null>(null);
  const [queuedMemorialMetadata, setQueuedMemorialMetadata] =
    useState<MemorialDownloadMetadata | null>(null);
  const [queuedShouldDownloadMemorial, setQueuedShouldDownloadMemorial] =
    useState(false);

  const triggerDownload = (url: string) => {
    console.log("[DXF Export] Triggering download from URL:", url);
    // Usar location.assign para disparar o download direto do browser
    window.location.assign(url);
  };

  const tryLoadBtContext = useCallback(
    async (btContextUrl?: string) => {
      if (!btContextUrl) {
        return null;
      }

      try {
        const response = await fetch(btContextUrl);
        if (!response.ok) {
          return null;
        }

        const rawPayload: unknown = await response.json();
        const parsed = btContextResponseSchema.safeParse(rawPayload);
        if (!parsed.success) {
          return null;
        }

        onBtContextLoaded?.({ btContextUrl, btContext: parsed.data.btContext });
        return parsed.data.btContext;
      } catch {
        // Silent fail: DXF download must not be blocked by optional BT metadata retrieval.
        return null;
      }
    },
    [onBtContextLoaded],
  );

  const tryDownloadMemorial = useCallback(
    (
      btContext: BtContextPayload | null | undefined,
      metadata: MemorialDownloadMetadata | null | undefined,
    ) => {
      if (!btContext) {
        return;
      }

      try {
        downloadMemorialDescritivo(btContext, metadata ?? {});
      } catch {
        onWarning?.(
          "DXF concluido, mas nao foi possivel gerar o memorial descritivo.",
        );
      }
    },
    [onWarning],
  );

  const downloadDxf = async (
    center: GeoLocation,
    radius: number,
    selectionMode: SelectionMode,
    polygon: GeoLocation[],
    layers: LayerConfig,
    projection: "local" | "utm" = "utm",
    contourRenderMode: ContourRenderMode = "spline",
    shouldDownloadMemorial = false,
    btContext?: BtContextPayload,
    memorialMetadata?: MemorialDownloadMetadata,
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
        if (!DXF_URL_PATTERN.test(result.url)) {
          throw new Error(
            "Resposta invalida do servidor: URL de download nao e DXF",
          );
        }

        const loadedBtContext = await tryLoadBtContext(result.btContextUrl);
        const memorialContext = loadedBtContext ?? btContext ?? null;
        triggerDownload(result.url);
        if (shouldDownloadMemorial) {
          tryDownloadMemorial(memorialContext, {
            ...memorialMetadata,
            center,
            radiusMeters: radius,
            selectionMode,
          });
        }
        onSuccess("DXF Downloaded");
        setIsDownloading(false);
        setJobStatus("completed");
        setJobProgress(100);
        return true;
      }

      if ("jobId" in result && result.jobId) {
        setDownloadCenter(center);
        setJobId(String(result.jobId));
        setQueuedBtContext(btContext ?? null);
        setQueuedShouldDownloadMemorial(shouldDownloadMemorial);
        setQueuedMemorialMetadata({
          ...memorialMetadata,
          center,
          radiusMeters: radius,
          selectionMode,
        });
        return true;
      }

      throw new Error("Backend failed to queue DXF generation");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "DXF generation failed";
      setIsDownloading(false);
      setJobStatus("failed");
      setQueuedBtContext(null);
      setQueuedShouldDownloadMemorial(false);
      setQueuedMemorialMetadata(null);
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
        setQueuedBtContext(null);
        setQueuedShouldDownloadMemorial(false);
        setQueuedMemorialMetadata(null);
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
          if (!DXF_URL_PATTERN.test(url)) {
            throw new Error("DXF job completed with non-DXF download URL");
          }

          const warningMessage = statusResponse.result?.warning;
          if (warningMessage && warningMessage.trim().length > 0) {
            onWarning?.(warningMessage);
          }

          const loadedBtContext = await tryLoadBtContext(
            statusResponse.result?.btContextUrl,
          );

          if (!isActive) return;
          triggerDownload(url);
          if (queuedShouldDownloadMemorial) {
            tryDownloadMemorial(
              loadedBtContext ?? queuedBtContext,
              queuedMemorialMetadata,
            );
          }
          onSuccess("DXF Downloaded");
          clearInterval(intervalId);
          setJobId(null);
          setIsDownloading(false);
          setJobProgress(100);
          setJobStatus("completed");
          setDownloadCenter(null);
          setQueuedBtContext(null);
          setQueuedShouldDownloadMemorial(false);
          setQueuedMemorialMetadata(null);
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
          setQueuedBtContext(null);
          setQueuedShouldDownloadMemorial(false);
          setQueuedMemorialMetadata(null);
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
        setQueuedBtContext(null);
        setQueuedShouldDownloadMemorial(false);
        setQueuedMemorialMetadata(null);
      }
    }, JOB_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [
    jobId,
    downloadCenter,
    queuedBtContext,
    queuedShouldDownloadMemorial,
    queuedMemorialMetadata,
    tryLoadBtContext,
    tryDownloadMemorial,
    onBtContextLoaded,
    onError,
    onSuccess,
    onWarning,
  ]);

  return {
    downloadDxf,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
  };
}
