import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  DownloadCloud,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  FormFieldMessage,
  getValidationPanelClassName,
} from "./FormFieldFeedback";
import { getDxfJobStatus } from "../services/dxfService";
import { API_BASE_URL } from "../config/api";
import {
  validateBatchUploadFile,
  type InlineValidationResult,
} from "../utils/validation";

type BatchResult = {
  name: string;
  status: "queued" | "cached" | "completed" | "failed";
  jobId?: string | number;
  url?: string;
  error?: string;
  progress?: number;
};

type BatchError = {
  line: number;
  message: string;
  row?: Record<string, string | undefined>;
};

type BatchResponse = {
  results: BatchResult[];
  errors?: BatchError[];
};

type BatchUploadProps = {
  onError: (message: string) => void;
  onInfo: (message: string) => void;
};

const API_URL = API_BASE_URL;

const buildIdentityHeaders = (): Record<string, string> => {
  const fromStorage =
    localStorage.getItem("sisrua_user_id") ||
    localStorage.getItem("sisrua_userId") ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("userId");
  const fallbackUserId =
    (import.meta.env.VITE_DEFAULT_USER_ID as string | undefined)?.trim() ||
    "system-admin";
  const userId = (fromStorage || fallbackUserId).trim();
  const token = localStorage.getItem("sisrua_token");

  const headers: Record<string, string> = {
    "x-user-id": userId,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const parseBatchResponse = async (response: Response): Promise<unknown> => {
  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  const rawBody = await response.text();

  if (!rawBody || rawBody.trim().length === 0) {
    throw new Error(
      `Batch endpoint returned empty response body (HTTP ${response.status})`,
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Batch endpoint returned non-JSON response (HTTP ${response.status})`,
    );
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(
      `Batch endpoint returned invalid JSON (HTTP ${response.status})`,
    );
  }
};

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "_")
    .slice(0, 40) || "batch";

const triggerDownload = (url: string, name: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(name)}.dxf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const BatchUpload: React.FC<BatchUploadProps> = ({ onError, onInfo }) => {
  const [items, setItems] = useState<BatchResult[]>([]);
  const [errors, setErrors] = useState<BatchError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadValidation, setUploadValidation] =
    useState<InlineValidationResult>(validateBatchUploadFile(null));
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const pendingJobs = useMemo(
    () => items.filter((item) => item.status === "queued" && item.jobId),
    [items],
  );

  const allCompleted =
    items.length > 0 &&
    items.every(
      (item) =>
        (item.status === "completed" || item.status === "cached") && !!item.url,
    );

  const handleUpload = async (file: File) => {
    const validation = validateBatchUploadFile(file);
    setUploadValidation(validation);

    if (!validation.isValid) {
      setItems([]);
      setErrors([{ line: 0, message: validation.message }]);
      onError(validation.message);
      return;
    }

    setIsUploading(true);
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append("csv", file);

      const response = await fetch(`${API_URL}/dxf/batch`, {
        method: "POST",
        headers: buildIdentityHeaders(),
        body: formData,
      });

      const payload = await parseBatchResponse(response);
      if (!response.ok) {
        const errorMessage =
          typeof payload === "object" &&
          payload !== null &&
          typeof (payload as Record<string, unknown>).error === "string"
            ? (payload as Record<string, string>).error
            : "Falha no envio em lote";
        throw new Error(errorMessage);
      }

      const batchResponse = payload as BatchResponse;
      setItems(batchResponse.results || []);
      setErrors(batchResponse.errors || []);
      setUploadValidation({
        state:
          batchResponse.errors && batchResponse.errors.length > 0
            ? "error"
            : "success",
        message:
          batchResponse.errors && batchResponse.errors.length > 0
            ? `Arquivo processado com ${batchResponse.errors.length} inconsistência(s) que exigem correção.`
            : `Arquivo "${file.name}" enviado com sucesso. Acompanhe o andamento abaixo.`,
        isValid: !(batchResponse.errors && batchResponse.errors.length > 0),
      });
      if (batchResponse.errors && batchResponse.errors.length > 0) {
        onError(
          `Erros no CSV: ${batchResponse.errors.length} linha(s) com erro`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha no envio em lote";
      setErrors([{ line: 0, message }]);
      setUploadValidation({ state: "error", message, isValid: false });
      onError(message);
      setItems([]);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (pendingJobs.length === 0) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const currentPending = itemsRef.current.filter(
        (item) => item.status === "queued" && item.jobId,
      );
      if (currentPending.length === 0) {
        return;
      }

      const updates = await Promise.all(
        currentPending.map(async (item) => {
          try {
            const status = await getDxfJobStatus(String(item.jobId));
            if (status.status === "completed") {
              return {
                jobId: item.jobId,
                status: "completed" as const,
                url: status.result?.url,
                progress: 100,
              };
            }

            if (status.status === "failed") {
              onError(`Batch DXF failed: ${item.name}`);
              return {
                jobId: item.jobId,
                status: "failed" as const,
                error: status.error || "DXF generation failed",
              };
            }

            return {
              jobId: item.jobId,
              status: "queued" as const,
              progress:
                typeof status.progress === "number"
                  ? status.progress
                  : item.progress,
            };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "DXF generation failed";
            onError(`Batch DXF failed: ${item.name}`);
            return {
              jobId: item.jobId,
              status: "failed" as const,
              error: message,
            };
          }
        }),
      );

      setItems((prev) =>
        prev.map((item) => {
          const update = updates.find((entry) => entry.jobId === item.jobId);
          if (!update) {
            return item;
          }

          return {
            ...item,
            status: update.status,
            url: update.url || item.url,
            error: update.error || item.error,
            progress: update.progress ?? item.progress,
          };
        }),
      );
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [pendingJobs.length]);

  useEffect(() => {
    if (allCompleted) {
      onInfo("DXF em lote concluído. Pronto para baixar.");
    }
  }, [allCompleted, onInfo]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-800 p-2 text-emerald-400">
          <Upload size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Processamento em Lote
          </span>
          <span className="text-sm font-semibold text-slate-100">
            Enviar CSV/Excel e gerar exportações
          </span>
        </div>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center text-xs font-semibold uppercase tracking-widest transition ${isDragging ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : getValidationPanelClassName(uploadValidation.state)}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <span className="flex items-center gap-2 text-emerald-300">
            <Loader2 size={16} className="animate-spin" />
            Enviando CSV...
          </span>
        ) : (
          <span>
            Arraste CSV ou Planilha Excel aqui ou clique para selecionar
          </span>
        )}
        <input
          type="file"
          accept=".csv, .xlsx, .xlsm"
          className="hidden"
          onChange={handleFileSelect}
        />
      </label>
      <FormFieldMessage
        tone={uploadValidation.state}
        message={uploadValidation.message}
      />

      {errors.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <div className="mb-2 flex items-center gap-2 text-rose-300">
            <AlertTriangle size={14} />
            <span className="font-semibold">Erros no CSV</span>
          </div>
          <ul className="space-y-1">
            {errors.map((err, index) => (
              <li key={`${err.line}-${index}`}>
                Linha {err.line || "-"}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={`${item.name}-${item.jobId ?? "cached"}`}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{item.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {{
                    queued: "Na fila",
                    cached: "Em cache",
                    completed: "Concluído",
                    failed: "Erro",
                  }[item.status] ?? item.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(item.status === "completed" || item.status === "cached") &&
                  item.url && (
                    <button
                      onClick={() =>
                        triggerDownload(item.url as string, item.name)
                      }
                      className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200"
                    >
                      Baixar
                    </button>
                  )}
                {item.status === "queued" && (
                  <span className="text-[10px] text-slate-400">
                    {item.progress ?? 0}%
                  </span>
                )}
                {item.status === "failed" && (
                  <span className="text-[10px] text-rose-300">
                    {item.error || "Erro"}
                  </span>
                )}
                {(item.status === "completed" || item.status === "cached") && (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {allCompleted && (
        <button
          onClick={() =>
            items.forEach(
              (item) => item.url && triggerDownload(item.url, item.name),
            )
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20"
        >
          <DownloadCloud size={16} />
          Baixar Tudo
        </button>
      )}
    </div>
  );
};

export default BatchUpload;
