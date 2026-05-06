/**
 * holdingService.ts — Modelo Multiempresa & Holding (Item 129 [T1]).
 */
import { randomUUID } from "crypto";

export interface Holding {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  criadoEm: Date;
}

export interface TenantHolding {
  tenantId: string;
  holdingId: string;
  papel: 'principal' | 'subsidiaria' | 'empreiteira';
  criadoEm: Date;
}

const holdings = new Map<string, Holding>();
const tenantHoldings: TenantHolding[] = [];

export function criarHolding(nome: string, slug: string): Holding {
  const holding: Holding = { id: randomUUID(), nome, slug, ativa: true, criadoEm: new Date() };
  holdings.set(holding.id, holding);
  return holding;
}

export function associarTenant(tenantId: string, holdingId: string, papel: TenantHolding['papel']): TenantHolding {
  const th: TenantHolding = { tenantId, holdingId, papel, criadoEm: new Date() };
  tenantHoldings.push(th);
  return th;
}

export function listarTenantsDaHolding(holdingId: string): TenantHolding[] {
  return tenantHoldings.filter(th => th.holdingId === holdingId);
}

export function holdingDoTenant(tenantId: string): Holding | null {
  const th = tenantHoldings.find(t => t.tenantId === tenantId);
  if (!th) return null;
  return holdings.get(th.holdingId) ?? null;
}

export function auditoriaCruzada(holdingId: string): { holdingId: string; tenants: string[]; totalTenants: number; auditadoEm: Date } {
  const tenants = tenantHoldings.filter(th => th.holdingId === holdingId).map(th => th.tenantId);
  return { holdingId, tenants, totalTenants: tenants.length, auditadoEm: new Date() };
}

export function listarHoldings(): Holding[] {
  return Array.from(holdings.values());
}

/** Limpa estado (uso em testes) */
export function _resetHoldings(): void {
  holdings.clear();
  tenantHoldings.length = 0;
}
