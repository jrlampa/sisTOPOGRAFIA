/**
 * webhookNotifier.test.ts — Testes unitários para webhookNotifier.
 */
import {
  sendWebhookAlert,
  type WebhookAlertPayload,
} from "../utils/webhookNotifier";

const PAYLOAD: WebhookAlertPayload = {
  sloId: "test_slo",
  sloName: "Test SLO",
  currentCompliance: 0.97,
  alertThreshold: 0.98,
  errorBudgetRemaining: 0.3,
  message:
    "🚨 SLO em alerta: Test SLO — conformidade 97.00% abaixo do limiar 98.00%",
  timestamp: "2026-04-21T00:00:00.000Z",
};

describe("sendWebhookAlert", () => {
  const originalEnv = process.env.WEBHOOK_URL;

  afterEach(() => {
    process.env.WEBHOOK_URL = originalEnv;
    jest.restoreAllMocks();
  });

  it("não faz fetch quando WEBHOOK_URL não está configurado", async () => {
    delete process.env.WEBHOOK_URL;
    const fetchSpy = jest.spyOn(global, "fetch");
    await sendWebhookAlert(PAYLOAD);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("envia POST com body JSON correto para a URL configurada", async () => {
    process.env.WEBHOOK_URL =
      "https://hooks.slack.example.com/T123/B456/webhook";
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    await sendWebhookAlert(PAYLOAD);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://hooks.slack.example.com/T123/B456/webhook");
    expect(opts?.method).toBe("POST");
    expect(opts?.headers).toMatchObject({ "Content-Type": "application/json" });

    const body = JSON.parse(opts?.body as string);
    expect(body.text).toBe(PAYLOAD.message);
    expect(body.attachments[0].color).toBe("danger");
    const fields: Array<{ title: string; value: string }> =
      body.attachments[0].fields;
    const sloField = fields.find((f) => f.title === "SLO");
    expect(sloField?.value).toBe("Test SLO");
  });

  it("não propaga erro quando fetch falha (fire-and-forget)", async () => {
    process.env.WEBHOOK_URL = "https://hooks.slack.example.com/bad";
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
    await expect(sendWebhookAlert(PAYLOAD)).resolves.not.toThrow();
  });

  it("não propaga erro quando webhook retorna status não-OK", async () => {
    process.env.WEBHOOK_URL = "https://hooks.slack.example.com/bad";
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    await expect(sendWebhookAlert(PAYLOAD)).resolves.not.toThrow();
  });
});

describe("sloService – integração com webhook na transição de alerta", () => {
  let registerSLO: (
    def: import("../services/sloService").SLODefinition,
  ) => void;
  let recordObservation: (sloId: string, met: boolean, ts?: Date) => void;
  let clearSLOs: () => void;

  beforeEach(async () => {
    jest.resetModules();
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    process.env.WEBHOOK_URL = "https://hooks.slack.example.com/T123";
    // Re-import para estado limpo
    const mod = await import("../services/sloService");
    registerSLO = mod.registerSLO;
    recordObservation = mod.recordObservation;
    clearSLOs = mod.clearSLOs;
    clearSLOs();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WEBHOOK_URL;
  });

  it("dispara webhook quando alerting passa de false para true", async () => {
    registerSLO({
      id: "wh_slo",
      name: "Webhook SLO",
      description: "",
      indicator: "availability",
      target: 0.99,
      windowDays: 7,
      alertThreshold: 0.98,
    });

    // 10 observações all-false → alerting = true (compliance = 0 < 0.98)
    for (let i = 0; i < 10; i++) recordObservation("wh_slo", false);

    // Aguarda microtask/Promise
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.text).toContain("Webhook SLO");
  });

  it("não dispara webhook múltiplas vezes enquanto já está alertando", async () => {
    registerSLO({
      id: "wh_slo2",
      name: "Webhook SLO 2",
      description: "",
      indicator: "availability",
      target: 0.99,
      windowDays: 7,
      alertThreshold: 0.98,
    });

    for (let i = 0; i < 10; i++) recordObservation("wh_slo2", false);
    // Segunda observação while already alerting
    recordObservation("wh_slo2", false);

    await Promise.resolve();

    // Webhook deve ter sido chamado apenas 1 vez (na transição)
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
  });

  it("não dispara webhook quando SLO permanece saudável", async () => {
    registerSLO({
      id: "wh_slo3",
      name: "Webhook SLO 3",
      description: "",
      indicator: "availability",
      target: 0.9,
      windowDays: 7,
      alertThreshold: 0.85,
    });

    for (let i = 0; i < 10; i++) recordObservation("wh_slo3", true);

    await Promise.resolve();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
