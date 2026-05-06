/**
 * tenantAuditExportService.ts — Trilha de Auditoria Exportável por Tenant (34 [T1])
 *
 * Gera exports de logs de acesso e operação filtrados por tenant, suportando
 * formatos JSON, NDJSON e CSV com hash de integridade SHA-256.
 */

import crypto from "crypto";

export type ExportFormat = "json" | "ndjson" | "csv";
export type AuditEventType = "acesso" | "operacao" | "admin" | "exportacao" | "falha";

export interface TenantAuditEvent {
  id: string;
  tenantId: string;
  ts: string;
  tipo: AuditEventType;
  actor: string;
  recurso: string;
  acao: string;
  ip?: string;
  dispositivo?: string;
  resultado: "sucesso" | "negado" | "erro";
  detalhes?: Record<string, unknown>;
}

export interface ExportMetadata {
  exportId: string;
  tenantId: string;
  geradoEm: string;
  totalEventos: number;
  formato: ExportFormat;
  hashIntegridade: string;
  periodoInicio?: string;
  periodoFim?: string;
}

export interface ExportResult {
  metadata: ExportMetadata;
  conteudo: string;
}

export interface QueryParams {
  from?: string;
  to?: string;
  tipo?: AuditEventType;
  actor?: string;
  pagina?: number;
  porPagina?: number;
}

const store: TenantAuditEvent[] = [];
let seq = 1;

function gerarId(): string {
  return `tae-${Date.now()}-${seq++}`;
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export class TenantAuditExportService {
  static ingestir(dados: Omit<TenantAuditEvent, "id" | "ts">): TenantAuditEvent {
    const evt: TenantAuditEvent = {
      ...dados,
      id: gerarId(),
      ts: new Date().toISOString(),
    };
    store.push(evt);
    return evt;
  }

  static consultar(tenantId: string, params: QueryParams = {}): TenantAuditEvent[] {
    const { from, to, tipo, actor, pagina = 1, porPagina = 50 } = params;
    let resultado = store.filter((e) => e.tenantId === tenantId);

    if (from) resultado = resultado.filter((e) => e.ts >= from);
    if (to) resultado = resultado.filter((e) => e.ts <= to);
    if (tipo) resultado = resultado.filter((e) => e.tipo === tipo);
    if (actor) resultado = resultado.filter((e) => e.actor === actor);

    resultado.sort((a, b) => a.ts.localeCompare(b.ts));

    const inicio = (pagina - 1) * porPagina;
    return resultado.slice(inicio, inicio + porPagina);
  }

  static exportar(
    tenantId: string,
    formato: ExportFormat,
    params: QueryParams = {}
  ): ExportResult {
    const eventos = TenantAuditExportService.consultar(tenantId, {
      ...params,
      pagina: 1,
      porPagina: 10000,
    });

    let conteudo: string;

    if (formato === "ndjson") {
      conteudo = eventos.map((e) => JSON.stringify(e)).join("\n");
    } else if (formato === "csv") {
      const cabecalho =
        "id,tenantId,ts,tipo,actor,recurso,acao,ip,resultado";
      const linhas = eventos.map(
        (e) =>
          `${e.id},${e.tenantId},${e.ts},${e.tipo},${e.actor},${e.recurso},${e.acao},${e.ip ?? ""},${e.resultado}`
      );
      conteudo = [cabecalho, ...linhas].join("\n");
    } else {
      conteudo = JSON.stringify(eventos, null, 2);
    }

    const hash = sha256(conteudo);
    const metadata: ExportMetadata = {
      exportId: `exp-${Date.now()}`,
      tenantId,
      geradoEm: new Date().toISOString(),
      totalEventos: eventos.length,
      formato,
      hashIntegridade: hash,
      periodoInicio: params.from,
      periodoFim: params.to,
    };

    return { metadata, conteudo };
  }

  static getStats(tenantId: string): {
    total: number;
    porTipo: Record<AuditEventType, number>;
    porResultado: Record<string, number>;
  } {
    const eventos = store.filter((e) => e.tenantId === tenantId);
    const porTipo: Record<string, number> = {};
    const porResultado: Record<string, number> = {};

    for (const e of eventos) {
      porTipo[e.tipo] = (porTipo[e.tipo] ?? 0) + 1;
      porResultado[e.resultado] = (porResultado[e.resultado] ?? 0) + 1;
    }

    return { total: eventos.length, porTipo: porTipo as Record<AuditEventType, number>, porResultado };
  }

  /** Limpa store (apenas para testes). */
  static _reset(): void {
    store.length = 0;
    seq = 1;
  }
}
