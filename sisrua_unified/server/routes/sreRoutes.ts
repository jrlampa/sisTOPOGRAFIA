/**
 * sreRoutes.ts — SRE/Operação 24x7 com SLIs, SLOs e Runbooks.
 *
 * Roadmap Item 17 [T1]: SRE/Operação 24x7 com SLOs.
 * Define SLI/SLO por fluxo crítico com alertas acionáveis e Runbooks.
 *
 * Endpoints:
 *   GET  /api/sre/slos                      — lista todos os SLOs e status
 *   GET  /api/sre/slos/:sloId               — status de um SLO específico
 *   POST /api/sre/slos/:sloId/observacoes   — registra observação (met/not-met)
 *   GET  /api/sre/alertas                   — SLOs em estado de alerta
 *   GET  /api/sre/runbooks                  — catálogo de runbooks
 *   GET  /api/sre/runbooks/:id              — runbook específico
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import {
  getSLOStatus,
  getAllSLOStatuses,
  getAlertingSLOs,
  recordObservation,
  registerSLO,
  type SLODefinition,
} from "../services/sloService.js";

const router = Router();

// ─── Runbooks ─────────────────────────────────────────────────────────────────

interface Runbook {
  id: string;
  titulo: string;
  servico: string;
  gatilho: string;
  severidade: "critica" | "alta" | "media" | "baixa";
  objetivo: string;
  passos: string[];
  escalacao: string;
  kpiImpactado: string;
  sloAssociado?: string;
  tempoResolucaoAlvoMin: number;
}

const RUNBOOKS: Runbook[] = [
  {
    id: "RB-001",
    titulo: "Falha na Exportação DXF",
    servico: "dxf-export",
    gatilho: "Taxa de erro > 1% ou SLO dxf_export_availability < 99.5%",
    severidade: "critica",
    objetivo: "Restaurar geração de arquivos DXF em até 15 minutos",
    passos: [
      "1. Verificar logs do worker Python: GET /health → campo 'system.nodeVersion'",
      "2. Verificar fila de jobs: GET /api/jobs → checar jobs com status 'falhou'",
      "3. Reiniciar worker Python se processo travado (docker restart sisrua-worker)",
      "4. Verificar espaço em disco: df -h /tmp → se < 500MB, limpar arquivos antigos",
      "5. Checar conectividade OSM: curl https://overpass-api.de/api/status",
      "6. Se Python indisponível, ativar modo fallback (JS-only DXF)",
      "7. Notificar equipe via canal #alertas-sre se RTO > 15min",
    ],
    escalacao: "Dev On-Call → Tech Lead → CTO",
    kpiImpactado: "Taxa de sucesso de exportação DXF",
    sloAssociado: "dxf_export_availability",
    tempoResolucaoAlvoMin: 15,
  },
  {
    id: "RB-002",
    titulo: "Latência Alta no Backend",
    servico: "api-backend",
    gatilho: "P95 latência > 2000ms por 5 minutos consecutivos",
    severidade: "alta",
    objetivo: "Reduzir latência P95 para < 500ms em até 30 minutos",
    passos: [
      "1. Verificar métricas: GET /api/sre/slos → buscar SLO de latência",
      "2. Identificar endpoints mais lentos via logs: grep 'duration' server.log",
      "3. Verificar conexões de banco: GET /health → campo 'dependencies.database'",
      "4. Checar uso de memória Node.js: process.memoryUsage()",
      "5. Executar GC forçado se heap > 80%: global.gc() em ambiente controlado",
      "6. Verificar queries N+1 nos logs de auditoria",
      "7. Escalar instância se CPU > 80% por mais de 10 minutos",
    ],
    escalacao: "Dev On-Call → DBA → Tech Lead",
    kpiImpactado: "Latência P95 de API",
    sloAssociado: "api_latency_p95",
    tempoResolucaoAlvoMin: 30,
  },
  {
    id: "RB-003",
    titulo: "Banco de Dados Indisponível",
    servico: "database",
    gatilho: "GET /health retorna database !== 'disponível' por 2 checks consecutivos",
    severidade: "critica",
    objetivo: "Restaurar conectividade com banco em até 10 minutos",
    passos: [
      "1. Verificar status Supabase: https://status.supabase.com",
      "2. Testar conexão direta: psql $DATABASE_URL -c 'SELECT 1'",
      "3. Verificar variáveis de ambiente: echo $SUPABASE_URL",
      "4. Checar pool de conexões: SELECT count(*) FROM pg_stat_activity",
      "5. Se pool esgotado: SELECT pg_terminate_backend(pid) WHERE state = 'idle in transaction'",
      "6. Ativar modo degradado (in-memory fallback) para jobs em andamento",
      "7. Escalar para suporte Supabase se problema de infraestrutura",
    ],
    escalacao: "Dev On-Call → Tech Lead → Suporte Supabase",
    kpiImpactado: "Disponibilidade geral da plataforma",
    tempoResolucaoAlvoMin: 10,
  },
  {
    id: "RB-004",
    titulo: "Vazamento de Segurança Detectado",
    servico: "security",
    gatilho: "Secret scanner detecta credencial em código ou logs",
    severidade: "critica",
    objetivo: "Revogar credencial e auditar impacto em até 30 minutos",
    passos: [
      "1. Identificar credencial exposta: revisar output do gitleaks/trufflehog",
      "2. Revogar imediatamente: Supabase Dashboard → API Keys → Revoke",
      "3. Rotacionar todas as chaves relacionadas no projeto",
      "4. Auditar logs de acesso do período de exposição",
      "5. Verificar se credencial foi usada de IPs não reconhecidos",
      "6. Notificar ANPD se dados pessoais foram expostos (prazo 72h Art. 48 LGPD)",
      "7. Executar POST /api/lgpd/incidentes para iniciar playbook regulatório",
    ],
    escalacao: "Dev On-Call → CISO → DPO → ANPD (se necessário)",
    kpiImpactado: "Conformidade LGPD e integridade de credenciais",
    tempoResolucaoAlvoMin: 30,
  },
  {
    id: "RB-005",
    titulo: "Worker Python Não Responde",
    servico: "python-engine",
    gatilho: "Timeout em chamadas ao motor Python > 30 segundos",
    severidade: "alta",
    objetivo: "Restaurar motor Python em até 20 minutos",
    passos: [
      "1. Verificar processo: ps aux | grep python",
      "2. Checar logs do worker: tail -100 logs/worker.log",
      "3. Verificar dependências Python: pip check em py_engine/.venv",
      "4. Testar isolado: python py_engine/main.py --healthcheck",
      "5. Reiniciar container se dockerizado: docker restart sisrua-python",
      "6. Verificar OSMnx disponível: python -c 'import osmnx; print(osmnx.__version__)'",
      "7. Ativar modo JS fallback para DXF simples enquanto aguarda restauração",
    ],
    escalacao: "Dev On-Call → Backend Lead",
    kpiImpactado: "Taxa de geração DXF com dados OSM",
    sloAssociado: "dxf_export_availability",
    tempoResolucaoAlvoMin: 20,
  },
];

// ─── Validação ────────────────────────────────────────────────────────────────

const observacaoSchema = z.object({
  met: z.boolean(),
  timestamp: z.string().datetime().optional(),
});

const sloSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  indicator: z.enum(["availability", "latency", "error_rate", "throughput"]),
  target: z.number().min(0).max(1),
  windowDays: z.number().int().min(1).max(365),
  alertThreshold: z.number().min(0).max(1),
});

// ─── Endpoints ────────────────────────────────────────────────────────────────

// GET /api/sre/slos — todos os SLOs com status
router.get("/slos", (_req: Request, res: Response) => {
  const statuses = getAllSLOStatuses();
  return res.json({
    total: statuses.length,
    alertando: statuses.filter((s) => s.alerting).length,
    slos: statuses,
  });
});

// GET /api/sre/slos/:sloId — status de um SLO
router.get("/slos/:sloId", (req: Request, res: Response) => {
  const { sloId } = req.params;
  const status = getSLOStatus(sloId);
  if (!status) {
    return res.status(404).json({ erro: `SLO '${sloId}' não encontrado.` });
  }
  return res.json(status);
});

// POST /api/sre/slos/:sloId/observacoes — registra observação
router.post("/slos/:sloId/observacoes", (req: Request, res: Response) => {
  const { sloId } = req.params;
  const parse = observacaoSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Dados inválidos.", detalhes: parse.error.flatten() });
  }
  const status = getSLOStatus(sloId);
  if (!status) {
    return res.status(404).json({ erro: `SLO '${sloId}' não encontrado.` });
  }
  const ts = parse.data.timestamp ? new Date(parse.data.timestamp) : new Date();
  recordObservation(sloId, parse.data.met, ts);
  logger.info("[SRE] Observação registrada", { sloId, met: parse.data.met });
  const novoStatus = getSLOStatus(sloId);
  return res.status(201).json({ sloId, observacaoRegistrada: true, novoStatus });
});

// POST /api/sre/slos — registra novo SLO
router.post("/slos", (req: Request, res: Response) => {
  const parse = sloSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ erro: "Dados inválidos.", detalhes: parse.error.flatten() });
  }
  const def: SLODefinition = parse.data;
  registerSLO(def);
  logger.info("[SRE] Novo SLO registrado", { sloId: def.id });
  return res.status(201).json({ id: def.id, registrado: true });
});

// GET /api/sre/alertas — SLOs em estado de alerta
router.get("/alertas", (_req: Request, res: Response) => {
  const alertas = getAlertingSLOs();
  return res.json({
    total: alertas.length,
    alertas,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/sre/runbooks — catálogo completo de runbooks
router.get("/runbooks", (_req: Request, res: Response) => {
  return res.json({
    total: RUNBOOKS.length,
    runbooks: RUNBOOKS.map(({ id, titulo, servico, severidade, gatilho, tempoResolucaoAlvoMin }) => ({
      id, titulo, servico, severidade, gatilho, tempoResolucaoAlvoMin,
    })),
  });
});

// GET /api/sre/runbooks/:id — runbook completo
router.get("/runbooks/:id", (req: Request, res: Response) => {
  const rb = RUNBOOKS.find((r) => r.id === req.params.id);
  if (!rb) {
    return res.status(404).json({ erro: `Runbook '${req.params.id}' não encontrado.` });
  }
  return res.json(rb);
});

export default router;
