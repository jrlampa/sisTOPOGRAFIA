/**
 * LGPD Routes — LGPD End-to-End (Itens 38 e 39 – T1)
 *
 * Fluxos de tratamento (RIPD) e Playbook de Incidentes regulatórios.
 *
 * ── Fluxos de Tratamento ──────────────────────────────────────────────────────
 * GET  /api/lgpd/fluxos                      — lista fluxos de tratamento
 * POST /api/lgpd/fluxos                      — registra novo fluxo
 * GET  /api/lgpd/fluxos/:id                  — obtém fluxo
 * GET  /api/lgpd/fluxos/:id/ripd             — gera RIPD do fluxo
 * GET  /api/lgpd/ripd                        — gera RIPD geral (todos os fluxos)
 *
 * ── Direitos dos Titulares ────────────────────────────────────────────────────
 * POST /api/lgpd/direitos                    — registra solicitação de direito
 * GET  /api/lgpd/direitos/abertos            — solicitações em aberto
 * GET  /api/lgpd/direitos/:titularId         — solicitações de um titular
 * PUT  /api/lgpd/direitos/:id/status         — atualiza status da solicitação
 *
 * ── Incidentes ────────────────────────────────────────────────────────────────
 * GET  /api/lgpd/incidentes                  — lista incidentes
 * POST /api/lgpd/incidentes                  — registra incidente
 * GET  /api/lgpd/incidentes/abertos          — incidentes não encerrados
 * GET  /api/lgpd/incidentes/prazos-vencidos  — incidentes com prazo ANPD vencido
 * GET  /api/lgpd/incidentes/:id              — obtém incidente
 * PUT  /api/lgpd/incidentes/:id/etapa        — conclui etapa do playbook
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import {
  registrarFluxo,
  listarFluxos,
  obterFluxo,
  gerarRipd,
  gerarRipdGeral,
  registrarSolicitacaoDireito,
  listarSolicitacoesPorTitular,
  listarSolicitacoesAbertas,
  atualizarSolicitacao,
  type BaseLegal,
  type CategoriaDado,
  type DireitoTitular,
  type StatusSolicitacao,
} from "../services/lgpdFlowService.js";
import {
  registrarIncidente,
  listarIncidentes,
  listarIncidentesAbertos,
  obterIncidente,
  concluirEtapa,
  verificarPrazosVencidos,
  type TipoIncidente,
  type SeveridadeIncidente,
  type EtapaPlaybook,
} from "../services/lgpdIncidentPlaybookService.js";

const router = Router();

// ─── Schemas de validação ─────────────────────────────────────────────────────

const basesLegaisValidas: BaseLegal[] = [
  "consentimento",
  "cumprimento_obrigacao",
  "execucao_politica",
  "estudos_orgao",
  "execucao_contrato",
  "exercicio_direitos",
  "protecao_vida",
  "tutela_saude",
  "interesse_legitimo",
  "protecao_credito",
];

const categoriasValidas: CategoriaDado[] = [
  "identificacao",
  "contato",
  "localizacao",
  "profissional",
  "tecnico",
  "sensivel_saude",
  "sensivel_biometrico",
];

const direitosValidos: DireitoTitular[] = [
  "confirmacao_existencia",
  "acesso",
  "correcao",
  "anonimizacao_bloqueio",
  "portabilidade",
  "eliminacao",
  "informacao_compartilhamento",
  "revogacao_consentimento",
  "oposicao",
];

const statusValidos: StatusSolicitacao[] = [
  "recebida",
  "em_analise",
  "atendida",
  "indeferida",
];

const tiposIncidente: TipoIncidente[] = [
  "acesso_nao_autorizado",
  "divulgacao_indevida",
  "alteracao_nao_autorizada",
  "perda_destruicao",
  "ransomware",
  "phishing",
  "vazamento_interno",
  "outro",
];

const severidades: SeveridadeIncidente[] = [
  "baixa",
  "media",
  "alta",
  "critica",
];

const etapasPlaybook: EtapaPlaybook[] = [
  "deteccao_triagem",
  "contencao_imediata",
  "avaliacao_impacto",
  "notificacao_anpd",
  "comunicacao_titulares",
  "remediacao_licoes",
];

const fluxoSchema = z.object({
  nome: z.string().min(3).max(120),
  finalidade: z.string().min(10).max(500),
  baseLegal: z.enum(basesLegaisValidas as [BaseLegal, ...BaseLegal[]]),
  categorias: z
    .array(z.enum(categoriasValidas as [CategoriaDado, ...CategoriaDado[]]))
    .min(1),
  retencaoDias: z.number().int().positive().max(36500),
  compartilhaTerceiros: z.boolean(),
  transferenciaInternacional: z.boolean(),
  operador: z.string().min(2).max(120),
});

const direitoSchema = z.object({
  titularId: z.string().min(1).max(100),
  direito: z.enum(direitosValidos as [DireitoTitular, ...DireitoTitular[]]),
  descricao: z.string().min(5).max(2000),
  fluxoId: z.string().uuid().optional(),
});

const statusSolicitacaoSchema = z.object({
  status: z.enum(statusValidos as [StatusSolicitacao, ...StatusSolicitacao[]]),
  resposta: z.string().max(2000).optional(),
});

const incidenteSchema = z.object({
  titulo: z.string().min(5).max(200),
  tipo: z.enum(tiposIncidente as [TipoIncidente, ...TipoIncidente[]]),
  severidade: z.enum(
    severidades as [SeveridadeIncidente, ...SeveridadeIncidente[]],
  ),
  titularesAfetadosEstimado: z.number().int().nonnegative(),
  categoriasEnvolvidas: z.array(z.string().min(1)).min(1),
  descricao: z.string().min(10).max(5000),
});

const etapaSchema = z.object({
  etapa: z.enum(etapasPlaybook as [EtapaPlaybook, ...EtapaPlaybook[]]),
  evidencia: z.string().max(2000).optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function badRequest(res: Response, details: string[]): Response {
  return res.status(400).json({ erro: "Entrada inválida", detalhes: details });
}

// ─── Fluxos de Tratamento ─────────────────────────────────────────────────────

router.get("/fluxos", (_req: Request, res: Response) => {
  res.json({ fluxos: listarFluxos() });
});

router.post("/fluxos", (req: Request, res: Response) => {
  const parsed = fluxoSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(
      res,
      parsed.error.issues.map((i) => i.message),
    );
  }
  const fluxo = registrarFluxo(parsed.data);
  logger.info("LGPD: fluxo de tratamento registrado", {
    id: fluxo.id,
    nome: fluxo.nome,
  });
  return res.status(201).json(fluxo);
});

router.get("/fluxos/:id", (req: Request, res: Response) => {
  const fluxo = obterFluxo(req.params.id);
  if (!fluxo) return res.status(404).json({ erro: "Fluxo não encontrado" });
  return res.json(fluxo);
});

router.get("/fluxos/:id/ripd", (req: Request, res: Response) => {
  const ripd = gerarRipd(req.params.id);
  if (!ripd) return res.status(404).json({ erro: "Fluxo não encontrado" });
  return res.json(ripd);
});

router.get("/ripd", (_req: Request, res: Response) => {
  const ripds = gerarRipdGeral();
  res.json({ total: ripds.length, ripds });
});

// ─── Direitos dos Titulares ───────────────────────────────────────────────────

router.post("/direitos", (req: Request, res: Response) => {
  const parsed = direitoSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(
      res,
      parsed.error.issues.map((i) => i.message),
    );
  }
  const { titularId, direito, descricao, fluxoId } = parsed.data;
  const sol = registrarSolicitacaoDireito(
    titularId,
    direito,
    descricao,
    fluxoId,
  );
  logger.info("LGPD: solicitação de direito registrada", {
    id: sol.id,
    direito,
    titularId,
  });
  return res.status(201).json(sol);
});

router.get("/direitos/abertos", (_req: Request, res: Response) => {
  res.json({ solicitacoes: listarSolicitacoesAbertas() });
});

router.get("/direitos/:titularId", (req: Request, res: Response) => {
  const sols = listarSolicitacoesPorTitular(req.params.titularId);
  res.json({ solicitacoes: sols });
});

router.put("/direitos/:id/status", (req: Request, res: Response) => {
  const parsed = statusSolicitacaoSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(
      res,
      parsed.error.issues.map((i) => i.message),
    );
  }
  const updated = atualizarSolicitacao(
    req.params.id,
    parsed.data.status,
    parsed.data.resposta,
  );
  if (!updated)
    return res.status(404).json({ erro: "Solicitação não encontrada" });
  return res.json(updated);
});

// ─── Incidentes ───────────────────────────────────────────────────────────────

router.get("/incidentes", (_req: Request, res: Response) => {
  res.json({ incidentes: listarIncidentes() });
});

router.get("/incidentes/abertos", (_req: Request, res: Response) => {
  res.json({ incidentes: listarIncidentesAbertos() });
});

router.get("/incidentes/prazos-vencidos", (_req: Request, res: Response) => {
  res.json({ incidentes: verificarPrazosVencidos() });
});

router.get("/incidentes/:id", (req: Request, res: Response) => {
  const inc = obterIncidente(req.params.id);
  if (!inc) return res.status(404).json({ erro: "Incidente não encontrado" });
  return res.json(inc);
});

router.post("/incidentes", (req: Request, res: Response) => {
  const parsed = incidenteSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(
      res,
      parsed.error.issues.map((i) => i.message),
    );
  }
  const inc = registrarIncidente(parsed.data);
  logger.info("LGPD: incidente registrado", {
    id: inc.id,
    tipo: inc.tipo,
    severidade: inc.severidade,
  });
  return res.status(201).json(inc);
});

router.put("/incidentes/:id/etapa", (req: Request, res: Response) => {
  const parsed = etapaSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(
      res,
      parsed.error.issues.map((i) => i.message),
    );
  }
  const updated = concluirEtapa(
    req.params.id,
    parsed.data.etapa,
    parsed.data.evidencia,
  );
  if (!updated)
    return res.status(404).json({ erro: "Incidente não encontrado" });
  return res.json(updated);
});

export default router;
