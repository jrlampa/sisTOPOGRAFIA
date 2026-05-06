/**
 * zeroTrustService.ts — Zero Trust Inter-service (22 [T1])
 *
 * Modela a camada de Zero Trust para comunicação mTLS entre serviços:
 * - Registro de identidades de serviço com certificado (fingerprint)
 * - Validação de token inter-service (HMAC-SHA-256)
 * - Políticas de autorização por par (emissor → receptor)
 * - Registro de tentativas e auditoria de acesso
 */

import crypto from "crypto";
import { logger } from "../utils/logger.js";

export type ServiceStatus = "ativo" | "revogado" | "pendente";

export interface ServiceIdentity {
  serviceId: string;
  nome: string;
  certFingerprint: string; // SHA-256 do certificado
  secretHash: string;       // HMAC key hash (armazenado como hash, nunca em claro)
  status: ServiceStatus;
  registradoEm: string;
  revogadoEm?: string;
}

export interface TrustPolicy {
  id: string;
  emissor: string;
  receptor: string;
  permissoes: string[];
  ativo: boolean;
  criadoEm: string;
}

export interface AccessAttempt {
  id: string;
  emissorId: string;
  receptorId: string;
  ts: string;
  resultado: "permitido" | "negado";
  motivo?: string;
}

const identities = new Map<string, ServiceIdentity>();
const policies: TrustPolicy[] = [];
const accessLog: AccessAttempt[] = [];
let policySeq = 1;
let attemptSeq = 1;

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: string, data: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

export class ZeroTrustService {
  /**
   * Registra identidade de serviço com fingerprint de certificado e secret.
   * O secret nunca é armazenado em claro — apenas seu hash.
   */
  static registrarServico(params: {
    serviceId: string;
    nome: string;
    certFingerprint: string;
    secret: string;
  }): ServiceIdentity {
    if (identities.has(params.serviceId)) {
      throw new Error(`Serviço '${params.serviceId}' já registrado`);
    }
    const identity: ServiceIdentity = {
      serviceId: params.serviceId,
      nome: params.nome,
      certFingerprint: params.certFingerprint,
      secretHash: sha256Hex(params.secret),
      status: "ativo",
      registradoEm: new Date().toISOString(),
    };
    identities.set(params.serviceId, identity);
    logger.info(`[ZeroTrust] Serviço registrado: ${params.serviceId}`);
    return { ...identity, secretHash: "***" } as ServiceIdentity;
  }

  static revogarServico(serviceId: string): void {
    const svc = identities.get(serviceId);
    if (!svc) throw new Error(`Serviço '${serviceId}' não encontrado`);
    svc.status = "revogado";
    svc.revogadoEm = new Date().toISOString();
    logger.warn(`[ZeroTrust] Serviço revogado: ${serviceId}`);
  }

  static listarServicos(): Omit<ServiceIdentity, "secretHash">[] {
    return [...identities.values()].map(({ secretHash: _s, ...rest }) => rest);
  }

  static definirPolitica(params: {
    emissor: string;
    receptor: string;
    permissoes: string[];
  }): TrustPolicy {
    const policy: TrustPolicy = {
      id: `pol-${policySeq++}`,
      emissor: params.emissor,
      receptor: params.receptor,
      permissoes: params.permissoes,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    policies.push(policy);
    return policy;
  }

  static listarPoliticas(): TrustPolicy[] {
    return [...policies];
  }

  /**
   * Valida token inter-service.
   * Token = HMAC-SHA-256(nonce:timestamp, secret)
   * Janela de validade: 60 segundos.
   */
  static validarToken(params: {
    emissorId: string;
    receptorId: string;
    token: string;
    nonce: string;
    timestamp: string;
    secret: string;
  }): { valido: boolean; motivo?: string } {
    const emissor = identities.get(params.emissorId);
    if (!emissor) return { valido: false, motivo: "Emissor não encontrado" };
    if (emissor.status !== "ativo") return { valido: false, motivo: "Emissor revogado" };

    const receptor = identities.get(params.receptorId);
    if (!receptor) return { valido: false, motivo: "Receptor não encontrado" };
    if (receptor.status !== "ativo") return { valido: false, motivo: "Receptor revogado" };

    // Verificar janela de tempo (60s)
    const tsMs = new Date(params.timestamp).getTime();
    if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > 60_000) {
      return { valido: false, motivo: "Token expirado ou timestamp inválido" };
    }

    // Verificar secret hash
    if (sha256Hex(params.secret) !== emissor.secretHash) {
      return { valido: false, motivo: "Secret inválido" };
    }

    // Verificar token HMAC
    const payload = `${params.nonce}:${params.timestamp}`;
    const esperado = hmacSha256(params.secret, payload);
    const tokenValido = crypto.timingSafeEqual(
      Buffer.from(params.token, "hex"),
      Buffer.from(esperado, "hex")
    );
    if (!tokenValido) return { valido: false, motivo: "Assinatura inválida" };

    // Verificar política
    const politica = policies.find(
      (p) => p.ativo && p.emissor === params.emissorId && p.receptor === params.receptorId
    );
    if (!politica) return { valido: false, motivo: "Política não encontrada" };

    ZeroTrustService._logAcesso(params.emissorId, params.receptorId, "permitido");
    return { valido: true };
  }

  static _logAcesso(emissorId: string, receptorId: string, resultado: "permitido" | "negado", motivo?: string): void {
    accessLog.push({
      id: `acc-${attemptSeq++}`,
      emissorId,
      receptorId,
      ts: new Date().toISOString(),
      resultado,
      motivo,
    });
  }

  static getAccessLog(limit = 100): AccessAttempt[] {
    return accessLog.slice(-limit);
  }

  /** Reset para testes. */
  static _reset(): void {
    identities.clear();
    policies.length = 0;
    accessLog.length = 0;
    policySeq = 1;
    attemptSeq = 1;
  }
}
