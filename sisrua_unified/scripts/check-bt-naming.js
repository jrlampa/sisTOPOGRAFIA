#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INCLUDE_DIRS = ['src', 'server'];
const EXTENSIONS = new Set(['.ts', '.tsx']);

const invalidPatterns = [
  { regex: /\buseBT[A-Z]\w*/g, reason: 'Use prefixo useBt (camel) para hooks.' },
  { regex: /\bsetBT[A-Z]\w*/g, reason: 'Use prefixo setBt (camel) para setters.' },
  { regex: /\bgetBT[A-Z]\w*/g, reason: 'Use prefixo getBt (camel) para getters.' },
  { regex: /\bBT[A-Z][a-z]\w*/g, reason: 'Use Bt (Pascal) em tipos/componentes, ou BT_SNAKE_CASE em constantes.' },
  { regex: /\bbT[A-Z]\w*/g, reason: 'Use bt (camel) para variáveis e propriedades.' },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
        continue;
      }
      walk(fullPath, files);
      continue;
    }

    const ext = path.extname(entry.name);
    if (EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function run() {
  const targets = INCLUDE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
  const findings = [];

  for (const file of targets) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      invalidPatterns.forEach(({ regex, reason }) => {
        regex.lastIndex = 0;
        const match = regex.exec(line);
        if (match) {
          findings.push({
            file: path.relative(ROOT, file).replace(/\\/g, '/'),
            line: index + 1,
            token: match[0],
            reason,
          });
        }
      });
    });
  }

  if (findings.length === 0) {
    console.log('OK: Nenhuma inconsistência Bt/BT/bt encontrada.');
    process.exit(0);
  }

  console.error('Falha: inconsistências de nomenclatura Bt/BT/bt encontradas:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} -> ${finding.token} (${finding.reason})`);
  }
  process.exit(1);
}

run();
