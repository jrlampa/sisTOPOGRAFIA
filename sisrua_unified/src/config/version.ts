/**
 * Versão centralizada do projeto (Item 27).
 * Evita hardcoding em múltiplos lugares (server/config.ts, package.json, etc).
 * 
 * Uso:
 * - Frontend: import { APP_VERSION } from 'src/config/version'
 * - Backend: import { APP_VERSION } from '../src/config/version.ts'
 * - Package.json: lê este arquivo durante build
 */

export const APP_VERSION = '2.1.0';

/** Formato da versão: semantic versioning (MAJOR.MINOR.PATCH) */
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Parse versão semântica.
 * @example
 * parseVersion('2.1.0') // { major: 2, minor: 1, patch: 0 }
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Comparar duas versões.
 * @returns -1 se v1 < v2, 0 se igual, 1 se v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);
  
  if (!parsed1 || !parsed2) {
    console.warn(`Versões inválidas: ${v1}, ${v2}`);
    return 0;
  }
  
  if (parsed1.major !== parsed2.major) {
    return parsed1.major > parsed2.major ? 1 : -1;
  }
  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor > parsed2.minor ? 1 : -1;
  }
  if (parsed1.patch !== parsed2.patch) {
    return parsed1.patch > parsed2.patch ? 1 : -1;
  }
  
  return 0;
}

/**
 * Header HTTP com versão da API.
 * Use em requisições para rastrear versão cliente.
 */
export const APP_VERSION_HEADER = {
  'X-App-Version': APP_VERSION,
};

/**
 * Release notes para cada versão.
 * Usado em componentes de changelog.
 */
export const RELEASE_NOTES: Record<string, string> = {
  '2.1.0': 'Melhorias de segurança e performance, refactoring de componentes',
  '2.0.0': 'Arquitetura limpa, separação frontend/backend, Zod validation',
  '1.3.0': 'Suporte a múltiplas camadas, exportação DXF aprimorada',
};
