import type { AppLocale } from "../types";

type LcpText = {
  title: string;
  subtitle: string;
  btnReset: string;
  btnPickSource: string;
  btnPickTerminal: string;
  hintPickSource: string;
  hintPickTerminal: string;
  labelSource: string;
  sourceEmpty: string;
  labelTerminals: string;
  terminalsEmpty: string;
  labelRoadSegments: string;
  roadSegmentsCount: (n: number) => string;
  roadSegmentsEmpty: string;
  labelCostProfile: string;
  labelSnapMax: string;
  labelExistingPoles: string;
  existingPolesCount: (n: number) => string;
  btnCalculate: string;
  btnCalculating: string;
  resultFeasible: string;
  resultInfeasible: string;
  resultTerminals: (connected: number, total: number) => string;
  resultTotalLength: string;
  resultTotalCost: string;
  resultEstimatedBrl: string;
  resultPolesReused: string;
  resultSensitiveCrossings: string;
  resultUnreachable: string;
  labelSegments: string;
  colLength: string;
  colCost: string;
  colHighway: string;
  colExistingPole: string;
  colSensitive: string;
  errorNoSource: string;
  errorNoTerminals: string;
  errorNoSegments: string;
};

export function getLcpText(locale: AppLocale): LcpText {
  switch (locale) {
    case "en-US":
      return {
        title: "LCP Motor – Least-Cost Path",
        subtitle: "Cost-weighted routing over road network",
        btnReset: "Reset",
        btnPickSource: "Pick Source",
        btnPickTerminal: "Add Terminal",
        hintPickSource: "Click on the map to set the MT source point",
        hintPickTerminal: "Click on the map to add a terminal (transformer)",
        labelSource: "Source",
        sourceEmpty: "Not defined",
        labelTerminals: "Terminals",
        terminalsEmpty: "No terminals",
        labelRoadSegments: "Road Corridors",
        roadSegmentsCount: (n) => `${n} corridor${n !== 1 ? "s" : ""}`,
        roadSegmentsEmpty: "No corridors",
        labelCostProfile: "Cost Profile",
        labelSnapMax: "Max Snap (m)",
        labelExistingPoles: "Existing Poles",
        existingPolesCount: (n) => `${n} pole${n !== 1 ? "s" : ""}`,
        btnCalculate: "Calculate LCP",
        btnCalculating: "Calculating…",
        resultFeasible: "Feasible path found",
        resultInfeasible: "No feasible path",
        resultTerminals: (c, t) => `${c} of ${t} terminals connected`,
        resultTotalLength: "Total length",
        resultTotalCost: "Weighted cost",
        resultEstimatedBrl: "Estimated cost (BRL)",
        resultPolesReused: "Existing poles reused",
        resultSensitiveCrossings: "Sensitive crossings",
        resultUnreachable: "Unreachable terminals",
        labelSegments: "Path segments",
        colLength: "Length (m)",
        colCost: "Cost",
        colHighway: "Road type",
        colExistingPole: "Reuses pole",
        colSensitive: "Sensitive",
        errorNoSource: "Define a source point first.",
        errorNoTerminals: "Add at least one terminal.",
        errorNoSegments: "Add road corridors before calculating.",
      };
    case "es-ES":
      return {
        title: "Motor LCP – Ruta de Menor Costo",
        subtitle: "Ruteo ponderado por costo sobre red vial",
        btnReset: "Reiniciar",
        btnPickSource: "Definir origen",
        btnPickTerminal: "Agregar terminal",
        hintPickSource: "Haz clic en el mapa para definir el origen MT",
        hintPickTerminal: "Haz clic en el mapa para agregar un terminal (trafo)",
        labelSource: "Origen",
        sourceEmpty: "No definido",
        labelTerminals: "Terminales",
        terminalsEmpty: "Sin terminales",
        labelRoadSegments: "Corredores viales",
        roadSegmentsCount: (n) => `${n} corredor${n !== 1 ? "es" : ""}`,
        roadSegmentsEmpty: "Sin corredores",
        labelCostProfile: "Perfil de costo",
        labelSnapMax: "Snap máximo (m)",
        labelExistingPoles: "Postes existentes",
        existingPolesCount: (n) => `${n} poste${n !== 1 ? "s" : ""}`,
        btnCalculate: "Calcular LCP",
        btnCalculating: "Calculando…",
        resultFeasible: "Ruta factible encontrada",
        resultInfeasible: "Sin ruta factible",
        resultTerminals: (c, t) => `${c} de ${t} terminales conectados`,
        resultTotalLength: "Longitud total",
        resultTotalCost: "Costo ponderado",
        resultEstimatedBrl: "Costo estimado (BRL)",
        resultPolesReused: "Postes existentes reutilizados",
        resultSensitiveCrossings: "Cruces en área sensible",
        resultUnreachable: "Terminales no alcanzados",
        labelSegments: "Segmentos del trayecto",
        colLength: "Longitud (m)",
        colCost: "Costo",
        colHighway: "Tipo de vía",
        colExistingPole: "Reutiliza poste",
        colSensitive: "Sensible",
        errorNoSource: "Defina un punto de origen primero.",
        errorNoTerminals: "Agregue al menos un terminal.",
        errorNoSegments: "Agregue corredores viales antes de calcular.",
      };
    default: // pt-BR
      return {
        title: "Motor LCP – Menor Custo de Traçado",
        subtitle: "Roteamento ponderado por custo sobre rede viária",
        btnReset: "Reiniciar",
        btnPickSource: "Definir Origem",
        btnPickTerminal: "Adicionar Terminal",
        hintPickSource: "Clique no mapa para definir o ponto de origem MT",
        hintPickTerminal: "Clique no mapa para adicionar um terminal (trafo)",
        labelSource: "Origem",
        sourceEmpty: "Não definida",
        labelTerminals: "Terminais",
        terminalsEmpty: "Nenhum terminal",
        labelRoadSegments: "Corredores Viários",
        roadSegmentsCount: (n) => `${n} corredor${n !== 1 ? "es" : ""}`,
        roadSegmentsEmpty: "Nenhum corredor",
        labelCostProfile: "Perfil de Custo",
        labelSnapMax: "Snap máximo (m)",
        labelExistingPoles: "Postes Existentes",
        existingPolesCount: (n) => `${n} poste${n !== 1 ? "s" : ""}`,
        btnCalculate: "Calcular LCP",
        btnCalculating: "Calculando…",
        resultFeasible: "Traçado viável encontrado",
        resultInfeasible: "Traçado inviável",
        resultTerminals: (c, t) => `${c} de ${t} terminais conectados`,
        resultTotalLength: "Comprimento total",
        resultTotalCost: "Custo ponderado",
        resultEstimatedBrl: "Custo estimado (R$)",
        resultPolesReused: "Postes existentes reaproveitados",
        resultSensitiveCrossings: "Travessias em área sensível",
        resultUnreachable: "Terminais não alcançados",
        labelSegments: "Segmentos do traçado",
        colLength: "Comprimento (m)",
        colCost: "Custo",
        colHighway: "Tipo de via",
        colExistingPole: "Reusa poste",
        colSensitive: "Sensível",
        errorNoSource: "Defina um ponto de origem primeiro.",
        errorNoTerminals: "Adicione ao menos um terminal.",
        errorNoSegments: "Adicione corredores viários antes de calcular.",
      };
  }
}
