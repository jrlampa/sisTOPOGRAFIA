import { createHash } from "crypto";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type IdempotencyStatus = "processando" | "concluido" | "erro";

export interface IdempotencyRecord {
  chave: string;
  jobId: string;
  status: IdempotencyStatus;
  resultado?: unknown;
  hashPayload: string;
  criadoEm: string;
  expiraEm: string;
  tentativas: number;
}

// ─── Constantes ────────────────────────────────────────────────────────────

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// ─── Estado em memória ─────────────────────────────────────────────────────

let registros = new Map<string, IdempotencyRecord>();
let contador = 1;

function now(): string {
  return new Date().toISOString();
}

function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function purgeExpired(): void {
  const ts = Date.now();
  for (const [key, rec] of registros) {
    if (new Date(rec.expiraEm).getTime() < ts) {
      registros.delete(key);
    }
  }
}

// ─── Serviço ───────────────────────────────────────────────────────────────

export class JobIdempotencyService {
  /**
   * Registra chave de idempotência para um job.
   * Se a chave já existir e não expirou, retorna o registro existente.
   * Se expirou, remove e cria novo registro.
   */
  static registrar(params: {
    chave: string;
    payload: unknown;
  }): { registro: IdempotencyRecord; duplicata: boolean } {
    purgeExpired();
    const existing = registros.get(params.chave);
    const hash = hashPayload(params.payload);
    if (existing) {
      existing.tentativas++;
      return { registro: existing, duplicata: true };
    }
    const ts = now();
    const jobId = `job-${contador++}`;
    const record: IdempotencyRecord = {
      chave: params.chave,
      jobId,
      status: "processando",
      hashPayload: hash,
      criadoEm: ts,
      expiraEm: new Date(Date.now() + TTL_MS).toISOString(),
      tentativas: 1,
    };
    registros.set(params.chave, record);
    return { registro: record, duplicata: false };
  }

  static concluir(params: {
    chave: string;
    resultado: unknown;
  }): IdempotencyRecord {
    const record = registros.get(params.chave);
    if (!record) throw new Error(`Chave não encontrada: ${params.chave}`);
    record.status = "concluido";
    record.resultado = params.resultado;
    return record;
  }

  static falhar(params: {
    chave: string;
    erro: string;
  }): IdempotencyRecord {
    const record = registros.get(params.chave);
    if (!record) throw new Error(`Chave não encontrada: ${params.chave}`);
    record.status = "erro";
    record.resultado = { erro: params.erro };
    return record;
  }

  static consultar(chave: string): IdempotencyRecord | undefined {
    purgeExpired();
    return registros.get(chave);
  }

  static listar(): IdempotencyRecord[] {
    purgeExpired();
    return Array.from(registros.values());
  }

  static remover(chave: string): boolean {
    return registros.delete(chave);
  }

  static _reset(): void {
    registros = new Map();
    contador = 1;
  }
}
