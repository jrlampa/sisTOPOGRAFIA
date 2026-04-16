import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checklistPath = path.join(root, "docs", "CHECKPOINTS-TIMELINE.md");
const policyPath = path.join(root, ".github", "quality-gates-policy.json");
const workflowPath = path.join(
  root,
  ".github",
  "workflows",
  "quality-gates.yml",
);

function fail(message) {
  console.error(`\n[checkpoint-gate] ${message}`);
  process.exit(1);
}

function readUtf8(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Arquivo obrigatorio nao encontrado: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function extractChecklistIds(markdown, prefix) {
  const regex = new RegExp(
    `^\\s*-\\s*\\[(?<checked>[ xX])\\]\\s+(?<id>${prefix}\\d{2,3}):`,
    "gm",
  );
  const items = [];

  for (const match of markdown.matchAll(regex)) {
    items.push({
      id: match.groups.id,
      checked: match.groups.checked.toLowerCase() === "x",
    });
  }

  return items;
}

function ensureJobDefined(workflow, jobName) {
  const jobToken = `\n  ${jobName}:`;
  return workflow.includes(jobToken);
}

function extractQualityGateNeedsBlock(workflow) {
  const match = workflow.match(
    /\n\s{2}quality-gate:\s*[\s\S]*?\n\s{4}needs:\s*\[(?<needs>[^\]]+)\]/m,
  );
  return match?.groups?.needs ?? "";
}

function ensureJobInNeeds(needsBlock, jobName) {
  const compactNeeds = needsBlock.replace(/\s+/g, " ");
  return compactNeeds.includes(jobName);
}

const checklist = readUtf8(checklistPath);
const workflow = readUtf8(workflowPath);
const policyRaw = readUtf8(policyPath);
const policy = JSON.parse(policyRaw);

const mustHave = extractChecklistIds(checklist, "MH");
const dPlus5 = extractChecklistIds(checklist, "D5");
const dPlus7 = extractChecklistIds(checklist, "D7");

if (mustHave.length === 0) {
  fail("Nenhum item Must Have encontrado no checklist (esperado prefixo MH).");
}
if (dPlus5.length === 0) {
  fail("Nenhum criterio D+5 encontrado no checklist (esperado prefixo D5).");
}
if (dPlus7.length === 0) {
  fail("Nenhum criterio D+7 encontrado no checklist (esperado prefixo D7).");
}

const unchecked = [...mustHave, ...dPlus5, ...dPlus7].filter(
  (item) => !item.checked,
);
if (unchecked.length > 0) {
  fail(
    `Existem itens desmarcados no checklist: ${unchecked.map((i) => i.id).join(", ")}`,
  );
}

const policyMustIds = new Set((policy.mustHave || []).map((item) => item.id));
const policyD5Ids = new Set((policy.dPlus5 || []).map((item) => item.id));
const policyD7Ids = new Set((policy.dPlus7 || []).map((item) => item.id));

for (const item of mustHave) {
  if (!policyMustIds.has(item.id)) {
    fail(
      `Item ${item.id} presente no checklist e ausente em .github/quality-gates-policy.json (mustHave).`,
    );
  }
}
for (const item of dPlus5) {
  if (!policyD5Ids.has(item.id)) {
    fail(
      `Item ${item.id} presente no checklist e ausente em .github/quality-gates-policy.json (dPlus5).`,
    );
  }
}
for (const item of dPlus7) {
  if (!policyD7Ids.has(item.id)) {
    fail(
      `Item ${item.id} presente no checklist e ausente em .github/quality-gates-policy.json (dPlus7).`,
    );
  }
}

const needsBlock = extractQualityGateNeedsBlock(workflow);
if (!needsBlock) {
  fail("Nao foi possivel localizar o job quality-gate no workflow.");
}

const requiredJobsForQualityGate = [
  ...(policy.mustHave || []),
  ...(policy.dPlus5 || []),
]
  .map((item) => item.job)
  .filter((job, index, arr) => arr.indexOf(job) === index);

for (const jobName of requiredJobsForQualityGate) {
  if (!ensureJobDefined(workflow, jobName)) {
    fail(`Job obrigatorio nao definido no workflow: ${jobName}`);
  }
  if (jobName !== "quality-gate" && !ensureJobInNeeds(needsBlock, jobName)) {
    fail(`Job obrigatorio fora do needs do quality-gate: ${jobName}`);
  }
}

const requiredD7Jobs = (policy.dPlus7 || [])
  .map((item) => item.job)
  .filter((job, index, arr) => arr.indexOf(job) === index);

for (const jobName of requiredD7Jobs) {
  if (!ensureJobDefined(workflow, jobName)) {
    fail(`Job D+7 obrigatorio nao definido no workflow: ${jobName}`);
  }
}

console.log(
  "[checkpoint-gate] OK: Must Have, D+5 e D+7 estao automatizados e obrigatorios no CI.",
);
