import { Router, Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { OllamaService } from "../services/ollamaService.js";
import { listCircuitBreakers } from "../utils/circuitBreaker.js";
import {
  isBearerRequestAuthorized,
  setBearerChallenge,
} from "../utils/bearerAuth.js";

const router = Router();

const externalApisQuerySchema = z.object({
  details: z.enum(["summary", "full"]).optional(),
});

function isOpsRequestAuthorized(req: Request): boolean {
  return isBearerRequestAuthorized(req, config.METRICS_TOKEN);
}

router.get("/external-apis", (req: Request, res: Response) => {
  if (!isOpsRequestAuthorized(req)) {
    setBearerChallenge(res, "ops");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const queryValidation = externalApisQuerySchema.safeParse(req.query);
  if (!queryValidation.success) {
    return res.status(400).json({
      error: "Parâmetros inválidos",
      details: queryValidation.error.flatten(),
    });
  }

  const includeDetails = queryValidation.data.details !== "summary";

  const circuitBreakers = listCircuitBreakers();
  const openCircuits = circuitBreakers.filter(
    (cb) => cb.state === "OPEN",
  ).length;
  const halfOpenCircuits = circuitBreakers.filter(
    (cb) => cb.state === "HALF_OPEN",
  ).length;
  const closedCircuits = circuitBreakers.filter(
    (cb) => cb.state === "CLOSED",
  ).length;

  const status = openCircuits > 0 ? "degraded" : "online";
  const statusCode = status === "online" ? 200 : 503;

  const actions =
    openCircuits > 0
      ? [
          "Verificar disponibilidade das APIs externas com circuito aberto.",
          "Consultar logs de erro por integração para identificar causa raiz.",
          "Confirmar recuperação automática antes de qualquer intervenção manual.",
        ]
      : ["Nenhuma ação imediata necessária."];

  return res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    summary: {
      totalRegistered: circuitBreakers.length,
      openCircuits,
      halfOpenCircuits,
      closedCircuits,
    },
    runbook: {
      recommendedActionsPtBr: actions,
    },
    ...(includeDetails ? { circuitBreakers } : {}),
  });
});

router.get("/ai-runtime", async (req: Request, res: Response) => {
  if (!isOpsRequestAuthorized(req)) {
    setBearerChallenge(res, "ops");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const governance = await OllamaService.getGovernanceStatus();
    const degradedReasons: string[] = [];

    if (!governance.runtime.available) {
      degradedReasons.push("Runtime Ollama indisponível.");
    }
    if (!governance.runtime.zeroCostCompliant) {
      degradedReasons.push(
        "Política zero-custo não atendida pelo host configurado.",
      );
    }
    if (!governance.version.compliant) {
      degradedReasons.push("Versão do runtime abaixo do mínimo homologado.");
    }

    const status = degradedReasons.length > 0 ? "degraded" : "online";
    const statusCode = status === "online" ? 200 : 503;

    const runbookActions =
      status === "online"
        ? ["Nenhuma ação imediata necessária."]
        : [
            "Validar disponibilidade do Ollama local e saúde do serviço.",
            "Revisar compliance zero-custo e allowlist de host remoto.",
            "Executar atualização apenas na janela de manutenção configurada.",
          ];

    return res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      summary: {
        runtimeAvailable: governance.runtime.available,
        zeroCostCompliant: governance.runtime.zeroCostCompliant,
        versionCompliant: governance.version.compliant,
        updateRecommended: governance.version.updateRecommended,
        canAutoUpdate: governance.updatePolicy.canAutoUpdate,
      },
      diagnostics: governance,
      runbook: {
        reason: governance.updatePolicy.reason,
        degradedReasons,
        recommendedActionsPtBr: runbookActions,
      },
    });
  } catch {
    return res.status(500).json({
      error: "Ops AI runtime status failed",
    });
  }
});

export default router;
