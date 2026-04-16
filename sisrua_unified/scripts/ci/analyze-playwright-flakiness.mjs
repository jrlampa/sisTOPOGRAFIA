import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    lastRun: "test-results/.last-run.json",
    report: "test-results/release-smoke-report.json",
    out: "artifacts/ci/flakiness-report.json",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;

    if (key === "--lastRun") {
      args.lastRun = value;
      i += 1;
    } else if (key === "--report") {
      args.report = value;
      i += 1;
    } else if (key === "--out") {
      args.out = value;
      i += 1;
    }
  }

  return args;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function classifyCause(errorText) {
  const text = (errorText || "").toLowerCase();

  if (!text) return "erro_sem_detalhe";
  if (text.includes("timed out") || text.includes("timeout"))
    return "timeout_sincronizacao";
  if (
    text.includes("econnrefused") ||
    text.includes("socket hang up") ||
    text.includes("net::err")
  ) {
    return "instabilidade_rede_ou_servico";
  }
  if (
    text.includes("snapshot") ||
    text.includes("toequal(expected)") ||
    text.includes("to match snapshot")
  ) {
    return "drift_de_snapshot_ou_contrato";
  }
  if (
    text.includes("401") ||
    text.includes("403") ||
    text.includes("unauthorized")
  ) {
    return "desvio_de_auth_token_ambiente";
  }
  if (
    text.includes("locator") ||
    text.includes("not found") ||
    text.includes("strict mode violation")
  ) {
    return "seletor_ou_estado_ui_nao_estavel";
  }

  return "falha_nao_classificada";
}

function walkSuites(suites, parents = [], rows = []) {
  for (const suite of suites || []) {
    const nextParents = suite.title ? [...parents, suite.title] : parents;

    for (const spec of suite.specs || []) {
      const specPath = [...nextParents, spec.title].filter(Boolean).join(" > ");

      for (const test of spec.tests || []) {
        const results = test.results || [];
        const statuses = results.map((r) => r.status);
        const hasFailure = statuses.some((s) =>
          ["failed", "timedOut", "interrupted"].includes(s),
        );
        const hasPass = statuses.includes("passed");
        const outcome = test.outcome || "unknown";
        const isFlaky = outcome === "flaky" || (hasFailure && hasPass);
        const isFailed = outcome === "unexpected" || (hasFailure && !hasPass);

        const errorMessages = [];
        for (const result of results) {
          if (result.error?.message) {
            errorMessages.push(result.error.message);
          }
          for (const err of result.errors || []) {
            if (err?.message) {
              errorMessages.push(err.message);
            }
          }
        }

        rows.push({
          id: test.testId || `${spec.file || "unknown-file"}:${spec.title}`,
          file: spec.file || "unknown-file",
          title: specPath,
          projectName: test.projectName || "unknown",
          outcome,
          statuses,
          flaky: isFlaky,
          failed: isFailed,
          errors: errorMessages,
          probableCause: classifyCause(errorMessages[0] || ""),
        });
      }
    }

    walkSuites(suite.suites || [], nextParents, rows);
  }

  return rows;
}

function writeOutput(outPath, payload) {
  const absOut = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(payload, null, 2), "utf8");

  const markdownPath = absOut.replace(/\.json$/i, ".md");
  const summaryLines = [
    "# Relatorio de Flakiness E2E",
    "",
    `- statusLastRun: ${payload.lastRun?.status ?? "unknown"}`,
    `- failedTestsLastRun: ${payload.lastRun?.failedTestsCount ?? 0}`,
    `- flakyDetected: ${payload.summary.flakyCount}`,
    `- failedDetected: ${payload.summary.failedCount}`,
    "",
    "## Casos detectados",
    "",
  ];

  if (payload.samples.length === 0) {
    summaryLines.push(
      "Nenhum teste flaky/failed detectado no relatorio analisado.",
    );
  } else {
    for (const sample of payload.samples) {
      summaryLines.push(
        `- ${sample.kind.toUpperCase()} | ${sample.file} | ${sample.title} | causa=${sample.probableCause}`,
      );
    }
  }

  fs.writeFileSync(markdownPath, `${summaryLines.join("\n")}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv);
  const lastRun = readJsonIfExists(path.resolve(process.cwd(), args.lastRun));

  if (!lastRun) {
    console.error(`[flake-gate] Arquivo de last run ausente: ${args.lastRun}`);
    process.exit(1);
  }

  const report = readJsonIfExists(path.resolve(process.cwd(), args.report));
  const tests = report ? walkSuites(report.suites || []) : [];

  const flaky = tests.filter((t) => t.flaky);
  const failed = tests.filter((t) => t.failed);

  const payload = {
    generatedAt: new Date().toISOString(),
    lastRun: {
      status: lastRun.status ?? "unknown",
      failedTestsCount: Array.isArray(lastRun.failedTests)
        ? lastRun.failedTests.length
        : 0,
      failedTests: Array.isArray(lastRun.failedTests)
        ? lastRun.failedTests
        : [],
    },
    summary: {
      reportParsed: !!report,
      totalTestsInReport: tests.length,
      flakyCount: flaky.length,
      failedCount: failed.length,
    },
    samples: [...flaky, ...failed].slice(0, 20).map((t) => ({
      kind: t.flaky ? "flaky" : "failed",
      file: t.file,
      title: t.title,
      projectName: t.projectName,
      statuses: t.statuses,
      probableCause: t.probableCause,
      firstError: t.errors[0] || null,
    })),
  };

  writeOutput(args.out, payload);

  const hasFailedByLastRun =
    payload.lastRun.status !== "passed" || payload.lastRun.failedTestsCount > 0;
  const hasReliabilityIssue =
    hasFailedByLastRun ||
    payload.summary.flakyCount > 0 ||
    payload.summary.failedCount > 0;

  if (hasReliabilityIssue) {
    console.error("[flake-gate] Falha de confiabilidade detectada.");
    console.error(
      `[flake-gate] status=${payload.lastRun.status}, failedLastRun=${payload.lastRun.failedTestsCount}, flaky=${payload.summary.flakyCount}, failed=${payload.summary.failedCount}`,
    );
    process.exit(1);
  }

  console.log(
    "[flake-gate] OK: sem flake/fail intermitente no pacote de regressao analisado.",
  );
}

main();
