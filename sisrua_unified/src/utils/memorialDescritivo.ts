import { downloadText, sanitizeFilename } from "./downloads";

type UnknownRecord = Record<string, unknown>;

export interface MemorialDownloadMetadata {
  projectName?: string;
  companyName?: string;
  engineerName?: string;
  revision?: string;
  date?: string;
  selectionMode?: "circle" | "polygon" | "measure";
  radiusMeters?: number;
  center?: { lat: number; lng: number };
}

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const formatNumber = (value: number | null, digits = 2): string => {
  if (value === null) {
    return "N/D";
  }

  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) {
    return new Date().toLocaleString("pt-BR");
  }

  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? new Date().toLocaleString("pt-BR")
    : parsed.toLocaleString("pt-BR");
};

const readContextMetrics = (btContext: UnknownRecord) => {
  const topology = asRecord(btContext.topology);
  const cqtSnapshot = asRecord(btContext.cqtSnapshot);
  const cqtComputationInputs = asRecord(btContext.cqtComputationInputs);

  const poles = Array.isArray(topology?.poles) ? topology?.poles.length : null;
  const transformers = Array.isArray(topology?.transformers)
    ? topology?.transformers.length
    : null;
  const edges = Array.isArray(topology?.edges) ? topology?.edges.length : null;

  const totals = {
    poles: asNumber(btContext.totalPoles) ?? poles,
    transformers: asNumber(btContext.totalTransformers) ?? transformers,
    edges: asNumber(btContext.totalEdges) ?? edges,
    verifiedPoles: asNumber(btContext.verifiedPoles),
    verifiedTransformers: asNumber(btContext.verifiedTransformers),
    verifiedEdges: asNumber(btContext.verifiedEdges),
  };

  const branchSnapshot = asRecord(cqtSnapshot?.branches);
  const dbSnapshot = asRecord(cqtSnapshot?.db);
  const geralSnapshot = asRecord(cqtSnapshot?.geral);
  const dmdiSnapshot = asRecord(cqtSnapshot?.dmdi);
  const qtPontoConfig = asRecord(cqtSnapshot?.qtPontoConfig);

  const cqt = {
    scenario:
      asString(cqtSnapshot?.scenario) ??
      asString(cqtComputationInputs?.scenario) ??
      "atual",
    dmdi: asNumber(dmdiSnapshot?.dmdi),
    p31: asNumber(geralSnapshot?.p31CqtNoPonto),
    p32: asNumber(geralSnapshot?.p32CqtNoPonto),
    k10QtMttr: asNumber(dbSnapshot?.k10QtMttr),
    okCount: asNumber(branchSnapshot?.okCount),
    verificarCount: asNumber(branchSnapshot?.verificarCount),
    qtMethod:
      asString(qtPontoConfig?.calculationMethod) ??
      asString(cqtComputationInputs?.qtPontoCalculationMethod) ??
      "impedance_modulus",
    powerFactor:
      asNumber(qtPontoConfig?.powerFactor) ??
      asNumber(cqtComputationInputs?.powerFactor),
  };

  const criticalPole = asRecord(btContext.criticalPole);

  return {
    totals,
    cqt,
    generatedAt: asString(cqtSnapshot?.generatedAt),
    projectType: asString(btContext.projectType) ?? "ramais",
    scenario: asString(btContext.btNetworkScenario) ?? "asis",
    criticalPoleId: asString(criticalPole?.poleId),
    criticalPoleDemand: asNumber(criticalPole?.accumulatedDemandKva),
    clandestinoAreaM2: asNumber(btContext.clandestinoAreaM2),
  };
};

const qtMethodDescription = (
  qtMethod: string,
  powerFactor: number | null,
): string => {
  if (qtMethod === "power_factor") {
    return `Formula projetada por fator de potencia (R*cos(phi) + X*sin(phi)), com cos(phi) = ${formatNumber(powerFactor, 2)}.`;
  }

  return "Formula por modulo da impedancia (|Z|), abordagem conservadora e aderente ao workbook de referencia.";
};

export function buildMemorialDescritivo(
  btContextRaw: Record<string, unknown>,
  metadata: MemorialDownloadMetadata,
): string {
  const btContext = asRecord(btContextRaw) ?? {};
  const metrics = readContextMetrics(btContext);
  const now = new Date();
  const projectName = metadata.projectName ?? "Projeto BT";
  const engineerName = metadata.engineerName ?? "Responsavel tecnico";
  const companyName = metadata.companyName ?? "Empresa contratada";
  const referenceDate = metadata.date ?? now.toLocaleDateString("pt-BR");
  const revision = metadata.revision ?? "R00";
  const selectionMode = metadata.selectionMode ?? "circle";
  const radiusText =
    typeof metadata.radiusMeters === "number"
      ? `${formatNumber(metadata.radiusMeters, 0)} m`
      : "N/D";
  const centerText = metadata.center
    ? `${formatNumber(metadata.center.lat, 6)}, ${formatNumber(metadata.center.lng, 6)}`
    : "N/D";

  return `# MEMORIAL DESCRITIVO TECNICO

## 1. Identificacao do Empreendimento

- Projeto: ${projectName}
- Empresa: ${companyName}
- Responsavel tecnico: ${engineerName}
- Revisao: ${revision}
- Data de referencia: ${referenceDate}
- Emissao do documento: ${now.toLocaleString("pt-BR")}

## 2. Objeto

Este memorial descreve, de forma tecnica e profissional, os criterios adotados para geracao do arquivo DXF, consolidacao da topologia BT e avaliacao eletrica de suporte ao dimensionamento preliminar da rede.

## 3. Escopo e Parametros de Exportacao

- Modo de selecao espacial: ${selectionMode}
- Raio de analise: ${radiusText}
- Centro geoespacial (lat, lng): ${centerText}
- Tipo de projeto BT: ${metrics.projectType}
- Cenario da rede BT: ${metrics.scenario}
- Area clandestina considerada: ${formatNumber(metrics.clandestinoAreaM2, 0)} m2

## 4. Referencias Tecnicas

- ABNT NBR 5410 - Instalacoes eletricas de baixa tensao.
- Praticas de engenharia de distribuicao aplicadas ao planejamento de rede BT.
- Base de criterios e paridade com planilha de referencia de CQT.

## 5. Caracterizacao da Rede BT

- Quantidade total de postes: ${formatNumber(metrics.totals.poles, 0)}
- Quantidade total de transformadores: ${formatNumber(metrics.totals.transformers, 0)}
- Quantidade total de trechos BT: ${formatNumber(metrics.totals.edges, 0)}
- Postes verificados: ${formatNumber(metrics.totals.verifiedPoles, 0)}
- Transformadores verificados: ${formatNumber(metrics.totals.verifiedTransformers, 0)}
- Trechos verificados: ${formatNumber(metrics.totals.verifiedEdges, 0)}
- Polo critico (ID): ${metrics.criticalPoleId ?? "N/D"}
- Demanda acumulada no polo critico: ${formatNumber(metrics.criticalPoleDemand, 2)} kVA

## 6. Metodologia de Calculo Eletrico (CQT)

- Cenario CQT: ${metrics.cqt.scenario}
- Metodo de QT-PONTO: ${qtMethodDescription(metrics.cqt.qtMethod, metrics.cqt.powerFactor)}
- DMDI calculado: ${formatNumber(metrics.cqt.dmdi, 6)}
- CQT no ponto (lado esquerdo): ${formatNumber(metrics.cqt.p31, 6)}
- CQT no ponto (lado direito): ${formatNumber(metrics.cqt.p32, 6)}
- QT MTTR (k10): ${formatNumber(metrics.cqt.k10QtMttr, 9)}
- Trechos em conformidade (OK): ${formatNumber(metrics.cqt.okCount, 0)}
- Trechos com verificacao recomendada: ${formatNumber(metrics.cqt.verificarCount, 0)}
- Carimbo de geracao do snapshot CQT: ${formatDateTime(metrics.generatedAt)}

## 7. Consideracoes Tecnicas

1. Os resultados apresentados constituem base tecnica para analise de engenharia e devem ser validados em etapa executiva.
2. Trechos sinalizados como "VERIFICAR" demandam revisao de criterio de protecao, condutor e/ou arranjo da rede.
3. Alteracoes de topologia, carregamento e cenario modificam os indicadores e exigem reprocessamento do DXF e deste memorial.

## 8. Conclusao

O presente memorial acompanha o artefato DXF para rastreabilidade tecnica da exportacao, registrando premissas, parametros e principais indicadores de rede BT e CQT.

---

Documento gerado automaticamente pelo sisrua_unified.
`;
}

export function downloadMemorialDescritivo(
  btContext: Record<string, unknown>,
  metadata: MemorialDownloadMetadata,
): string {
  const content = buildMemorialDescritivo(btContext, metadata);
  const baseName = (metadata.projectName ?? "projeto_bt")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  const filename = sanitizeFilename(
    `${baseName}_memorial_descritivo_${timestamp}.md`,
  );

  downloadText(content, filename);
  return filename;
}
