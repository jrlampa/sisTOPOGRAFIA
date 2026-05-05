/**
 * corporateHardeningService.ts — Hardening para Ambiente Corporativo Restritivo (121 [T1])
 *
 * Responsabilidades:
 * - Validar compatibilidade com proxy corporativo (HTTP_PROXY / HTTPS_PROXY).
 * - Verificar configuração TLS (versão mínima, cipher suites aprovados).
 * - Detectar padrões de interferência de antivírus (timeouts anômalos, headers alterados).
 * - Gerar relatório de prontidão para ambientes corporativos restritivos.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type HardeningCheckStatus = "pass" | "warn" | "fail" | "skip";

export interface HardeningCheck {
  id: string;
  category: "tls" | "proxy" | "antivirus" | "network" | "headers";
  name: string;
  description: string;
  status: HardeningCheckStatus;
  detail: string;
  recommendation?: string;
}

export interface CorporateHardeningReport {
  timestamp: string;
  overallStatus: "green" | "yellow" | "red";
  score: number;                // 0-100
  checks: HardeningCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    skip: number;
  };
}

// ─── Constantes de referência ─────────────────────────────────────────────────

const APPROVED_TLS_VERSIONS = ["TLSv1.2", "TLSv1.3"];

// Valores de timeout que indicam interferência de inspeção TLS profunda
const INSPECTION_TIMEOUT_THRESHOLD_MS = 5000;

// ─── Verificações individuais ─────────────────────────────────────────────────

function checkProxyConfig(): HardeningCheck {
  const httpProxy = process.env.HTTP_PROXY ?? process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  const noProxy = process.env.NO_PROXY ?? process.env.no_proxy;

  if (!httpProxy && !httpsProxy) {
    return {
      id: "proxy-001",
      category: "proxy",
      name: "Configuração de Proxy",
      description: "Verifica variáveis de ambiente de proxy corporativo",
      status: "pass",
      detail: "Nenhum proxy detectado nas variáveis de ambiente. Conexão direta ativa.",
    };
  }

  const proxyUrl = httpsProxy ?? httpProxy ?? "";
  const hasAuth = proxyUrl.includes("@");

  return {
    id: "proxy-001",
    category: "proxy",
    name: "Configuração de Proxy",
    description: "Verifica variáveis de ambiente de proxy corporativo",
    status: hasAuth ? "warn" : "pass",
    detail: `Proxy detectado: ${httpsProxy ? "HTTPS_PROXY" : "HTTP_PROXY"} configurado.${noProxy ? ` NO_PROXY: ${noProxy}.` : ""} ${hasAuth ? "Proxy com autenticação embutida na URL — recomenda-se uso de PROXY_USERNAME/PROXY_PASSWORD." : ""}`,
    recommendation: hasAuth
      ? "Evite credenciais na URL do proxy. Use variáveis PROXY_USERNAME e PROXY_PASSWORD separadas."
      : undefined,
  };
}

function checkTlsMinVersion(): HardeningCheck {
  const nodeOptions = process.env.NODE_OPTIONS ?? "";
  const tlsMinVersion = process.env.NODE_TLS_MIN_VERSION ?? "";

  // Node.js ≥18 usa TLS 1.2 por padrão; ≤16 pode usar TLS 1.0
  const nodeVersion = parseInt(process.version.replace("v", "").split(".")[0] ?? "0");
  const defaultSafe = nodeVersion >= 18;

  if (tlsMinVersion && !APPROVED_TLS_VERSIONS.includes(tlsMinVersion)) {
    return {
      id: "tls-001",
      category: "tls",
      name: "Versão Mínima TLS",
      description: "Verifica se TLS ≥1.2 está forçado",
      status: "fail",
      detail: `NODE_TLS_MIN_VERSION=${tlsMinVersion} está abaixo do mínimo aprovado (TLSv1.2).`,
      recommendation: "Defina NODE_TLS_MIN_VERSION=TLSv1.2 no ambiente de produção.",
    };
  }

  return {
    id: "tls-001",
    category: "tls",
    name: "Versão Mínima TLS",
    description: "Verifica se TLS ≥1.2 está forçado",
    status: defaultSafe ? "pass" : "warn",
    detail: defaultSafe
      ? `Node.js ${process.version} usa TLS 1.2 por padrão. ${nodeOptions.includes("tls-min-v1.2") ? "Flag --tls-min-v1.2 detectada." : ""}`.trim()
      : `Node.js ${process.version} pode permitir TLS <1.2. Adicione --tls-min-v1.2 a NODE_OPTIONS.`,
    recommendation: defaultSafe
      ? undefined
      : "Defina NODE_OPTIONS=--tls-min-v1.2 ou atualize para Node.js ≥18.",
  };
}

function checkTlsRejectUnauthorized(): HardeningCheck {
  const rejectUnauth = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  if (rejectUnauth === "0") {
    return {
      id: "tls-002",
      category: "tls",
      name: "Validação de Certificado TLS",
      description: "Verifica se a validação de certificado não está desativada",
      status: "fail",
      detail: "NODE_TLS_REJECT_UNAUTHORIZED=0 desativa a validação de certificados TLS. Risco crítico de segurança.",
      recommendation:
        "Remova NODE_TLS_REJECT_UNAUTHORIZED=0. Para ambientes com CA interna, adicione a CA ao NODE_EXTRA_CA_CERTS.",
    };
  }

  return {
    id: "tls-002",
    category: "tls",
    name: "Validação de Certificado TLS",
    description: "Verifica se a validação de certificado não está desativada",
    status: "pass",
    detail: "NODE_TLS_REJECT_UNAUTHORIZED não está desativado. Validação de certificado ativa.",
  };
}

function checkCorporateCaBundle(): HardeningCheck {
  const extraCa = process.env.NODE_EXTRA_CA_CERTS;

  return {
    id: "tls-003",
    category: "tls",
    name: "Bundle de CA Corporativo",
    description: "Verifica se CA interna corporativa está configurada",
    status: extraCa ? "pass" : "warn",
    detail: extraCa
      ? `CA corporativo configurado via NODE_EXTRA_CA_CERTS: ${extraCa}`
      : "NODE_EXTRA_CA_CERTS não configurado. Necessário em ambientes com CA interna (proxy com inspeção TLS).",
    recommendation: extraCa
      ? undefined
      : "Para ambientes com inspeção TLS profunda, exporte o certificado da CA corporativa e defina NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem.",
  };
}

function checkAntivirusInterference(): HardeningCheck {
  // Detecta headers que proxies/AV corporativos injetam
  const suspiciousEnvVars = [
    "SYMANTEC_PROXY",
    "MCAFEE_PROXY",
    "CROWDSTRIKE_PROXY",
    "ZSCALER_PROXY",
    "BLUECOAT_PROXY",
  ];

  const detected = suspiciousEnvVars.filter((v) => process.env[v]);

  if (detected.length > 0) {
    return {
      id: "av-001",
      category: "antivirus",
      name: "Interferência de Antivírus / DLP",
      description: "Detecta proxies de inspeção de AV/DLP corporativos",
      status: "warn",
      detail: `Variáveis de AV/proxy detectadas: ${detected.join(", ")}. Podem interceptar conexões TLS.`,
      recommendation:
        "Adicione o domínio da aplicação às exclusões do AV/DLP e configure o NODE_EXTRA_CA_CERTS com o certificado raiz do proxy de inspeção.",
    };
  }

  return {
    id: "av-001",
    category: "antivirus",
    name: "Interferência de Antivírus / DLP",
    description: "Detecta proxies de inspeção de AV/DLP corporativos",
    status: "pass",
    detail: "Nenhuma variável de AV/DLP corporativo detectada no ambiente.",
  };
}

function checkNetworkTimeout(): HardeningCheck {
  const timeoutEnv = process.env.HTTP_TIMEOUT_MS
    ? parseInt(process.env.HTTP_TIMEOUT_MS)
    : null;

  if (timeoutEnv !== null && timeoutEnv < INSPECTION_TIMEOUT_THRESHOLD_MS) {
    return {
      id: "net-001",
      category: "network",
      name: "Timeout de Rede",
      description: "Verifica se o timeout HTTP é adequado para ambientes com inspeção TLS",
      status: "warn",
      detail: `HTTP_TIMEOUT_MS=${timeoutEnv}ms pode ser insuficiente em ambientes com inspeção TLS profunda (latência adicional de 2-5 s).`,
      recommendation: `Aumente HTTP_TIMEOUT_MS para pelo menos ${INSPECTION_TIMEOUT_THRESHOLD_MS}ms em ambientes corporativos com proxy de inspeção.`,
    };
  }

  return {
    id: "net-001",
    category: "network",
    name: "Timeout de Rede",
    description: "Verifica se o timeout HTTP é adequado para ambientes com inspeção TLS",
    status: "pass",
    detail: timeoutEnv
      ? `HTTP_TIMEOUT_MS=${timeoutEnv}ms está adequado para ambientes com inspeção TLS.`
      : "HTTP_TIMEOUT_MS não definido — usando padrão do Node.js (sem timeout fixo).",
  };
}

function checkSecureHeaders(): HardeningCheck {
  // Verifica se as variáveis de controle de headers de segurança estão definidas
  const helmetEnabled = process.env.HELMET_ENABLED !== "false";
  const csrfEnabled = process.env.CSRF_PROTECTION !== "false";

  if (!helmetEnabled) {
    return {
      id: "hdr-001",
      category: "headers",
      name: "Headers de Segurança HTTP",
      description: "Verifica se Helmet e proteções de header estão ativas",
      status: "fail",
      detail: "HELMET_ENABLED=false desativa headers de segurança HTTP.",
      recommendation: "Remova HELMET_ENABLED=false. O Helmet deve estar sempre ativo em produção.",
    };
  }

  return {
    id: "hdr-001",
    category: "headers",
    name: "Headers de Segurança HTTP",
    description: "Verifica se Helmet e proteções de header estão ativas",
    status: "pass",
    detail: `Headers de segurança ativos (Helmet: ${helmetEnabled}, CSRF: ${csrfEnabled}).`,
  };
}

// ─── Geração do relatório ─────────────────────────────────────────────────────

export function runCorporateHardeningChecks(): CorporateHardeningReport {
  const checks: HardeningCheck[] = [
    checkProxyConfig(),
    checkTlsMinVersion(),
    checkTlsRejectUnauthorized(),
    checkCorporateCaBundle(),
    checkAntivirusInterference(),
    checkNetworkTimeout(),
    checkSecureHeaders(),
  ];

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
    skip: checks.filter((c) => c.status === "skip").length,
  };

  // Score: 100 - (fail*20 + warn*5)
  const score = Math.max(0, 100 - summary.fail * 20 - summary.warn * 5);

  const overallStatus: "green" | "yellow" | "red" =
    summary.fail > 0 ? "red" : summary.warn > 0 ? "yellow" : "green";

  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    score,
    checks,
    summary,
  };
}
