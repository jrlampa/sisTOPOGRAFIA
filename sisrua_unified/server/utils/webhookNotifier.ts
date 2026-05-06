/**
 * webhookNotifier.ts — Envio de alertas via webhook (Slack-compatible).
 *
 * Usa a variável de ambiente WEBHOOK_URL para notificar canais externos quando
 * um SLO entra em estado de alerta. Suporta o formato de Incoming Webhooks do Slack.
 *
 * Falhas de envio são logadas mas não propagadas (fire-and-forget não crítico).
 */
import { logger } from "./logger.js";

export interface WebhookAlertPayload {
  sloId: string;
  sloName: string;
  currentCompliance: number;
  alertThreshold: number;
  errorBudgetRemaining: number;
  message: string;
  timestamp: string;
}

/**
 * Envia um alerta de SLO para o webhook configurado em WEBHOOK_URL.
 * Formato compatível com Slack Incoming Webhooks.
 * Noop silencioso se WEBHOOK_URL não estiver configurado.
 */
export async function sendWebhookAlert(
  payload: WebhookAlertPayload,
): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    logger.debug(
      "[webhookNotifier] WEBHOOK_URL não configurado, alerta ignorado.",
      {
        sloId: payload.sloId,
      },
    );
    return;
  }

  const body = JSON.stringify({
    text: payload.message,
    attachments: [
      {
        color: "danger",
        fields: [
          { title: "SLO", value: payload.sloName, short: true },
          { title: "ID", value: payload.sloId, short: true },
          {
            title: "Conformidade atual",
            value: `${(payload.currentCompliance * 100).toFixed(2)}%`,
            short: true,
          },
          {
            title: "Limiar de alerta",
            value: `${(payload.alertThreshold * 100).toFixed(2)}%`,
            short: true,
          },
          {
            title: "Budget restante",
            value: `${(payload.errorBudgetRemaining * 100).toFixed(1)}%`,
            short: true,
          },
          { title: "Timestamp", value: payload.timestamp, short: true },
        ],
      },
    ],
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn("[webhookNotifier] Webhook retornou status não-OK.", {
        status: res.status,
        sloId: payload.sloId,
      });
    } else {
      logger.info("[webhookNotifier] Alerta enviado com sucesso.", {
        sloId: payload.sloId,
      });
    }
  } catch (err) {
    logger.error("[webhookNotifier] Falha ao enviar alerta webhook.", {
      sloId: payload.sloId,
      err,
    });
  }
}
