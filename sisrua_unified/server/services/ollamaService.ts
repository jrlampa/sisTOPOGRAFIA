import { spawn } from "child_process";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const OLLAMA_BASE_URL = config.OLLAMA_HOST;
const OLLAMA_MODEL = config.OLLAMA_MODEL;

let ollamaProcess: ReturnType<typeof spawn> | null = null;

type OllamaRuntimeStatus = {
  available: boolean;
  host: string;
  configuredModel: string;
  selectedModel: string;
  availableModels: string[];
  zeroCostEnforced: boolean;
  zeroCostCompliant: boolean;
  fallbackModels: string[];
  compatibility: {
    configuredModelAvailable: boolean;
    fallbackModelUsed: boolean;
  };
  warnings: string[];
};

type OllamaGovernanceStatus = {
  runtime: OllamaRuntimeStatus;
  version: {
    current: string | null;
    minimum: string;
    compliant: boolean;
    updateRecommended: boolean;
    checkEnabled: boolean;
  };
  maintenanceWindow: {
    configuredUtc: string;
    inWindow: boolean;
    nowUtc: string;
  };
  updatePolicy: {
    canAutoUpdate: boolean;
    reason: string;
  };
};

function normalizeModelName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase();
}

function isLocalOllamaHost(host: string): boolean {
  try {
    const parsed = new URL(host);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

function parseWindowMinutes(value: string): {
  start: number;
  end: number;
} | null {
  const [startRaw, endRaw] = value.split("-").map((item) => item.trim());
  if (!startRaw || !endRaw) {
    return null;
  }

  const toMinutes = (time: string): number | null => {
    const [hRaw, mRaw] = time.split(":");
    if (hRaw === undefined || mRaw === undefined) {
      return null;
    }
    const h = Number.parseInt(hRaw, 10);
    const m = Number.parseInt(mRaw, 10);
    if (
      Number.isNaN(h) ||
      Number.isNaN(m) ||
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59
    ) {
      return null;
    }
    return h * 60 + m;
  };

  const start = toMinutes(startRaw);
  const end = toMinutes(endRaw);
  if (start === null || end === null) {
    return null;
  }

  return { start, end };
}

function isWithinMaintenanceWindow(windowRaw: string, now = new Date()): boolean {
  const parsed = parseWindowMinutes(windowRaw);
  if (!parsed) {
    return false;
  }

  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (parsed.start <= parsed.end) {
    return current >= parsed.start && current <= parsed.end;
  }

  // Overnight window (e.g. 23:00-02:00)
  return current >= parsed.start || current <= parsed.end;
}

function compareSemver(a: string, b: string): number {
  const normalize = (value: string) =>
    value
      .replace(/^v/i, "")
      .split(/[.-]/)
      .slice(0, 3)
      .map((segment) => Number.parseInt(segment, 10))
      .map((num) => (Number.isNaN(num) ? 0 : num));

  const left = normalize(a);
  const right = normalize(b);
  for (let index = 0; index < 3; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function resolveCandidateModels(): string[] {
  const candidates = [OLLAMA_MODEL, ...config.ollamaFallbackModels];
  const seen = new Set<string>();

  return candidates.filter((model) => {
    const normalized = normalizeModelName(model);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function selectCompatibleModel(availableModels: string[]): {
  selectedModel: string;
  configuredModelAvailable: boolean;
  fallbackModelUsed: boolean;
} {
  const normalizedAvailable = new Set(
    availableModels.map((model) => normalizeModelName(model)),
  );
  const candidates = resolveCandidateModels();
  const configuredNormalized = normalizeModelName(OLLAMA_MODEL);

  const matched = candidates.find((candidate) =>
    normalizedAvailable.has(normalizeModelName(candidate)),
  );
  const selectedModel = matched ?? OLLAMA_MODEL;
  const selectedNormalized = normalizeModelName(selectedModel);
  const configuredModelAvailable =
    normalizedAvailable.has(configuredNormalized);

  return {
    selectedModel,
    configuredModelAvailable,
    fallbackModelUsed: selectedNormalized !== configuredNormalized,
  };
}

export class OllamaService {
  static async getVersion(): Promise<string | null> {
    try {
      if (!this.isZeroCostCompliantHost()) {
        return null;
      }

      const response = await fetch(`${OLLAMA_BASE_URL}/api/version`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (typeof data.version !== "string" || data.version.trim().length === 0) {
        return null;
      }

      return data.version.trim();
    } catch {
      return null;
    }
  }

  static isZeroCostCompliantHost(host = OLLAMA_BASE_URL): boolean {
    if (!config.ollamaEnforceZeroCost) {
      return true;
    }

    if (isLocalOllamaHost(host)) {
      return true;
    }

    const normalized = normalizeHost(host);
    return config.ollamaAllowedRemoteHosts.includes(normalized);
  }

  static async getRuntimeStatus(): Promise<OllamaRuntimeStatus> {
    const zeroCostCompliant = this.isZeroCostCompliantHost();
    const availableModels = zeroCostCompliant ? await this.getModels() : [];
    const available = zeroCostCompliant ? await this.isAvailable() : false;
    const compatibility = selectCompatibleModel(availableModels);
    const warnings: string[] = [];

    if (!zeroCostCompliant) {
      warnings.push(
        "Host do Ollama fora da política zero-custo. Configure endpoint local ou allowlist explícita.",
      );
    }
    if (!available) {
      warnings.push("Serviço Ollama indisponível para análise no momento.");
    }
    if (available && compatibility.fallbackModelUsed) {
      warnings.push(
        `Modelo principal indisponível; fallback ativo: ${compatibility.selectedModel}.`,
      );
    }

    const modelAvailable = availableModels.some(m => normalizeModelName(m) === normalizeModelName(OLLAMA_MODEL));
    if (available && !modelAvailable && !compatibility.fallbackModelUsed) {
      warnings.push(`Modelo principal '${OLLAMA_MODEL}' não encontrado localmente. Tentando recuperação...`);
    }

    return {
      available,
      host: OLLAMA_BASE_URL,
      configuredModel: OLLAMA_MODEL,
      selectedModel: compatibility.selectedModel,
      availableModels,
      zeroCostEnforced: config.ollamaEnforceZeroCost,
      zeroCostCompliant,
      fallbackModels: [...config.ollamaFallbackModels],
      compatibility,
      warnings,
    };
  }

  static async getGovernanceStatus(): Promise<OllamaGovernanceStatus> {
    const runtime = await this.getRuntimeStatus();
    const checkEnabled = config.ollamaUpdateCheckEnabled;
    const currentVersion = checkEnabled ? await this.getVersion() : null;
    const minimumVersion = config.OLLAMA_MIN_VERSION;
    const versionCompliant =
      currentVersion !== null
        ? compareSemver(currentVersion, minimumVersion) >= 0
        : false;
    const updateRecommended =
      currentVersion !== null
        ? compareSemver(currentVersion, minimumVersion) < 0
        : false;
    const inWindow = isWithinMaintenanceWindow(
      config.OLLAMA_UPDATE_MAINTENANCE_WINDOW_UTC,
    );

    let reason = "Governança de runtime aprovada para atualização controlada.";
    let canAutoUpdate = true;

    if (!checkEnabled) {
      canAutoUpdate = false;
      reason = "Verificação de atualização desativada por configuração.";
    } else if (!runtime.zeroCostCompliant) {
      canAutoUpdate = false;
      reason = "Host do Ollama fora da política zero-custo.";
    } else if (!runtime.available) {
      canAutoUpdate = false;
      reason = "Runtime Ollama indisponível para validação segura.";
    } else if (!inWindow) {
      canAutoUpdate = false;
      reason = "Fora da janela de manutenção configurada (UTC).";
    } else if (!updateRecommended) {
      canAutoUpdate = false;
      reason = "Versão atual já atende ao mínimo definido.";
    }

    return {
      runtime,
      version: {
        current: currentVersion,
        minimum: minimumVersion,
        compliant: versionCompliant,
        updateRecommended,
        checkEnabled,
      },
      maintenanceWindow: {
        configuredUtc: config.OLLAMA_UPDATE_MAINTENANCE_WINDOW_UTC,
        inWindow,
        nowUtc: new Date().toISOString(),
      },
      updatePolicy: {
        canAutoUpdate,
        reason,
      },
    };
  }

  /**
   * Analyzes urban stats using Ollama (local LLM)
   * Provides intelligent insights for urban planning and CAD engineering
   */
  static async analyzeArea(stats: any, locationName: string) {
    try {
      const hasData = stats.buildings > 0 || stats.roads > 0 || stats.trees > 0;
      const runtimeStatus = await this.getRuntimeStatus();

      if (!runtimeStatus.zeroCostCompliant) {
        return {
          analysis:
            '**Análise AI bloqueada por política de custo**\n\nA política "zero custo" exige Ollama local. Ajuste `OLLAMA_HOST` para endpoint local ou autorize explicitamente em `OLLAMA_ALLOWED_REMOTE_HOSTS`.',
        };
      }

      const prompt = hasData
        ? `Você é um especialista em urbanismo. Dados da área "${locationName}": ${JSON.stringify(stats)}. Responda SOMENTE com JSON válido no formato: {"analysis":"..."}. O valor de analysis deve ser um resumo CURTO em Português BR com no máximo 5 linhas: destaque os principais números (edificações, vias, vegetação), aponte 1 risco crítico e 1 ação prioritária. Sem introduções, sem listas longas.`
        : `Área "${locationName}" sem dados OSM disponíveis. Responda APENAS JSON: {"analysis":"Área sem dados no OpenStreetMap. Verifique o endereço ou amplie o raio de busca."}`;

      logger.info("Requesting Ollama AI analysis", {
        locationName,
        hasData,
        configuredModel: OLLAMA_MODEL,
        selectedModel: runtimeStatus.selectedModel,
        url: OLLAMA_BASE_URL,
      });

      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: runtimeStatus.selectedModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const data = await response.json();
      const text = data.response || "";

      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        logger.info("Ollama AI analysis completed successfully");
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (pe) {
          logger.warn("Failed to parse Ollama JSON match, using raw text", { error: (pe as Error).message });
          return { analysis: text };
        }
      } else {
        // Return the raw text as analysis if no JSON found
        logger.info("Ollama returned non-JSON response, using raw text");
        return { analysis: text };
      }
    } catch (error: any) {
      logger.error("Ollama AI analysis failed", {
        error: error.message,
        locationName,
        stack: error.stack,
      });

      // Return a helpful error message
      return {
        analysis: `**Análise AI Indisponível**\n\nO serviço Ollama não está disponível. Verifique se:\n1. O Ollama está instalado: https://ollama.com\n2. O serviço está rodando: \`ollama serve\`\n3. O modelo ${OLLAMA_MODEL} está disponível: \`ollama pull ${OLLAMA_MODEL}\`\n\nErro: ${error.message}`,
      };
    }
  }

  /**
   * Check if Ollama is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      if (!this.isZeroCostCompliantHost()) {
        return false;
      }
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available models
   */
  static async getModels(): Promise<string[]> {
    try {
      if (!this.isZeroCostCompliantHost()) {
        return [];
      }
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }

  /**
   * Start the Ollama background process if not already running.
   */
  static async startProcess(): Promise<void> {
    // Only try to start local process if host is local
    if (!isLocalOllamaHost(OLLAMA_BASE_URL)) {
      logger.info("[Ollama] Remote host configured, skipping local process management", { host: OLLAMA_BASE_URL });
      // Ensure the model is available on the remote host
      await this.verifyAndPullModel();
      return;
    }

    if (await this.isAvailable()) {
      logger.info("[Ollama] Service already running");
      await this.verifyAndPullModel();
      return;
    }

    try {
      logger.info("[Ollama] Starting background process...");
      
      ollamaProcess = spawn("ollama", ["serve"], {
        detached: false,
        stdio: "pipe",
      });

      let binaryMissing = false;

      // CRITICAL: Handle error event to prevent crash if binary is missing (ENOENT)
      ollamaProcess.on("error", (err: any) => {
        if (err.code === "ENOENT") {
           binaryMissing = true;
           logger.warn("[Ollama] Binary 'ollama' not found in system PATH. Local LLM analysis will be disabled.");
        } else {
           logger.error("[Ollama] Process error", {
             error: err.message,
             code: err.code
           });
        }
        ollamaProcess = null;
      });

      // Wait a tiny bit to see if 'error' fires immediately (ENOENT does)
      await new Promise(r => setTimeout(r, 100));
      if (binaryMissing || !ollamaProcess) return;

      ollamaProcess.stdout?.on("data", (d) =>
        logger.info(`Ollama (stdout): ${d.toString().trim()}`),
      );
      ollamaProcess.stderr?.on("data", (d) =>
        logger.warn(`Ollama (stderr): ${d.toString().trim()}`),
      );

      // Wait for startup with retries
      let ready = false;
      const maxRetries = 5;
      for (let i = 0; i < maxRetries; i++) {
        if (binaryMissing) break;
        await new Promise((r) => setTimeout(r, config.OLLAMA_STARTUP_WAIT_MS / maxRetries));
        if (await this.isAvailable()) {
          ready = true;
          break;
        }
        logger.info(`[Ollama] Waiting for service readiness (try ${i + 1}/${maxRetries})...`);
      }

      if (ready) {
        logger.info("[Ollama] Service is now ready");
        await this.verifyAndPullModel();
      } else if (!binaryMissing) {
        logger.warn(
          "[Ollama] Process started but service is not responding yet",
        );
      }
    } catch (e) {
      logger.error("[Ollama] Startup failed critically", e);
    }
  }

  /**
   * Verifies if the configured model is available and pulls it if missing.
   */
  private static async verifyAndPullModel(): Promise<void> {
    try {
      const models = await this.getModels();
      const target = normalizeModelName(OLLAMA_MODEL);
      if (!models.some(m => normalizeModelName(m) === target)) {
        logger.info(`[Ollama] Model '${OLLAMA_MODEL}' missing. Pulling...`);
        
        if (!isLocalOllamaHost(OLLAMA_BASE_URL)) {
          // Remote Pull via API
          try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: OLLAMA_MODEL, stream: false }),
            });
            if (response.ok) {
              logger.info(`[Ollama] Model '${OLLAMA_MODEL}' pull triggered successfully (remote)`);
            } else {
              logger.warn(`[Ollama] Failed to trigger pull for '${OLLAMA_MODEL}' (remote status: ${response.status})`);
            }
          } catch (apiErr) {
            logger.error(`[Ollama] Remote model pull request failed`, apiErr);
          }
        } else {
          // Local Pull via binary
          const pullProcess = spawn("ollama", ["pull", OLLAMA_MODEL]);
          
          // Handle error event (binary missing)
          pullProcess.on("error", (err: any) => {
            logger.error("[Ollama] Model pull failed (binary missing)", { error: err.message });
          });

          return new Promise((resolve) => {
            pullProcess.on("close", (code) => {
              if (code === 0) {
                logger.info(`[Ollama] Model '${OLLAMA_MODEL}' pulled successfully`);
              } else {
                logger.warn(`[Ollama] Failed to pull model '${OLLAMA_MODEL}' (exit code ${code})`);
              }
              resolve();
            });
            
            // Also resolve on error to avoid hanging promise
            pullProcess.on("error", () => resolve());
          });
        }
      }
    } catch (e) {
      logger.error("[Ollama] Model verification/pull failed", e);
    }
  }

  /**
   * Stop the Ollama background process.
   */
  static stopProcess(): void {
    if (ollamaProcess) {
      logger.info("[Ollama] Stopping process...");
      ollamaProcess.kill("SIGTERM");
      ollamaProcess = null;
    }
  }
}
