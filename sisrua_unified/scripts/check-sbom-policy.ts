/**
 * Item 91 – SBOM Policy Gates
 *
 * Lê as dependências do package.json e verifica conformidade com a política
 * de segurança do projeto. Blocos por padrão de nome, licença proibida ou
 * versão vulnerável conhecida.
 *
 * Uso: tsx scripts/check-sbom-policy.ts [--strict]
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PolicyViolation {
  package: string;
  version: string;
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
}

interface SbomPolicyResult {
  passed: boolean;
  violations: string[];
  details: PolicyViolation[];
  checkedPackages: number;
  checkTime: string;
}

// ── Política de pacotes bloqueados ────────────────────────────────────────────

/**
 * Padrões de nomes de pacotes bloqueados por motivos de segurança ou licença.
 * Cada entrada: { pattern, rule, severity }
 */
const BLOCKED_PACKAGE_PATTERNS: Array<{
  pattern: RegExp;
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
}> = [
  // Pacotes com histórico de ataques supply-chain conhecidos
  {
    pattern: /^event-stream$/,
    rule: "Pacote comprometido em ataque supply-chain (2018)",
    severity: "critical",
  },
  {
    pattern: /^flatmap-stream$/,
    rule: "Dependência maliciosa do event-stream",
    severity: "critical",
  },
  {
    pattern: /^ua-parser-js$/,
    rule: "Pacote comprometido (2021, versões 0.7.29, 0.8.0, 1.0.0)",
    severity: "critical",
  },
  {
    pattern: /^node-ipc$/,
    rule: "Pacote com código malicioso inserido (2022)",
    severity: "critical",
  },

  // Pacotes de criptografia fracos ou inseguros
  {
    pattern: /^md5$/,
    rule: "Uso de MD5 para criptografia – algoritmo fraco",
    severity: "high",
  },
  {
    pattern: /^sha1$/,
    rule: "Uso de SHA1 puro – algoritmo fraco",
    severity: "high",
  },
  {
    pattern: /^des$/i,
    rule: "Cifra DES/3DES – insegura para dados sensíveis",
    severity: "high",
  },

  // Pacotes deprecados com vulnerabilidades conhecidas
  {
    pattern: /^request$/,
    rule: "Pacote 'request' deprecado – usar fetch nativo ou axios",
    severity: "medium",
  },
  {
    pattern: /^node-fetch@1\./,
    rule: "node-fetch v1.x com vulnerabilidade ReDoS conhecida",
    severity: "high",
  },

  // Pacotes de typosquatting comuns
  {
    pattern: /^expres$/,
    rule: "Possível typosquatting do pacote 'express'",
    severity: "critical",
  },
  {
    pattern: /^lodahs$/,
    rule: "Possível typosquatting do pacote 'lodash'",
    severity: "critical",
  },
  {
    pattern: /^reacts$/,
    rule: "Possível typosquatting do pacote 'react'",
    severity: "critical",
  },
  {
    pattern: /^mongose$/,
    rule: "Possível typosquatting do pacote 'mongoose'",
    severity: "critical",
  },

  // Pacotes de debug/desenvolvimento que não devem estar em produção
  {
    pattern: /^nodemon$/,
    rule: "Pacote de desenvolvimento – não deve estar em dependencies (use devDependencies)",
    severity: "low",
  },
  {
    pattern: /^ts-node$/,
    rule: "ts-node em dependencies de produção – mover para devDependencies",
    severity: "low",
  },

  // Licenças incompatíveis (GPL em projetos proprietários)
  {
    pattern: /^gpl-/i,
    rule: "Pacote com prefixo GPL – verificar compatibilidade de licença",
    severity: "medium",
  },
];

/**
 * Versões específicas bloqueadas por CVE conhecido.
 */
const BLOCKED_VERSIONS: Array<{
  package: string;
  versionPattern: RegExp;
  cve: string;
  severity: "critical" | "high" | "medium" | "low";
}> = [
  {
    package: "lodash",
    versionPattern: /^[34]\./,
    cve: "CVE-2019-10744 (prototype pollution)",
    severity: "high",
  },
  {
    package: "minimist",
    versionPattern: /^0\./,
    cve: "CVE-2020-7598 (prototype pollution)",
    severity: "high",
  },
  {
    package: "path-parse",
    versionPattern: /^1\.0\.[0-6]$/,
    cve: "CVE-2021-23343 (ReDoS)",
    severity: "medium",
  },
  {
    package: "json5",
    versionPattern: /^1\.[0-9]\.[0-9]$|^2\.2\.[0-1]$/,
    cve: "CVE-2022-46175 (prototype pollution)",
    severity: "high",
  },
  {
    package: "semver",
    versionPattern: /^[1-6]\./,
    cve: "CVE-2022-25883 (ReDoS em versões antigas)",
    severity: "medium",
  },
];

// ── Leitura do package.json ───────────────────────────────────────────────────

function readPackageDependencies(): Record<string, string> {
  const pkgPath = path.resolve(__dirname, "../package.json");

  try {
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
  } catch (err) {
    console.error(`[SBOM] Erro ao ler package.json: ${String(err)}`);
    process.exit(1);
  }
}

// ── Verificação de política ────────────────────────────────────────────────────

/**
 * Executa a verificação de política SBOM nas dependências do package.json.
 * Retorna resultado com violações encontradas.
 */
export function checkSbomPolicy(): SbomPolicyResult {
  const deps = readPackageDependencies();
  const violations: PolicyViolation[] = [];

  for (const [pkgName, pkgVersion] of Object.entries(deps)) {
    const cleanVersion = pkgVersion.replace(/^[\^~>=<\s]+/, "");

    // Verifica padrões de pacotes bloqueados
    for (const blocked of BLOCKED_PACKAGE_PATTERNS) {
      if (blocked.pattern.test(pkgName)) {
        violations.push({
          package: pkgName,
          version: cleanVersion,
          rule: blocked.rule,
          severity: blocked.severity,
        });
      }
    }

    // Verifica versões específicas bloqueadas
    for (const blocked of BLOCKED_VERSIONS) {
      if (
        blocked.package === pkgName &&
        blocked.versionPattern.test(cleanVersion)
      ) {
        violations.push({
          package: pkgName,
          version: cleanVersion,
          rule: `${blocked.cve} – versão ${cleanVersion} vulnerável`,
          severity: blocked.severity,
        });
      }
    }
  }

  const passed = violations.every((v) => v.severity === "low");
  const violationMessages = violations.map(
    (v) => `[${v.severity.toUpperCase()}] ${v.package}@${v.version}: ${v.rule}`,
  );

  return {
    passed,
    violations: violationMessages,
    details: violations,
    checkedPackages: Object.keys(deps).length,
    checkTime: new Date().toISOString(),
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function main(): void {
  console.log("🔍 Verificando política SBOM...\n");

  const result = checkSbomPolicy();

  console.log(`📦 Pacotes verificados: ${result.checkedPackages}`);
  console.log(`🕐 Data/hora: ${result.checkTime}\n`);

  if (result.violations.length === 0) {
    console.log("✅ Nenhuma violação de política encontrada.\n");
  } else {
    console.log(`⚠️  ${result.violations.length} violação(ões) encontrada(s):\n`);
    for (const violation of result.violations) {
      console.log(`  ${violation}`);
    }
    console.log("");
  }

  const criticalOrHigh = result.details.filter(
    (v) => v.severity === "critical" || v.severity === "high",
  );

  if (criticalOrHigh.length > 0) {
    console.error(
      `❌ FALHA: ${criticalOrHigh.length} violação(ões) crítica(s)/alta(s) encontrada(s).`,
    );
    process.exit(1);
  } else if (result.violations.length > 0) {
    console.warn("⚠️  AVISO: Violações de baixa/média severidade encontradas.");
    const strict = process.argv.includes("--strict");
    if (strict) {
      console.error("❌ Modo strict ativado: todas as violações causam falha.");
      process.exit(1);
    }
  } else {
    console.log("✅ Verificação SBOM aprovada.");
  }
}

// Executa como script se invocado diretamente
const isMain = process.argv[1]?.endsWith("check-sbom-policy.ts") ||
               process.argv[1]?.endsWith("check-sbom-policy.js");
if (isMain) {
  main();
}
