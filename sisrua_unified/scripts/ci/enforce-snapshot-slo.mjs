import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    report: "test-results/release-smoke-report.json",
    baseline: ".github/slo/snapshot-slo-baseline.json",
    out: "artifacts/ci/snapshot-slo-report.json",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;

    if (key === "--report") {
      args.report = value;
      i += 1;
    } else if (key === "--baseline") {
      args.baseline = value;
      i += 1;
    } else if (key === "--out") {
      args.out = value;
      i += 1;
    }
  }

  return args;
}

function readJsonRequired(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`[snapshot-slo] Arquivo ausente (${label}): ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function looksLikeUndueMissingSnapshot(errorText) {
  const text = (errorText || "").toLowerCase();
  return (
    text.includes("enoent") ||
    text.includes("no such file") ||
    (text.includes("snapshot") && text.includes("not found")) ||
    text.includes("release-health.snapshot.json")
  );
}

function collectTestsFromSuites(suites, parents = [], rows = []) {
  for (const suite of suites || []) {
    const nextParents = suite.title ? [...parents, suite.title] : parents;

    for (const spec of suite.specs || []) {
      const fullTitle = [...nextParents, spec.title]
        .filter(Boolean)
        .join(" > ");
      for (const test of spec.tests || []) {
        const results = test.results || [];
        const errors = [];
        for (const result of results) {
          if (result.error?.message) errors.push(result.error.message);
          for (const err of result.errors || []) {
            if (err?.message) errors.push(err.message);
          }
        }

        rows.push({
          title: fullTitle,
          file: spec.file || "unknown",
          outcome: test.outcome || "unknown",
          durations: results
            .map((r) => r.duration)
            .filter((n) => Number.isFinite(n)),
          errors,
        });
      }
    }

    collectTestsFromSuites(suite.suites || [], nextParents, rows);
  }

  return rows;
}

function writeReports(outPath, payload) {
  const absOut = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(payload, null, 2), "utf8");

  const mdOut = absOut.replace(/\.json$/i, ".md");
  const lines = [
    "# Snapshot SLO Report",
    "",
    `- snapshotTests: ${payload.metrics.snapshotTests}`,
    `- materializationMsP95: ${payload.metrics.materializationMsP95}`,
    `- snapshotAvailability: ${payload.metrics.snapshotAvailability}`,
    `- undueMissingSnapshotRate: ${payload.metrics.undueMissingSnapshotRate}`,
    "",
    "## Baseline",
    `- materializationMsP95: ${payload.baseline.materializationMsP95}`,
    `- snapshotAvailability: ${payload.baseline.snapshotAvailability}`,
    `- undueMissingSnapshotRate: ${payload.baseline.undueMissingSnapshotRate}`,
    "",
    "## Thresholds",
    `- maxMaterializationMsP95: ${payload.thresholds.maxMaterializationMsP95}`,
    `- minSnapshotAvailability: ${payload.thresholds.minSnapshotAvailability}`,
    `- maxUndueMissingSnapshotRate: ${payload.thresholds.maxUndueMissingSnapshotRate}`,
    "",
    "## Gate",
    `- passed: ${payload.gate.passed}`,
  ];

  if (payload.gate.reasons.length > 0) {
    lines.push("- reasons:");
    for (const reason of payload.gate.reasons) {
      lines.push(`  - ${reason}`);
    }
  }

  fs.writeFileSync(mdOut, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv);
  const reportPath = path.resolve(process.cwd(), args.report);
  const baselinePath = path.resolve(process.cwd(), args.baseline);

  const report = readJsonRequired(reportPath, "playwright-report");
  const baselineDoc = readJsonRequired(baselinePath, "snapshot-baseline");

  const allTests = collectTestsFromSuites(report.suites || []);
  const snapshotTests = allTests.filter((t) => /snapshot/i.test(t.title));

  if (snapshotTests.length === 0) {
    console.error(
      "[snapshot-slo] Nenhum teste de snapshot encontrado no relatorio.",
    );
    process.exit(1);
  }

  const latencies = snapshotTests
    .map((t) => (t.durations.length > 0 ? Math.max(...t.durations) : 0))
    .filter((n) => Number.isFinite(n));

  const missingCount = snapshotTests.filter((t) =>
    t.errors.some((err) => looksLikeUndueMissingSnapshot(err)),
  ).length;

  const snapshotAvailability =
    (snapshotTests.length - missingCount) / snapshotTests.length;
  const undueMissingSnapshotRate = missingCount / snapshotTests.length;
  const materializationMsP95 = percentile(latencies, 95);

  const thresholds = baselineDoc.thresholds || {};
  const baseline = baselineDoc.baseline || {};

  const reasons = [];
  if (materializationMsP95 > Number(thresholds.maxMaterializationMsP95)) {
    reasons.push(
      `materializationMsP95=${materializationMsP95} acima do maximo ${thresholds.maxMaterializationMsP95}`,
    );
  }
  if (snapshotAvailability < Number(thresholds.minSnapshotAvailability)) {
    reasons.push(
      `snapshotAvailability=${snapshotAvailability} abaixo do minimo ${thresholds.minSnapshotAvailability}`,
    );
  }
  if (
    undueMissingSnapshotRate > Number(thresholds.maxUndueMissingSnapshotRate)
  ) {
    reasons.push(
      `undueMissingSnapshotRate=${undueMissingSnapshotRate} acima do maximo ${thresholds.maxUndueMissingSnapshotRate}`,
    );
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    baseline,
    thresholds,
    metrics: {
      snapshotTests: snapshotTests.length,
      materializationMsP95,
      snapshotAvailability,
      undueMissingSnapshotRate,
    },
    samples: snapshotTests.slice(0, 20).map((t) => ({
      title: t.title,
      file: t.file,
      outcome: t.outcome,
      maxDurationMs: t.durations.length > 0 ? Math.max(...t.durations) : 0,
      probableUndueMissingSnapshot: t.errors.some((err) =>
        looksLikeUndueMissingSnapshot(err),
      ),
      firstError: t.errors[0] || null,
    })),
    gate: {
      passed: reasons.length === 0,
      reasons,
    },
  };

  writeReports(args.out, payload);

  if (!payload.gate.passed) {
    console.error("[snapshot-slo] Gate de SLO falhou.");
    for (const reason of payload.gate.reasons) {
      console.error(`[snapshot-slo] ${reason}`);
    }
    process.exit(1);
  }

  console.log(
    "[snapshot-slo] OK: baseline e SLO de snapshot dentro dos thresholds.",
  );
}

main();
