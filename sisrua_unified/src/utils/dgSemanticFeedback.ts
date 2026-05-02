import type { DgConstraintCode } from "../hooks/useDgOptimization";

/**
 * Traduz códigos de erro e violação de regras de negócios técnicos 
 * em dicas de engenharia acionáveis e semânticas.
 */

export function getSemanticFeedbackForConstraint(code: DgConstraintCode | string): string {
  switch (code) {
    case "MAX_SPAN_EXCEEDED":
      return "⚠️ Vão máximo excedido. Sugestão: Adicione um poste intermediário no trecho longo.";
    case "INSIDE_EXCLUSION_ZONE":
      return "🚫 Rede invadindo zona de exclusão ambiental ou particular. Altere a rota.";
    case "OUTSIDE_ROAD_CORRIDOR":
      return "🛣️ Topologia fora do corredor da via (Steiner). Ajuste os pontos para acompanhar a rua.";
    case "CQT_LIMIT_EXCEEDED":
      return "⚠️ Queda de tensão (CQT) alta no final do trecho. Sugestão: Aumente a seção do cabo ou aproxime o transformador.";
    case "TRAFO_OVERLOAD":
      return "⚡ Sobrecarga no transformador. Sugestão: Aumente a potência nominal (kVA) ou divida a rede adicionando um novo trafo.";
    case "NON_RADIAL_TOPOLOGY":
      return "🔄 Loop detectado na rede (Topologia não radial). Remova conexões redundantes.";
    default:
      // Se for um erro HTTP ou desconhecido
      if (code.includes("400") || code.includes("excedido")) {
         return "❌ Não foi possível otimizar a rede. Verifique se os postes estão muito distantes ou se a demanda excede a capacidade viável.";
      }
      return `❌ Erro na análise geométrica/elétrica: ${code}`;
  }
}

/**
 * Extrai uma dica amigável de um erro de exceção genérico.
 */
export function getSemanticErrorForException(errorMsg: string): string {
  const upperErr = errorMsg.toUpperCase();
  if (upperErr.includes("CQT")) {
    return "⚠️ Limite de Queda de Tensão estourado em todas as combinações. Tente aproximar o transformador do centro de carga.";
  }
  if (upperErr.includes("TRAFO") || upperErr.includes("OVERLOAD")) {
    return "⚡ Os postes demandam mais energia do que o transformador suporta. Aumente a potência do trafo.";
  }
  if (upperErr.includes("SPAN") || upperErr.includes("VÃO")) {
    return "⚠️ Distância muito grande entre postes. Adicione postes intermediários para permitir o lançamento do cabo.";
  }
  if (upperErr.includes("HTTP 5") || upperErr.includes("NETWORK")) {
    return "🌐 Falha de conexão com o motor de engenharia. Verifique sua rede e tente novamente.";
  }
  
  return `Erro Técnico: ${errorMsg}. Recomendamos revisar o alinhamento da rede.`;
}
