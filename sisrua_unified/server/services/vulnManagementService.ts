/**
 * vulnManagementService.ts — Gestão de Vulnerabilidades CVSS SLA (Item 127 [T1]).
 */

export type SeveridadeVuln = 'critica' | 'alta' | 'media' | 'baixa';
export type StatusVuln = 'aberta' | 'em_tratamento' | 'resolvida' | 'aceita';

export interface Vulnerabilidade {
  id: string;
  titulo: string;
  cvssScore: number;
  severidade: SeveridadeVuln;
  status: StatusVuln;
  prazoSla: Date;
  criadoEm: Date;
  resolvidoEm?: Date;
  fonte: string;
  afetado: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// SLA em dias por severidade
const SLA_DIAS: Record<SeveridadeVuln, number> = {
  critica: 7,
  alta: 30,
  media: 90,
  baixa: 180,
};

const vulns = new Map<string, Vulnerabilidade>();
let nextId = 1;

function gerarId(): string {
  return `vuln-${Date.now()}-${nextId++}`;
}

export function registrarVuln(
  v: Omit<Vulnerabilidade, 'id' | 'prazoSla' | 'criadoEm'>
): Vulnerabilidade {
  const criadoEm = new Date();
  const prazoSla = new Date(criadoEm.getTime() + SLA_DIAS[v.severidade] * MS_PER_DAY);
  const vuln: Vulnerabilidade = { ...v, id: gerarId(), criadoEm, prazoSla };
  vulns.set(vuln.id, vuln);
  return vuln;
}

export function atualizarStatus(id: string, status: StatusVuln, resolvidoEm?: Date): boolean {
  const vuln = vulns.get(id);
  if (!vuln) return false;
  vuln.status = status;
  if (resolvidoEm) vuln.resolvidoEm = resolvidoEm;
  else if (status === 'resolvida' && !vuln.resolvidoEm) vuln.resolvidoEm = new Date();
  return true;
}

export function listarVulns(filtros?: { status?: StatusVuln; severidade?: SeveridadeVuln }): Vulnerabilidade[] {
  let lista = Array.from(vulns.values());
  if (filtros?.status) lista = lista.filter(v => v.status === filtros.status);
  if (filtros?.severidade) lista = lista.filter(v => v.severidade === filtros.severidade);
  return lista;
}

export function resumoCvss(): { total: number; porSeveridade: Record<string, number>; vencidas: number; emPrazo: number } {
  const lista = Array.from(vulns.values());
  const agora = new Date();
  const porSeveridade: Record<string, number> = { critica: 0, alta: 0, media: 0, baixa: 0 };
  let vencidas = 0;
  let emPrazo = 0;
  for (const v of lista) {
    porSeveridade[v.severidade] = (porSeveridade[v.severidade] ?? 0) + 1;
    if (v.status !== 'resolvida' && v.status !== 'aceita') {
      if (v.prazoSla < agora) vencidas++;
      else emPrazo++;
    }
  }
  return { total: lista.length, porSeveridade, vencidas, emPrazo };
}

/** Limpa estado (uso em testes) */
export function _resetVulns(): void {
  vulns.clear();
  nextId = 1;
}
