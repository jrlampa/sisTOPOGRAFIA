import { EngineeringStandard } from "./types.js";
import { BRAZIL_STANDARD } from "./br.js";
import { logger } from "../utils/logger.js";

const standardsRegistry: Record<string, EngineeringStandard> = {
  br: BRAZIL_STANDARD,
};

/**
 * Obtém o padrão de engenharia configurado.
 * Futuramente poderá ser dinâmico por tenant/região.
 */
export function getEngineeringStandard(standardId: string = "br"): EngineeringStandard {
  const standard = standardsRegistry[standardId];
  if (!standard) {
    logger.warn(`Standard ${standardId} não encontrado, usando padrão BR como fallback.`);
    return BRAZIL_STANDARD;
  }
  return standard;
}

/**
 * Atalho para as constantes do padrão ativo.
 */
export function getActiveConstants(standardId?: string) {
  return getEngineeringStandard(standardId).constants;
}

/**
 * Atalho para os condutores do padrão ativo.
 */
export function getActiveConductors(standardId?: string) {
  return getEngineeringStandard(standardId).conductors;
}
