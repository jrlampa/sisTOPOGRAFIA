import { createHash } from "crypto";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type IsolationLevel = "strict" | "standard" | "relaxed";

export interface TenantIsolationProfile {
  tenantId: string;
  level: IsolationLevel;
  encryptionKeyRef: string;
  namespace: string;
  registradoEm: string;
  atualizadoEm: string;
  rotacoes: number;
}

export interface IsolationCheckResult {
  tenantId: string;
  solicitanteId: string;
  permitido: boolean;
  motivo: string;
  ts: string;
}

export interface IsolationReport {
  totalTenants: number;
  nivelDistribuicao: Record<IsolationLevel, number>;
  rotacoesRealizadas: number;
  violacoesDetectadas: number;
  geradoEm: string;
}

// ─── Estado em memória ─────────────────────────────────────────────────────

let profiles = new Map<string, TenantIsolationProfile>();
let violacoes = 0;

function now(): string {
  return new Date().toISOString();
}

function deriveNamespace(tenantId: string): string {
  return createHash("sha256").update(tenantId).digest("hex").slice(0, 12);
}

function generateKeyRef(tenantId: string, rotacao: number): string {
  return createHash("sha256")
    .update(`${tenantId}:${rotacao}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);
}

// ─── Serviço ───────────────────────────────────────────────────────────────

export class MultiTenantIsolationService {
  static registrarTenant(params: {
    tenantId: string;
    level?: IsolationLevel;
  }): TenantIsolationProfile {
    if (profiles.has(params.tenantId)) {
      return profiles.get(params.tenantId)!;
    }
    const ts = now();
    const profile: TenantIsolationProfile = {
      tenantId: params.tenantId,
      level: params.level ?? "strict",
      encryptionKeyRef: generateKeyRef(params.tenantId, 0),
      namespace: deriveNamespace(params.tenantId),
      registradoEm: ts,
      atualizadoEm: ts,
      rotacoes: 0,
    };
    profiles.set(params.tenantId, profile);
    return profile;
  }

  static getProfile(tenantId: string): TenantIsolationProfile | undefined {
    return profiles.get(tenantId);
  }

  static listProfiles(): TenantIsolationProfile[] {
    return Array.from(profiles.values());
  }

  static verificarAcesso(params: {
    tenantId: string;
    solicitanteId: string;
  }): IsolationCheckResult {
    const profile = profiles.get(params.tenantId);
    const ts = now();
    if (!profile) {
      violacoes++;
      return {
        tenantId: params.tenantId,
        solicitanteId: params.solicitanteId,
        permitido: false,
        motivo: "Tenant não registrado",
        ts,
      };
    }
    // Verifica isolamento: solicitante deve pertencer ao mesmo tenant
    const permitido = params.solicitanteId.startsWith(params.tenantId) ||
      params.solicitanteId === params.tenantId;
    if (!permitido) violacoes++;
    return {
      tenantId: params.tenantId,
      solicitanteId: params.solicitanteId,
      permitido,
      motivo: permitido ? "Acesso dentro do tenant" : "Violação de isolamento cross-tenant",
      ts,
    };
  }

  static rotacionarChave(tenantId: string): TenantIsolationProfile {
    const profile = profiles.get(tenantId);
    if (!profile) throw new Error(`Tenant não registrado: ${tenantId}`);
    profile.rotacoes += 1;
    profile.encryptionKeyRef = generateKeyRef(tenantId, profile.rotacoes);
    profile.atualizadoEm = now();
    return profile;
  }

  static atualizarLevel(tenantId: string, level: IsolationLevel): TenantIsolationProfile {
    const profile = profiles.get(tenantId);
    if (!profile) throw new Error(`Tenant não registrado: ${tenantId}`);
    profile.level = level;
    profile.atualizadoEm = now();
    return profile;
  }

  static getRelatorio(): IsolationReport {
    const all = Array.from(profiles.values());
    const nivelDistribuicao: Record<IsolationLevel, number> = { strict: 0, standard: 0, relaxed: 0 };
    let rotacoesTotal = 0;
    for (const p of all) {
      nivelDistribuicao[p.level]++;
      rotacoesTotal += p.rotacoes;
    }
    return {
      totalTenants: all.length,
      nivelDistribuicao,
      rotacoesRealizadas: rotacoesTotal,
      violacoesDetectadas: violacoes,
      geradoEm: now(),
    };
  }

  static _reset(): void {
    profiles = new Map();
    violacoes = 0;
  }
}
