import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    checklist: "docs/NORMATIVE_VALIDATION_CHECKLIST.md",
    policy: ".github/normative-checklist-policy.json",
    packageJson: "package.json",
    out: "artifacts/ci/normative-checklist-report.json",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;

    if (key === "--checklist") {
      args.checklist = value;
      i += 1;
    } else if (key === "--policy") {
      args.policy = value;
      i += 1;
    } else if (key === "--package") {
      args.packageJson = value;
      i += 1;
    } else if (key === "--out") {
      args.out = value;
      i += 1;
    }
  }

  return args;
}

function readTextRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[normative-gate] Arquivo obrigatorio ausente: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf8");
}

function readJsonRequired(filePath) {
  return JSON.parse(readTextRequired(filePath));
}

function extractCheckedIds(markdown) {
  const regex = /^\s*-\s*\[(?<checked>[ xX])\]\s+(?<id>[A-Z]+\d{2}):/gm;
  const map = new Map();

  for (const match of markdown.matchAll(regex)) {
    map.set(match.groups.id, match.groups.checked.toLowerCase() === "x");
  }

  return map;
}

function writeReports(outPath, payload) {
  const absOut = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(payload, null, 2), "utf8");

  const mdOut = absOut.replace(/\.json$/i, ".md");
  const lines = [
    "# Normative Checklist Report",
    "",
    `- passed: ${payload.gate.passed}`,
    `- criteriaTotal: ${payload.summary.total}`,
    `- criteriaOk: ${payload.summary.ok}`,
    "",
    "## Criteria",
  ];

  for (const item of payload.criteria) {
    lines.push(
      `- ${item.id} [${item.type}] checked=${item.checked} evidenceOk=${item.evidenceOk} scriptsOk=${item.scriptsOk}`,
    );
  }

  if (payload.gate.reasons.length > 0) {
    lines.push("", "## Gate Reasons");
    for (const reason of payload.gate.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  fs.writeFileSync(mdOut, `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv);
  const checklistPath = path.resolve(process.cwd(), args.checklist);
  const policyPath = path.resolve(process.cwd(), args.policy);
  const packagePath = path.resolve(process.cwd(), args.packageJson);

  const checklist = readTextRequired(checklistPath);
  const policy = readJsonRequired(policyPath);
  const pkg = readJsonRequired(packagePath);

  const checkedIds = extractCheckedIds(checklist);
  const scriptNames = new Set(Object.keys(pkg.scripts || {}));

  const reasons = [];
  const criteria = [];

  for (const criterion of policy.criteria || []) {
    const checked = checkedIds.get(criterion.id) === true;
    if (!checkedIds.has(criterion.id)) {
      reasons.push(`Criterio ${criterion.id} ausente no checklist markdown.`);
    }
    if (!checked) {
      reasons.push(`Criterio ${criterion.id} nao esta marcado como concluido.`);
    }

    const missingEvidence = [];
    for (const relPath of criterion.evidencePaths || []) {
      const abs = path.resolve(process.cwd(), relPath);
      if (!fs.existsSync(abs)) {
        missingEvidence.push(relPath);
      }
    }

    const missingScripts = [];
    for (const scriptName of criterion.requiredScripts || []) {
      if (!scriptNames.has(scriptName)) {
        missingScripts.push(scriptName);
      }
    }

    if (missingEvidence.length > 0) {
      reasons.push(
        `Criterio ${criterion.id} sem evidencias obrigatorias: ${missingEvidence.join(", ")}`,
      );
    }

    if (missingScripts.length > 0) {
      reasons.push(
        `Criterio ${criterion.id} sem scripts obrigatorios no package.json: ${missingScripts.join(", ")}`,
      );
    }

    criteria.push({
      id: criterion.id,
      type: criterion.type,
      checked,
      evidenceOk: missingEvidence.length === 0,
      scriptsOk: missingScripts.length === 0,
      missingEvidence,
      missingScripts,
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: criteria.length,
      ok: criteria.filter((c) => c.checked && c.evidenceOk && c.scriptsOk)
        .length,
    },
    criteria,
    gate: {
      passed: reasons.length === 0,
      reasons,
    },
  };

  writeReports(args.out, payload);

  if (!payload.gate.passed) {
    console.error("[normative-gate] Checklist normativo falhou.");
    for (const reason of payload.gate.reasons) {
      console.error(`[normative-gate] ${reason}`);
    }
    process.exit(1);
  }

  console.log(
    "[normative-gate] OK: checklist normativo executavel validado com evidencias.",
  );
}

main();
