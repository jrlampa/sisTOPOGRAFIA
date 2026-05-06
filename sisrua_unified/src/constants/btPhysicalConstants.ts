import type { BtTopology } from "../types";

/** Fator de conversão corrente → demanda (kVA/A) para redes BT. Fonte: planilha de cálculo. */
export const CURRENT_TO_DEMAND_CONVERSION = 0.375;

/** Fator de temperatura padrão aplicado à corrente máxima para obter demanda corrigida. */
export const DEFAULT_TEMPERATURE_FACTOR = 1.2;

/** Topologia BT vazia — usada como estado inicial quando não há rede carregada. */
export const EMPTY_BT_TOPOLOGY: BtTopology = {
  poles: [],
  transformers: [],
  edges: [],
};
