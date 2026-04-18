import { spawn, spawnSync } from "child_process";
import path from "path";
import { logger } from "./utils/logger.js";
import { config } from "./config.js";
import { metricsService } from "./services/metricsService.js";

/**
 * Python Bridge for DXF Generation
 *
 * DOCKER-FIRST ARCHITECTURE:
 * This module executes Python scripts directly in a containerized environment.
 * The Python engine runs natively in Docker containers, eliminating the need
 * for compiled .exe binaries and improving portability and security.
 *
 * SECURITY MEASURES:
 * - Uses spawn() instead of exec() to prevent command injection
 * - Validates all file paths before execution
 * - Sanitizes all input arguments
 * - Logs all execution attempts for audit trail
 * - Runs in isolated Docker containers in production
 *
 * ROADMAP ITEM 99 – OOM Self-Healing:
 * - Python process monitors its own RSS via --memory-limit-mb flag
 * - Exit code 137 is treated as a retriable OOM error (distinct from generic failure)
 * - Caller receives structured PythonOomError to enable transparent job retry
 *
 * ROADMAP ITEM 17 – SLO Tracking:
 * - Records end-to-end DXF generation duration to metricsService
 */

// Compatible way to get dirname for both ESM and CJS (transpiled by Jest)
const dirname = path.join(process.cwd(), "server");

/** Exit code emitted by Python's OOM watchdog (main.py --memory-limit-mb). */
export const PYTHON_OOM_EXIT_CODE = 137;

/** Sinaliza que o processo Python foi encerrado por limite de memória (retriable). */
export class PythonOomError extends Error {
  readonly isOom = true;
  constructor(memoryLimitMb: number) {
    super(
      `Python worker encerrado por OOM (limite: ${memoryLimitMb}MB). Job pode ser re-tentado.`,
    );
    this.name = "PythonOomError";
  }
}

interface DxfOptions {
  lat: number;
  lon: number;
  radius: number;
  outputFile: string;
  layers?: Record<string, boolean>;
  mode?: string;
  polygon?: string;
  projection?: string;
  contourRenderMode?: "spline" | "polyline";
  btContext?: Record<string, unknown> | null;
  mtContext?: Record<string, unknown> | null;
}

interface PythonEnvProbeResult {
  command: string;
  executable: string;
  version: string;
  missingModules: string[];
  pyEnginePathPresent: boolean;
}

const REQUIRED_PYTHON_MODULES = [
  "ezdxf",
  "numpy",
  "pandas",
  "shapely",
  "geopandas",
  "pydantic",
] as const;

const PYTHON_ENV_PROBE_TTL_MS = 5 * 60 * 1_000;
const pythonEnvProbeCache = new Map<string, { at: number; result: PythonEnvProbeResult }>();

function buildPythonEnvProbeCode(): string {
  const modules = JSON.stringify(REQUIRED_PYTHON_MODULES);
  return [
    "import importlib.util, json, os, platform, sys",
    `required=${modules}`,
    "missing=[m for m in required if importlib.util.find_spec(m) is None]",
    "print(json.dumps({",
    "'executable': sys.executable,",
    "'version': platform.python_version(),",
    "'missingModules': missing,",
    "'cwd': os.getcwd(),",
    "'pyEnginePathPresent': importlib.util.find_spec('controller') is not None",
    "}))",
  ].join(";");
}

function probePythonEnvironment(command: string): PythonEnvProbeResult {
  const now = Date.now();
  const cached = pythonEnvProbeCache.get(command);
  if (cached && now - cached.at <= PYTHON_ENV_PROBE_TTL_MS) {
    return cached.result;
  }

  const check = spawnSync(command, ["-c", buildPythonEnvProbeCode()], {
    cwd: path.join(dirname, "..", "py_engine"),
    timeout: 10_000,
    encoding: "utf-8",
  });

  if (check.error) {
    throw new Error(
      `Python env probe failed for '${command}': ${check.error.message}`,
    );
  }

  if (typeof check.status === "number" && check.status !== 0) {
    const stderr = (check.stderr || "").trim();
    throw new Error(
      `Python env probe exited with code ${check.status} for '${command}'. stderr=${stderr || "<empty>"}`,
    );
  }

  let parsed: Omit<PythonEnvProbeResult, "command">;
  try {
    parsed = JSON.parse((check.stdout || "").trim());
  } catch {
    throw new Error(
      `Python env probe returned invalid JSON for '${command}': ${(check.stdout || "").trim()}`,
    );
  }

  const result: PythonEnvProbeResult = {
    command,
    executable: String(parsed.executable || ""),
    version: String(parsed.version || ""),
    missingModules: Array.isArray(parsed.missingModules)
      ? parsed.missingModules.map((item) => String(item))
      : [],
    pyEnginePathPresent: Boolean(parsed.pyEnginePathPresent),
  };

  pythonEnvProbeCache.set(command, { at: now, result });
  return result;
}

export const generateDxf = (options: DxfOptions): Promise<string> => {
  return new Promise((resolve, reject) => {
    logger.info("[PythonBridge] generateDxf call", { options });
    // Input validation for security
    if (
      options.lat === undefined ||
      options.lon === undefined ||
      options.radius === undefined
    ) {
      reject(
        new Error(
          `Missing required parameters: lat=${options.lat}, lon=${options.lon}, radius=${options.radius}`,
        ),
      );
      return;
    }

    // Validate coordinate ranges to prevent malicious input
    if (options.lat < -90 || options.lat > 90) {
      reject(new Error("Invalid latitude: must be between -90 and 90"));
      return;
    }
    if (options.lon < -180 || options.lon > 180) {
      reject(new Error("Invalid longitude: must be between -180 and 180"));
      return;
    }
    if (options.radius < 1 || options.radius > 10000) {
      reject(new Error("Invalid radius: must be between 1 and 10000"));
      return;
    }

    // DOCKER-FIRST: Always use Python directly (no .exe binaries)
    // This works in both Docker containers and native development environments
    const scriptPath = path.join(dirname, "../py_engine/main.py");

    // Allow customization via environment variable and fallback executables for Windows/Linux.
    const envPythonCommand = config.PYTHON_COMMAND;
    const fallbackCommands =
      process.platform === "win32"
        ? ["python", "py", "python3"]
        : ["python3", "python"];
    const commandCandidates = Array.from(
      new Set([
        ...(envPythonCommand ? [envPythonCommand] : []),
        ...fallbackCommands,
      ]),
    );

    const args = [scriptPath];

    // SECURITY: Sanitize all arguments - convert to strings to prevent injection
    // Add DXF arguments
    args.push(
      "--lat",
      String(options.lat),
      "--lon",
      String(options.lon),
      "--radius",
      String(options.radius),
      "--output",
      String(options.outputFile),
      "--selection_mode",
      String(options.mode || "circle"),
      "--polygon",
      String(options.polygon || "[]"),
      "--projection",
      String(options.projection || "local"),
      "--contour_style",
      String(options.contourRenderMode || "spline"),
      "--no-preview",
    );

    // Item 99: passa limite de memória RSS ao watchdog Python
    const memoryLimitMb = Number(process.env.PYTHON_MEMORY_LIMIT_MB ?? 0);
    if (memoryLimitMb > 0) {
      args.push("--memory-limit-mb", String(memoryLimitMb));
    }

    if (options.layers) {
      args.push("--layers", JSON.stringify(options.layers));
    }

    if (options.btContext) {
      args.push("--bt_context", JSON.stringify(options.btContext));
    }

    if (options.mtContext) {
      args.push("--mt_context", JSON.stringify(options.mtContext));
    }

    logger.info("Spawning Python process for DXF generation", {
      commandCandidates,
      args: args.join(" "),
      environment: config.NODE_ENV,
      dockerized: config.isDocker,
      timestamp: new Date().toISOString(),
    });

    // Item 17: mede duração end-to-end para SLO de geração DXF
    const generationStartMs = Date.now();
    const rssBeforeMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    metricsService.recordMetricObservation(
      "node_rss_mb_before_python",
      rssBeforeMb,
    );
    logger.info("Python spawn pre-flight memory snapshot", { rssBeforeMb });

    const runWithCommand = (index: number) => {
      const selectedCommand = commandCandidates[index];
      let envProbe: PythonEnvProbeResult;

      try {
        envProbe = probePythonEnvironment(selectedCommand);
      } catch (probeError) {
        const hasNextCandidate = index < commandCandidates.length - 1;
        if (hasNextCandidate) {
          logger.warn("Python env probe failed, trying fallback command", {
            attempted: selectedCommand,
            next: commandCandidates[index + 1],
            error:
              probeError instanceof Error
                ? probeError.message
                : String(probeError),
          });
          runWithCommand(index + 1);
          return;
        }
        reject(
          new Error(
            probeError instanceof Error
              ? probeError.message
              : String(probeError),
          ),
        );
        return;
      }

      if (envProbe.missingModules.length > 0 || !envProbe.pyEnginePathPresent) {
        reject(
          new Error(
            `Python environment invalid for '${selectedCommand}' executable='${envProbe.executable}' version='${envProbe.version}' missingModules=[${envProbe.missingModules.join(", ")}] pyEnginePathPresent=${envProbe.pyEnginePathPresent}`,
          ),
        );
        return;
      }

      const pythonProcess = spawn(selectedCommand, args, {
        cwd: path.join(dirname, "..", "py_engine"),
      });
      let stdoutData = "";
      let stderrData = "";
      let handled = false;
      const timeoutHandle = setTimeout(() => {
        if (handled) {
          return;
        }

        handled = true;
        logger.error("Python process timeout reached", {
          command: selectedCommand,
          timeoutMs: config.PYTHON_PROCESS_TIMEOUT_MS,
        });
        pythonProcess.kill();
        reject(
          new Error(
            `Python script timed out after ${config.PYTHON_PROCESS_TIMEOUT_MS}ms`,
          ),
        );
      }, config.PYTHON_PROCESS_TIMEOUT_MS);

      const clearProcessTimeout = () => clearTimeout(timeoutHandle);

      pythonProcess.stdout.on("data", (data) => {
        const str = data.toString();
        logger.debug("Python stdout", {
          command: selectedCommand,
          output: str,
        });
        stdoutData += str;
      });

      pythonProcess.stderr.on("data", (data) => {
        const str = data.toString();
        logger.warn("Python stderr", { command: selectedCommand, output: str });
        stderrData += str;
      });

      pythonProcess.on("close", (code) => {
        if (handled) {
          return;
        }

        clearProcessTimeout();
        const durationSec = (Date.now() - generationStartMs) / 1000;
        const rssAfterMb = Math.round(
          process.memoryUsage().rss / (1024 * 1024),
        );
        metricsService.recordMetricObservation(
          "node_rss_mb_after_python",
          rssAfterMb,
        );

        logger.info("Python process exited", {
          command: selectedCommand,
          exitCode: code,
          durationSec,
          rssAfterMb,
        });

        if (code === 0) {
          if (!stdoutData || stdoutData.trim().length === 0) {
            handled = true;
            reject(
              new Error(
                `Python script '${selectedCommand}' completed successfully but without output stdout. Stderr: ${stderrData}`,
              ),
            );
            return;
          }
          handled = true;
          metricsService.recordDxfGenerationDuration(durationSec); // Item 17 SLO
          resolve(stdoutData);
          return;
        }

        // Item 99: OOM detectado – erro distinguível para retry transparente
        if (code === PYTHON_OOM_EXIT_CODE) {
          handled = true;
          logger.error(
            "Python worker OOM – encerrado pelo watchdog de memória",
            {
              command: selectedCommand,
              memoryLimitMb,
              durationSec,
            },
          );
          reject(new PythonOomError(memoryLimitMb));
          return;
        }

        handled = true;
        const errorDetail =
          stderrData || stdoutData || "No error output captured";
        reject(
          new Error(
            `Python script '${selectedCommand}' failed with code ${code} | executable='${envProbe.executable}' version='${envProbe.version}' cwd='${path.join(dirname, "..", "py_engine")}'\nDetails: ${errorDetail}`,
          ),
        );
      });

      pythonProcess.on("error", (err: any) => {
        if (handled) {
          return;
        }

        clearProcessTimeout();

        const isMissingCommand = err?.code === "ENOENT";
        const hasNextCandidate = index < commandCandidates.length - 1;
        if (isMissingCommand && hasNextCandidate) {
          logger.warn("Python command not found, retrying with fallback", {
            attempted: selectedCommand,
            next: commandCandidates[index + 1],
          });
          handled = true;
          runWithCommand(index + 1);
          return;
        }

        handled = true;
        reject(
          new Error(
            `Failed to spawn python process using '${selectedCommand}': ${err.message}`,
          ),
        );
      });
    };

    runWithCommand(0);
  });
};
