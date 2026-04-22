/**
 * Serviço T2-106 — GIS Hardening (mTLS & Vault)
 */

import { createHash } from "crypto";

export type Ambiente = "dev" | "homolog" | "preprod" | "prod";
export type ProvedorSegredo = "vault" | "local_hsm";
export type StatusPerfil = "ativo" | "inativo";
export type TipoEventoHardening =
  | "handshake_ok"
  | "handshake_fail"
  | "secret_rotated"
  | "policy_violation"
  | "cert_expired";

export interface PerfilHardening {
  id: string;
  tenantId: string;
  ambiente: Ambiente;
  mtlsObrigatorio: boolean;
  certFingerprint: string;
  provedorSegredo: ProvedorSegredo;
  rolesPermitidas: string[];
  rotateDays: number;
  status: StatusPerfil;
  ultimoRotateEm?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EventoHardening {
  id: string;
  perfilId: string;
  tipo: TipoEventoHardening;
  severidade: "baixa" | "media" | "alta" | "critica";
  descricao: string;
  hashEvento: string;
  criadoEm: string;
}

let _perfilCounter = 0;
let _eventoCounter = 0;
const _perfis = new Map<string, PerfilHardening>();
const _eventos = new Map<string, EventoHardening[]>();

export class GisHardeningService {
  static _reset(): void {
    _perfilCounter = 0;
    _eventoCounter = 0;
    _perfis.clear();
    _eventos.clear();
  }

  static criarPerfil(data: {
    tenantId: string;
    ambiente: Ambiente;
    mtlsObrigatorio: boolean;
    certFingerprint: string;
    provedorSegredo: ProvedorSegredo;
    rolesPermitidas: string[];
    rotateDays: number;
  }): PerfilHardening {
    const now = new Date().toISOString();
    const perfil: PerfilHardening = {
      id: `gh-${++_perfilCounter}`,
      tenantId: data.tenantId,
      ambiente: data.ambiente,
      mtlsObrigatorio: data.mtlsObrigatorio,
      certFingerprint: data.certFingerprint,
      provedorSegredo: data.provedorSegredo,
      rolesPermitidas: data.rolesPermitidas,
      rotateDays: data.rotateDays,
      status: "ativo",
      criadoEm: now,
      atualizadoEm: now,
    };
    _perfis.set(perfil.id, perfil);
    _eventos.set(perfil.id, []);
    return perfil;
  }

  static listarPerfis(tenantId?: string): PerfilHardening[] {
    const all = Array.from(_perfis.values());
    return tenantId ? all.filter((p) => p.tenantId === tenantId) : all;
  }

  static obterPerfil(id: string): PerfilHardening | undefined {
    return _perfis.get(id);
  }

  static validarHandshake(perfilId: string, certFingerprintRecebido: string): { autorizado: boolean; motivo: string } {
    const perfil = _perfis.get(perfilId);
    if (!perfil) throw new Error("Perfil não encontrado");
    if (perfil.status !== "ativo") return { autorizado: false, motivo: "Perfil inativo" };
    if (!perfil.mtlsObrigatorio) return { autorizado: true, motivo: "mTLS não obrigatório" };
    if (perfil.certFingerprint !== certFingerprintRecebido) {
      this.registrarEvento(perfilId, {
        tipo: "handshake_fail",
        severidade: "alta",
        descricao: "Fingerprint de certificado divergente",
      });
      return { autorizado: false, motivo: "Certificado inválido" };
    }
    this.registrarEvento(perfilId, {
      tipo: "handshake_ok",
      severidade: "baixa",
      descricao: "Handshake mTLS validado",
    });
    return { autorizado: true, motivo: "Handshake validado" };
  }

  static registrarEvento(
    perfilId: string,
    data: { tipo: TipoEventoHardening; severidade: "baixa" | "media" | "alta" | "critica"; descricao: string }
  ): EventoHardening {
    const perfil = _perfis.get(perfilId);
    if (!perfil) throw new Error("Perfil não encontrado");
    const now = new Date().toISOString();
    const evento: EventoHardening = {
      id: `ge-${++_eventoCounter}`,
      perfilId,
      tipo: data.tipo,
      severidade: data.severidade,
      descricao: data.descricao,
      hashEvento: createHash("sha256").update(`${perfilId}|${data.tipo}|${data.severidade}|${now}`).digest("hex"),
      criadoEm: now,
    };
    const list = _eventos.get(perfilId) || [];
    list.push(evento);
    _eventos.set(perfilId, list);
    return evento;
  }

  static listarEventos(perfilId: string): EventoHardening[] {
    return _eventos.get(perfilId) || [];
  }

  static rotacionarSegredo(perfilId: string): PerfilHardening {
    const perfil = _perfis.get(perfilId);
    if (!perfil) throw new Error("Perfil não encontrado");
    perfil.ultimoRotateEm = new Date().toISOString();
    perfil.atualizadoEm = new Date().toISOString();
    this.registrarEvento(perfilId, {
      tipo: "secret_rotated",
      severidade: "media",
      descricao: `Rotação de segredo executada via ${perfil.provedorSegredo}`,
    });
    return perfil;
  }

  static listarTiposEvento(): TipoEventoHardening[] {
    return ["handshake_ok", "handshake_fail", "secret_rotated", "policy_violation", "cert_expired"];
  }
}
