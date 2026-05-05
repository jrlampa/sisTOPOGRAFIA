import type { AppLocale } from "../types";

type MtRouterText = {
  title: string;
  btnReset: string;
  btnImportKmz: string;
  btnParsingKmz: string;
  btnPickSource: string;
  btnPickTerminals: string;
  hintPickSource: string;
  hintPickTerminals: string;
  labelSource: string;
  sourceEmpty: string;
  labelTerminals: string;
  terminalsEmpty: string;
  labelCorridors: string;
  corridorCount: (n: number) => string;
  labelSnapMax: string;
  labelNetworkProfile: string;
  btnCalculate: string;
  btnCalculating: string;
  btnApply: string;
  btnApplying: string;
  resultFeasible: string;
  resultInfeasible: string;
  resultTerminals: string;
  resultTotalLength: string;
  resultSegments: string;
  resultSegmentedTitle: string;
  resultUnreachable: string;
  resultExistingPole: string;
  errorNoSource: string;
  errorNoTerminals: string;
  errorNoCorridors: string;
  errorNoResult: string;
  errorUnreachable: string;
};

const TEXTS: Record<AppLocale, MtRouterText> = {
  "pt-BR": {
    title: "MT Router",
    btnReset: "Limpar tudo",
    btnImportKmz: "Importar KMZ / KML",
    btnParsingKmz: "Processando KMZ…",
    btnPickSource: "Origem",
    btnPickTerminals: "Terminais",
    hintPickSource: "Clique no mapa para definir o ponto de origem da MT",
    hintPickTerminals:
      "Clique no mapa para adicionar terminais. Clique em 'Terminais' novamente para parar.",
    labelSource: "Origem MT",
    sourceEmpty: "Não definida — importe KMZ ou selecione no mapa",
    labelTerminals: "Terminais",
    terminalsEmpty: "Nenhum terminal — importe KMZ ou adicione no mapa",
    labelCorridors: "Corredores viários",
    corridorCount: (n) => `${n} segmentos`,
    labelSnapMax: "Snap max (m)",
    labelNetworkProfile: "Padrão de rede MT",
    btnCalculate: "Calcular Roteamento MT",
    btnCalculating: "Calculando…",
    btnApply: "Aplicar Projeto MT",
    btnApplying: "Aplicando…",
    resultFeasible: "Roteamento Viável",
    resultInfeasible: "Roteamento Inviável",
    resultTerminals: "Terminais conectados",
    resultTotalLength: "Comprimento total",
    resultSegments: "Segmentos de rota",
    resultSegmentedTitle: "Distância por perna",
    resultUnreachable: "Terminais não alcançados",
    resultExistingPole: "poste existente",
    errorNoSource: "Defina o ponto de origem da MT.",
    errorNoTerminals: "Adicione pelo menos um terminal.",
    errorNoCorridors:
      "Importe corredores viários via KMZ ou adicione manualmente.",
    errorNoResult:
      "Nenhum resultado disponível para aplicar. Execute o cálculo primeiro.",
    errorUnreachable:
      "Nenhum terminal alcançável. Verifique a malha viária e a distância de snap.",
  },
  "en-US": {
    title: "MT Router",
    btnReset: "Clear all",
    btnImportKmz: "Import KMZ / KML",
    btnParsingKmz: "Processing KMZ…",
    btnPickSource: "Source",
    btnPickTerminals: "Terminals",
    hintPickSource: "Click on the map to set the MT source point",
    hintPickTerminals:
      "Click on the map to add terminals. Click 'Terminals' again to stop.",
    labelSource: "MT Source",
    sourceEmpty: "Not defined — import KMZ or pick on map",
    labelTerminals: "Terminals",
    terminalsEmpty: "No terminals — import KMZ or add on map",
    labelCorridors: "Road corridors",
    corridorCount: (n) => `${n} segments`,
    labelSnapMax: "Max snap (m)",
    labelNetworkProfile: "MT network profile",
    btnCalculate: "Calculate MT Routing",
    btnCalculating: "Calculating…",
    btnApply: "Apply MT Project",
    btnApplying: "Applying…",
    resultFeasible: "Routing Feasible",
    resultInfeasible: "Routing Infeasible",
    resultTerminals: "Connected terminals",
    resultTotalLength: "Total length",
    resultSegments: "Route segments",
    resultSegmentedTitle: "Distance per leg",
    resultUnreachable: "Unreachable terminals",
    resultExistingPole: "existing pole",
    errorNoSource: "Define the MT source point.",
    errorNoTerminals: "Add at least one terminal.",
    errorNoCorridors: "Import road corridors via KMZ or add manually.",
    errorNoResult: "No result to apply. Run the calculation first.",
    errorUnreachable:
      "No reachable terminal. Check the road network and snap distance.",
  },
  "es-ES": {
    title: "MT Router",
    btnReset: "Limpiar todo",
    btnImportKmz: "Importar KMZ / KML",
    btnParsingKmz: "Procesando KMZ…",
    btnPickSource: "Origen",
    btnPickTerminals: "Terminales",
    hintPickSource: "Haz clic en el mapa para definir el punto de origen MT",
    hintPickTerminals:
      "Haz clic en el mapa para agregar terminales. Haz clic en 'Terminales' nuevamente para detener.",
    labelSource: "Origen MT",
    sourceEmpty: "No definido — importe KMZ o seleccione en el mapa",
    labelTerminals: "Terminales",
    terminalsEmpty: "Sin terminales — importe KMZ o agregue en el mapa",
    labelCorridors: "Corredores viales",
    corridorCount: (n) => `${n} segmentos`,
    labelSnapMax: "Snap máx (m)",
    labelNetworkProfile: "Perfil de red MT",
    btnCalculate: "Calcular Enrutamiento MT",
    btnCalculating: "Calculando…",
    btnApply: "Aplicar Proyecto MT",
    btnApplying: "Aplicando…",
    resultFeasible: "Enrutamiento Viable",
    resultInfeasible: "Enrutamiento Inviable",
    resultTerminals: "Terminales conectados",
    resultTotalLength: "Longitud total",
    resultSegments: "Segmentos de ruta",
    resultSegmentedTitle: "Distancia por tramo",
    resultUnreachable: "Terminales no alcanzados",
    resultExistingPole: "poste existente",
    errorNoSource: "Define el punto de origen MT.",
    errorNoTerminals: "Agrega al menos un terminal.",
    errorNoCorridors:
      "Importa corredores viales vía KMZ o agrégalos manualmente.",
    errorNoResult:
      "Sin resultado disponible para aplicar. Ejecuta el cálculo primero.",
    errorUnreachable:
      "Ningún terminal alcanzable. Verifica la red vial y la distancia de snap.",
  },
};

export function getMtRouterText(locale: AppLocale): MtRouterText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
