import { Router, Request, Response } from "express";
import { OllamaService } from "../services/ollamaService.js";
import { logger } from "../utils/logger.js";
import { analysisSchema } from "../schemas/apiSchemas.js";

const router = Router();
const MAX_BODY_PREVIEW_LENGTH = 200;

router.get("/runtime", async (_req: Request, res: Response) => {
  try {
    const runtime = await OllamaService.getRuntimeStatus();
    const status = runtime.zeroCostCompliant && runtime.available ? 200 : 503;
    return res.status(status).json(runtime);
  } catch (error: any) {
    logger.error("Failed to load Ollama runtime status", {
      error: error?.message,
    });
    return res.status(500).json({
      error: "Runtime status failed",
      details: "Não foi possível consultar o runtime do Ollama.",
    });
  }
});

router.get("/runtime/governance", async (_req: Request, res: Response) => {
  try {
    const governance = await OllamaService.getGovernanceStatus();
    return res.status(200).json(governance);
  } catch (error: any) {
    logger.error("Failed to load Ollama governance status", {
      error: error?.message,
    });
    return res.status(500).json({
      error: "Governance status failed",
      details: "Não foi possível consultar a governança do runtime Ollama.",
    });
  }
});

const getBodyMetadata = (
  body: unknown,
): {
  hasBody: boolean;
  bodyType: string;
  topLevelKeyCount: number;
  topLevelKeys: string[];
  serializedSize: number;
  bodyPreview: string;
  bodyPreviewTruncated: boolean;
} => {
  const hasBody = body !== undefined && body !== null;
  const bodyType = Array.isArray(body) ? "array" : typeof body;
  const topLevelKeys =
    body && typeof body === "object" && !Array.isArray(body)
      ? Object.keys(body as Record<string, unknown>).slice(0, 10)
      : [];

  const safeSerializedBody = (() => {
    try {
      return body === undefined ? "" : JSON.stringify(body) || "";
    } catch {
      return "[unserializable-body]";
    }
  })();

  return {
    hasBody,
    bodyType,
    topLevelKeyCount: topLevelKeys.length,
    topLevelKeys,
    serializedSize: safeSerializedBody.length,
    bodyPreview: safeSerializedBody.slice(0, MAX_BODY_PREVIEW_LENGTH),
    bodyPreviewTruncated: safeSerializedBody.length > MAX_BODY_PREVIEW_LENGTH,
  };
};

// AI Analyze Endpoint using Ollama local LLM
router.post("/", async (req: Request, res: Response) => {
  try {
    const validation = analysisSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn("Analysis validation failed", {
        issues: validation.error.issues,
        ip: req.ip,
      });
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.issues.map((i) => i.message).join(", "),
      });
    }

    const { stats, locationName } = validation.data;
    const location = locationName || "Área Selecionada";

    const runtime = await OllamaService.getRuntimeStatus();
    const ollamaAvailable = runtime.available;
    const modelAvailable = runtime.compatibility.configuredModelAvailable || runtime.compatibility.fallbackModelUsed;

    logger.info("Ollama AI analysis requested", {
      locationName: location,
      ollamaAvailable,
      modelAvailable,
      selectedModel: runtime.selectedModel,
      zeroCostCompliant: runtime.zeroCostCompliant,
      timestamp: new Date().toISOString(),
    });

    if (!ollamaAvailable || !modelAvailable) {
      const reason = !ollamaAvailable ? "Serviço Ollama offline" : `Modelo ${runtime.configuredModel} ainda não está pronto`;
      logger.warn(`Ollama not ready: ${reason}`);
      return res.status(503).json({
        error: "Ollama not ready",
        message: reason,
        runtime,
        analysis: `**Análise AI em Preparação**\n\n${reason}. Verifique se:\n1. O container \`sisrua-ollama\` está rodando.\n2. O download do modelo ${runtime.configuredModel} terminou (pode levar alguns minutos).\n3. O servidor responde em ${runtime.host}.`,
      });
    }

    logger.info("Processing Ollama AI analysis request", {
      locationName: location,
      hasStats: !!stats,
    });
    const result = await OllamaService.analyzeArea(stats, location);
    logger.info("Ollama AI analysis completed successfully", {
      locationName: location,
    });
    return res.json(result);
  } catch (error: any) {
    const bodyMetadata = getBodyMetadata(req.body);
    logger.error("Ollama analysis error", {
      error: error.message,
      stack: error.stack,
      request: bodyMetadata,
      errorType: error.constructor.name,
    });

    return res.status(500).json({
      error: "Analysis failed",
      details: "Internal Server Error",
      analysis: `**Erro na Análise AI**\n\nNão foi possível processar a análise. Ocorreu um erro interno durante a comunicação com o serviço remoto.`,
    });
  }
});

export default router;
