import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    evidence: ".github/d7-go-parcial-evidence.json",
    out: "artifacts/ci/d7-go-parcial-report.json",
    runUrl: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;

    if (key === "--evidence") {
      args.evidence = value;
      i += 1;
    } else if (key === "--out") {
      args.out = value;
      i += 1;
    } else if (key === "--run-url") {
      args.runUrl = value;
      i += 1;
    }
  }

  return args;
}

function readJsonRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de evidencia obrigatorio ausente: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikeDate(value) {
  if (!isNonEmptyString(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function looksLikeHttpUrl(value) {
  if (!isNonEmptyString(value)) return false;
  return /^https?:\/\//i.test(value);
}

function writeReport(outPath, payload) {
  const absOut = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(payload, null, 2), "utf8");

  const mdOut = absOut.replace(/\.json$/i, ".md");
  const md = [
    "# D+7 Go Parcial Gate Report",
    "",
    `- passed: ${payload.gate.passed}`,
    `- decision: ${payload.decision ?? "N/A"}`,
    `- checkpoint: ${payload.checkpoint ?? "N/A"}`,
    `- evidenceFile: ${payload.evidenceFile}`,
    "",
    "## Reasons",
    ...(payload.gate.reasons.length > 0
      ? payload.gate.reasons.map((reason) => `- ${reason}`)
      : ["- Nenhuma falha encontrada."]),
  ].join("\n");

  fs.writeFileSync(mdOut, `${md}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv);
  const evidencePath = path.resolve(process.cwd(), args.evidence);
  const evidence = readJsonRequired(evidencePath);

  const reasons = [];

  if (evidence.checkpoint !== "D+7") {
    reasons.push("checkpoint deve ser exatamente 'D+7'.");
  }

  if (!["GO_PARCIAL", "NO_GO"].includes(evidence.decision)) {
    reasons.push("decision deve ser GO_PARCIAL ou NO_GO.");
  }

  if (!looksLikeDate(evidence.decidedAt)) {
    reasons.push("decidedAt deve ser data valida em formato ISO.");
  }

  const executionLinks = evidence.executionLinks || {};
  const executionLinkKeys = [
    "qualityGatesRunUrl",
    "releaseRunUrl",
    "normativeChecklistReportUrl",
  ];
  for (const key of executionLinkKeys) {
    if (!looksLikeHttpUrl(executionLinks[key])) {
      reasons.push(`executionLinks.${key} deve ser URL http(s) valida.`);
    }
  }

  const testResults = evidence.testResults || {};
  const testKeys = ["backend", "frontend", "e2eSmoke", "snapshotSlo"];
  for (const key of testKeys) {
    const item = testResults[key];
    if (!item || !["pass", "fail", "waived"].includes(item.status)) {
      reasons.push(`testResults.${key}.status deve ser pass/fail/waived.`);
      continue;
    }
    if (!isNonEmptyString(item.evidence)) {
      reasons.push(`testResults.${key}.evidence deve ser preenchido.`);
    }
  }

  const residualRisk = evidence.residualRisk || {};
  if (!["green", "yellow", "red"].includes(residualRisk.status)) {
    reasons.push("residualRisk.status deve ser green/yellow/red.");
  }
  if (!isNonEmptyString(residualRisk.summary)) {
    reasons.push("residualRisk.summary deve ser preenchido.");
  }
  if (!isNonEmptyString(residualRisk.mitigation)) {
    reasons.push("residualRisk.mitigation deve ser preenchido.");
  }
  if (!isNonEmptyString(residualRisk.owner)) {
    reasons.push("residualRisk.owner deve ser preenchido.");
  }
  if (!looksLikeDate(residualRisk.reviewBy)) {
    reasons.push("residualRisk.reviewBy deve ser data valida.");
  }

  const signatures = Array.isArray(evidence.ownersSignatures)
    ? evidence.ownersSignatures
    : [];
  if (signatures.length < 3) {
    reasons.push("ownersSignatures deve conter ao menos 3 assinaturas.");
  }

  const requiredRoles = ["Tech Lead", "QA", "DevOps"];
  for (const role of requiredRoles) {
    const signature = signatures.find((item) => item.role === role);
    if (!signature) {
      reasons.push(`Assinatura obrigatoria ausente para role: ${role}.`);
      continue;
    }
    if (!isNonEmptyString(signature.name)) {
      reasons.push(`ownersSignatures (${role}) deve conter name.`);
    }
    if (!looksLikeDate(signature.signedAt)) {
      reasons.push(`ownersSignatures (${role}) deve conter signedAt valido.`);
    }
    if (!isNonEmptyString(signature.signature)) {
      reasons.push(`ownersSignatures (${role}) deve conter signature.`);
    }
  }

  if (
    evidence.decision === "GO_PARCIAL" &&
    ["backend", "frontend", "e2eSmoke", "snapshotSlo"].some(
      (k) => testResults[k]?.status === "fail",
    )
  ) {
    reasons.push(
      "GO_PARCIAL nao permite status fail em testResults obrigatorios.",
    );
  }

  if (evidence.decision === "GO_PARCIAL" && residualRisk.status === "red") {
    reasons.push("GO_PARCIAL nao permite residualRisk.status red.");
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    evidenceFile: args.evidence,
    checkpoint: evidence.checkpoint,
    decision: evidence.decision,
    runUrl: args.runUrl || executionLinks.qualityGatesRunUrl || "",
    gate: {
      passed: reasons.length === 0,
      reasons,
    },
  };

  writeReport(args.out, payload);

  if (!payload.gate.passed) {
    console.error("[d7-go-parcial-gate] Evidencia D+7 invalida.");
    for (const reason of payload.gate.reasons) {
      console.error(`[d7-go-parcial-gate] ${reason}`);
    }
    process.exit(1);
  }

  console.log(
    "[d7-go-parcial-gate] OK: decisao D+7 validada por artefato unico.",
  );
}

main();
