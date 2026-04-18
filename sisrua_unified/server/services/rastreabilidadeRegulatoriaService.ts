/**
 * rastreabilidadeRegulatoriaService.ts — Matriz de Rastreabilidade Regulatória (Ponto 116 [T1]).
 *
 * Mapeamento bidirecional: Requisito ANEEL/LGPD → Teste Técnico → Artefato produzido.
 * Suporta consulta por norma, por status de conformidade e exportação para RFP/licitações.
 */

export type FonteNorma = 'ANEEL' | 'ANPD' | 'NBR' | 'INTERNA';
export type StatusConformidade = 'conforme' | 'parcial' | 'nao_conforme' | 'nao_avaliado';

export interface RequisitoRegulatorio {
  id: string;
  norma: string;
  fonte: FonteNorma;
  descricao: string;
  artigo?: string;
  resolucao?: string;
}

export interface ArtefatoEvidencia {
  tipo: 'servico' | 'rota' | 'teste' | 'migracao' | 'documento';
  referencia: string;
  descricao: string;
}

export interface ItemRastreabilidade {
  id: string;
  requisito: RequisitoRegulatorio;
  implementacoes: ArtefatoEvidencia[];
  testes: ArtefatoEvidencia[];
  status: StatusConformidade;
  observacao?: string;
  verificadoEm: Date;
}

export interface RelatorioRastreabilidade {
  totalItens: number;
  conformes: number;
  parciais: number;
  naoConformes: number;
  naoAvaliados: number;
  percentualConformidade: number;
  itens: ItemRastreabilidade[];
}

// Matriz canônica pré-carregada (requisitos ANEEL/LGPD mapeados à implementação)
const matrizCanonica: ItemRastreabilidade[] = [
  {
    id: 'RT-001',
    requisito: {
      id: 'BDGD-R1',
      norma: 'PRODIST Módulo 2 / REN 956',
      fonte: 'ANEEL',
      descricao: 'Exportação BDGD com campos obrigatórios (COD_ID, CTMT, CEP, MUN)',
      resolucao: 'REN 956/2021',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/bdgdValidatorService.ts', descricao: 'Validador R1–R6: obrigatoriedade, maxLength, COD_ID único, geometria' },
      { tipo: 'rota', referencia: 'POST /api/bdgd/validate', descricao: 'Endpoint de validação BDGD' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/bdgdValidatorService.test.ts', descricao: '18 testes cobrindo todas as regras BDGD' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-002',
    requisito: {
      id: 'LGPD-ART7',
      norma: 'LGPD Art.7º / Art.11',
      fonte: 'ANPD',
      descricao: 'Base legal por fluxo de tratamento e atendimento a direitos de titulares (Art.18/19)',
      artigo: 'Art. 7º, 11, 18, 19',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/lgpdFlowService.ts', descricao: 'RIPD automatizado, base legal, direitos titulares' },
      { tipo: 'rota', referencia: 'GET/POST /api/lgpd/fluxos', descricao: 'Endpoints de fluxos LGPD' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/lgpdFlowService.test.ts', descricao: '26 testes cobrindo RIPD e direitos' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-003',
    requisito: {
      id: 'LGPD-ART48',
      norma: 'LGPD Art.48 / Res. CD/ANPD nº 4/2023',
      fonte: 'ANPD',
      descricao: 'Notificação de incidentes à ANPD em até 72h',
      artigo: 'Art. 48',
      resolucao: 'CD/ANPD nº 4/2023',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/lgpdIncidentPlaybookService.ts', descricao: 'Playbook 6 etapas, SLA 72h, escalação' },
      { tipo: 'rota', referencia: 'POST /api/lgpd/incidentes', descricao: 'Registro e gestão de incidentes' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/lgpdIncidentPlaybookService.test.ts', descricao: 'Cobertura de playbook e prazos' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-004',
    requisito: {
      id: 'ANEEL-DOSSIA',
      norma: 'PRODIST Módulo 2 — Cadeia de Custódia',
      fonte: 'ANEEL',
      descricao: 'Dossiê regulatório com SHA-256, trilha imutável e proveniência técnica por entrega',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/dossieRegulatorioService.ts', descricao: 'SHA-256, ciclo rascunho→arquivado, trilha imutável' },
      { tipo: 'rota', referencia: 'GET/POST /api/dossie/*', descricao: 'CRUD dossiê regulatório' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/dossieRegulatorioService.test.ts', descricao: '24 testes cobrindo ciclo de vida e integridade' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-005',
    requisito: {
      id: 'NIST-800-88',
      norma: 'NIST SP 800-88 / LGPD Art.5 XV',
      fonte: 'INTERNA',
      descricao: 'Descarte seguro certificado (Clear/Purge/Destroy) com certificado SHA-256',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/lgpdRetencaoService.ts', descricao: 'Ciclo de vida de descarte, certificado NIST' },
      { tipo: 'rota', referencia: 'GET/POST /api/lgpd/retencao/*', descricao: 'Políticas e eventos de retenção' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/lgpdRetencaoService.test.ts', descricao: '22 testes cobrindo descarte e certificados' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-006',
    requisito: {
      id: 'ANEEL-CQT',
      norma: 'PRODIST Módulo 8 — Qualidade de Tensão (CQT)',
      fonte: 'ANEEL',
      descricao: 'Cálculo de queda de tensão conforme fórmulas oficiais Light S.A./PRODIST',
      resolucao: 'PRODIST Módulo 8',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/btParityService.ts', descricao: 'Paridade CQT full: fórmulas, snapshots, relatórios' },
      { tipo: 'servico', referencia: 'server/services/cqtParityReportService.ts', descricao: 'Relatório de paridade CQT' },
      { tipo: 'servico', referencia: 'server/services/cqtRuntimeSnapshotService.ts', descricao: 'Snapshot runtime CQT' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/btParityService.test.ts', descricao: 'Cobertura das fórmulas PRODIST' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-17'),
  },
  {
    id: 'RT-007',
    requisito: {
      id: 'ABAC-RBAC',
      norma: 'ISO/IEC 27001 A.9 — Controle de Acesso',
      fonte: 'INTERNA',
      descricao: 'RBAC/ABAC fino por Recurso, Operação e Contexto geográfico/concessionária',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/abacPolicyService.ts', descricao: 'ABAC contextual' },
      { tipo: 'servico', referencia: 'server/middleware/permissionHandler.ts', descricao: 'Middleware de autorização' },
      { tipo: 'servico', referencia: 'server/services/accessRecertificationService.ts', descricao: 'Recertificação periódica' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/abacPolicyService.test.ts', descricao: 'Cobertura de políticas ABAC' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-008',
    requisito: {
      id: 'ANEEL-SHA256',
      norma: 'PRODIST Módulo 2 — Integridade de Artefatos',
      fonte: 'ANEEL',
      descricao: 'Assinatura SHA-256 por artefato gerado com registro de proveniência',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/utils/artifactProvenance.ts', descricao: 'Proveniência técnica por artefato' },
      { tipo: 'servico', referencia: 'server/services/cloudTasksService.ts', descricao: 'computeArtifactSha256 integrado na geração DXF' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/cloudTasksService.test.ts', descricao: 'Cobertura de SHA-256 e proveniência' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-009',
    requisito: {
      id: 'LGPD-ART33',
      norma: 'LGPD Art.33 — Transferência Internacional',
      fonte: 'ANPD',
      descricao: 'Controle de residência de dados: armazenamento em território nacional',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/lgpdResidenciaService.ts', descricao: 'Inventário de localizações, verificação Art.33, relatório soberania' },
      { tipo: 'rota', referencia: 'GET /api/lgpd/residencia/*', descricao: 'Endpoints de residência de dados' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/lgpdResidenciaService.test.ts', descricao: '18 testes cobrindo conformidade e soberania' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
  {
    id: 'RT-010',
    requisito: {
      id: 'VULN-CVSS',
      norma: 'ISO/IEC 27005 — Gestão de Vulnerabilidades',
      fonte: 'INTERNA',
      descricao: 'Gestão de vulnerabilidades com SLA por severidade CVSS (Crítica 7d, Alta 30d)',
    },
    implementacoes: [
      { tipo: 'servico', referencia: 'server/services/vulnManagementService.ts', descricao: 'Ciclo vuln com SLA CVSS' },
      { tipo: 'rota', referencia: 'GET/POST /api/vulns/*', descricao: 'CRUD vulnerabilidades' },
    ],
    testes: [
      { tipo: 'teste', referencia: 'server/tests/vulnManagementService.test.ts', descricao: 'Cobertura de SLA e ciclo de vida' },
    ],
    status: 'conforme',
    verificadoEm: new Date('2026-04-16'),
  },
];

const matrizExtra = new Map<string, ItemRastreabilidade>();
let nextId = 11;

function gerarId(): string {
  return `RT-${String(nextId++).padStart(3, '0')}`;
}

// Retorna todos os itens (canônicos + adicionados em runtime)
export function listarItens(
  filtroFonte?: FonteNorma,
  filtroStatus?: StatusConformidade,
): ItemRastreabilidade[] {
  const todos = [...matrizCanonica, ...matrizExtra.values()];
  return todos.filter((item) => {
    if (filtroFonte && item.requisito.fonte !== filtroFonte) return false;
    if (filtroStatus && item.status !== filtroStatus) return false;
    return true;
  });
}

export function obterItem(id: string): ItemRastreabilidade | undefined {
  return matrizCanonica.find((i) => i.id === id) ?? matrizExtra.get(id);
}

export function adicionarItem(
  input: Omit<ItemRastreabilidade, 'id' | 'verificadoEm'>,
): ItemRastreabilidade {
  const item: ItemRastreabilidade = {
    ...input,
    id: gerarId(),
    verificadoEm: new Date(),
  };
  matrizExtra.set(item.id, item);
  return item;
}

export function atualizarStatus(id: string, status: StatusConformidade, observacao?: string): boolean {
  const emExtra = matrizExtra.get(id);
  if (emExtra) {
    emExtra.status = status;
    emExtra.observacao = observacao;
    emExtra.verificadoEm = new Date();
    return true;
  }
  // Canônicos são imutáveis em runtime
  return false;
}

export function gerarRelatorio(
  filtroFonte?: FonteNorma,
  filtroStatus?: StatusConformidade,
): RelatorioRastreabilidade {
  const itens = listarItens(filtroFonte, filtroStatus);
  const conformes = itens.filter((i) => i.status === 'conforme').length;
  const parciais = itens.filter((i) => i.status === 'parcial').length;
  const naoConformes = itens.filter((i) => i.status === 'nao_conforme').length;
  const naoAvaliados = itens.filter((i) => i.status === 'nao_avaliado').length;
  const avaliados = conformes + parciais + naoConformes;
  const percentualConformidade = avaliados > 0 ? Math.round((conformes / avaliados) * 100) : 0;

  return {
    totalItens: itens.length,
    conformes,
    parciais,
    naoConformes,
    naoAvaliados,
    percentualConformidade,
    itens,
  };
}
