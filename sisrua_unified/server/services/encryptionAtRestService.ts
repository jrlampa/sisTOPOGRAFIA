/**
 * encryptionAtRestService.ts — Encryption at Rest com Master Keys Cliente (75 [T1])
 */

import crypto from "crypto";
import { logger } from "../utils/logger.js";

export interface CustomerKeyVersion {
  customerId: string;
  version: number;
  keyId: string;
  algorithm: "aes-256-gcm";
  createdAt: string;
  active: boolean;
  rotatedFromKeyId: string | null;
}

export interface EncryptedPayload {
  customerId: string;
  keyId: string;
  algorithm: "aes-256-gcm";
  ivB64: string;
  authTagB64: string;
  ciphertextB64: string;
  aadB64: string | null;
  encryptedAt: string;
}

const keyStore = new Map<string, Array<{ meta: CustomerKeyVersion; keyMaterial: Buffer }>>();

function getActiveKey(customerId: string): { meta: CustomerKeyVersion; keyMaterial: Buffer } | null {
  const versions = keyStore.get(customerId) ?? [];
  return versions.find((v) => v.meta.active) ?? null;
}

function assertKeyMaterial(keyMaterialB64: string): Buffer {
  const key = Buffer.from(keyMaterialB64, "base64");
  if (key.length !== 32) {
    throw new Error("Master key inválida: esperado 32 bytes (AES-256)");
  }
  return key;
}

export class EncryptionAtRestService {
  static registerMasterKey(customerId: string, keyMaterialB64: string): CustomerKeyVersion {
    const keyMaterial = assertKeyMaterial(keyMaterialB64);

    const versions = keyStore.get(customerId) ?? [];
    if (versions.some((v) => v.meta.active)) {
      throw new Error("Cliente já possui key ativa. Use endpoint de rotação.");
    }

    const meta: CustomerKeyVersion = {
      customerId,
      version: 1,
      keyId: `cmk-${customerId}-v1`,
      algorithm: "aes-256-gcm",
      createdAt: new Date().toISOString(),
      active: true,
      rotatedFromKeyId: null,
    };

    versions.push({ meta, keyMaterial });
    keyStore.set(customerId, versions);

    logger.info(`encryptionAtRest: master key registrada para ${customerId}`);
    return meta;
  }

  static rotateMasterKey(customerId: string, newKeyMaterialB64: string): CustomerKeyVersion {
    const newKey = assertKeyMaterial(newKeyMaterialB64);
    const versions = keyStore.get(customerId) ?? [];
    const active = versions.find((v) => v.meta.active);

    if (!active) {
      throw new Error("Nenhuma key ativa encontrada para rotação.");
    }

    active.meta.active = false;
    const nextVersion = Math.max(...versions.map((v) => v.meta.version)) + 1;
    const meta: CustomerKeyVersion = {
      customerId,
      version: nextVersion,
      keyId: `cmk-${customerId}-v${nextVersion}`,
      algorithm: "aes-256-gcm",
      createdAt: new Date().toISOString(),
      active: true,
      rotatedFromKeyId: active.meta.keyId,
    };

    versions.push({ meta, keyMaterial: newKey });
    keyStore.set(customerId, versions);

    logger.info(`encryptionAtRest: key rotacionada para ${customerId} => ${meta.keyId}`);
    return meta;
  }

  static listKeys(customerId: string): CustomerKeyVersion[] {
    const versions = keyStore.get(customerId) ?? [];
    return versions.map((v) => ({ ...v.meta }));
  }

  static encrypt(customerId: string, plaintext: string, aadB64?: string): EncryptedPayload {
    const active = getActiveKey(customerId);
    if (!active) {
      throw new Error("Nenhuma master key ativa para este cliente.");
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", active.keyMaterial, iv);
    const aad = aadB64 ? Buffer.from(aadB64, "base64") : null;
    if (aad) cipher.setAAD(aad);

    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, "utf-8")),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      customerId,
      keyId: active.meta.keyId,
      algorithm: "aes-256-gcm",
      ivB64: iv.toString("base64"),
      authTagB64: authTag.toString("base64"),
      ciphertextB64: ciphertext.toString("base64"),
      aadB64: aadB64 ?? null,
      encryptedAt: new Date().toISOString(),
    };
  }

  static decrypt(payload: EncryptedPayload): string {
    const versions = keyStore.get(payload.customerId) ?? [];
    const keyVersion = versions.find((v) => v.meta.keyId === payload.keyId);
    if (!keyVersion) {
      throw new Error("Key ID não encontrado para o cliente informado.");
    }

    const iv = Buffer.from(payload.ivB64, "base64");
    const authTag = Buffer.from(payload.authTagB64, "base64");
    const ciphertext = Buffer.from(payload.ciphertextB64, "base64");

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      keyVersion.keyMaterial,
      iv,
    );

    if (payload.aadB64) {
      decipher.setAAD(Buffer.from(payload.aadB64, "base64"));
    }
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf-8");
  }
}
