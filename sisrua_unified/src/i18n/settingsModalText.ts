import type { AppLocale } from "../types";

type SettingsModalText = {
  panelTitle: string;
  closePanel: string;
  generalTabLabel: string;
  generalTabTitle: string;
  projectTabLabel: string;
  projectTabTitle: string;
  exportResultsTitle: string;
  exportDisabledMessage: string;
  exportGeoJson: string;
  exportDxf: string;
  exportMemorialPdfLabel: string;
  exportMemorialPdfHint: string;
  saveProject: string;
  loadProject: string;
  loadProjectFile: string;
  titleBlockTitle: string;
  titleBlockDescription: string;
  projectName: string;
  projectNamePlaceholder: string;
  companyName: string;
  companyNamePlaceholder: string;
  engineerName: string;
  engineerNamePlaceholder: string;
  projectDate: string;
  projectDatePlaceholder: string;
  btTopologyTitle: string;
  projectType: string;
  projectTypeBranch: string;
  projectTypeGeneral: string;
  projectTypeClandestine: string;
  clandestineArea: string;
  clandestineAreaTitle: string;
  clandestineAreaHelp: string;
  mapEditorMode: string;
  editorModeNavigate: string;
  editorModeAddPole: string;
  editorModeAddEdge: string;
  editorModeAddTransformer: string;
  transformerCalculationTitle: string;
  transformerCalculationAuto: string;
  transformerCalculationManual: string;
  transformerCalculationHelp: string;
  qtPontoMethodTitle: string;
  qtPontoMethodImpedance: string;
  qtPontoMethodPowerFactor: string;
  qtPontoMethodHelp: string;
  qtPowerFactorTitle: string;
  qtPowerFactorInputTitle: string;
  qtPowerFactorHelp: string;
  interfaceMapTitle: string;
  canonicalStyleTitle: string;
  canonicalStyleDescription: string;
  themeLabelLight: string;
  themeLabelDark: string;
  themeLabelSunlight: string;
  toggleTheme: string;
  mapVector: string;
  mapSatellite: string;
  interfaceLanguage: string;
  interfaceLanguageHint: string;
  dxfLayersTitle: string;
  layerBuildings: string;
  layerDimensions: string;
  layerRoads: string;
  layerCurbs: string;
  layerTerrain: string;
  layerContours: string;
  contourInterval: string;
  contourType: string;
  contourSpline: string;
  contourPolyline: string;
  layerFurniture: string;
  layerLabels: string;
  layerGrid: string;
  systemTitle: string;
  geometryProcessing: string;
  simplificationOff: string;
  simplificationLow: string;
  simplificationMedium: string;
  simplificationHigh: string;
  orthogonalize: string;
  projectionTitle: string;
  projectionLocal: string;
  projectionUtm: string;
  projectionHint: string;
  slopeAnalysisLabel: string;
  uiDensityTitle: string;
  uiDensityCompact: string;
  uiDensityComfortable: string;
  focusModeLabel: string;
  focusModeHint: string;
};

const TEXTS: Record<AppLocale, SettingsModalText> = {
  "pt-BR": {
    panelTitle: "Painel de Controle",
    closePanel: "Fechar painel",
    generalTabLabel: "Geral & Exportação",
    generalTabTitle: "Abrir aba Geral e Exportação",
    projectTabLabel: "Projeto & Metadados",
    projectTabTitle: "Abrir aba Projeto e Metadados",
    exportResultsTitle: "Exportar Resultados",
    exportDisabledMessage:
      "Realize uma análise primeiro para habilitar a exportação.",
    exportGeoJson: "GeoJSON",
    exportDxf: "DXF (CAD)",
    exportMemorialPdfLabel: "Gerar memorial descritivo em PDF junto com DXF",
    exportMemorialPdfHint:
      "Quando ativado, o sistema baixa também um memorial técnico em PDF após o DXF.",
    saveProject: "Salvar Projeto",
    loadProject: "Carregar Projeto",
    loadProjectFile: "Carregar arquivo de projeto",
    titleBlockTitle: "Carimbo (Title Block)",
    titleBlockDescription: "Dados automáticos para o arquivo CAD.",
    projectName: "Nome do Projeto",
    projectNamePlaceholder: "Nome do projeto",
    companyName: "Empresa",
    companyNamePlaceholder: "Nome da empresa",
    engineerName: "Responsável",
    engineerNamePlaceholder: "Nome do responsável",
    projectDate: "Data",
    projectDatePlaceholder: "DD/MM/AAAA",
    btTopologyTitle: "Topologia Rede BT",
    projectType: "Tipo de Projeto",
    projectTypeBranch: "RAMAIS",
    projectTypeGeneral: "GERAL",
    projectTypeClandestine: "CLANDEST.",
    clandestineArea: "Área de Clandestinos (m²)",
    clandestineAreaTitle: "Área de clandestinos em metros quadrados",
    clandestineAreaHelp: "Campo obrigatório para o fluxo de clandestinos.",
    mapEditorMode: "Modo de Edição no Mapa",
    editorModeNavigate: "Navegar",
    editorModeAddPole: "Inserir Poste",
    editorModeAddEdge: "Inserir Condutor",
    editorModeAddTransformer: "Inserir Trafo",
    transformerCalculationTitle: "Cálculo dos Transformadores",
    transformerCalculationAuto: "Automático",
    transformerCalculationManual: "Manual",
    transformerCalculationHelp:
      "Automático: recalcula demanda/corrente conforme topologia. Manual: preserva o que for informado no card.",
    qtPontoMethodTitle: "Método do QT-PONTO",
    qtPontoMethodImpedance: "Módulo |Z|",
    qtPontoMethodPowerFactor: "R·cosφ + X·sinφ",
    qtPontoMethodHelp:
      "Padrão: módulo da impedância para manter o cálculo mais conservador e compatível com a planilha atual.",
    qtPowerFactorTitle: "Fator de Potência do QT",
    qtPowerFactorInputTitle:
      "Fator de potência usado no QT-PONTO quando o método com fator de potência estiver ativo",
    qtPowerFactorHelp:
      "Usado apenas quando o método R·cosφ + X·sinφ estiver ativo. Valor inicial: 0,92.",
    interfaceMapTitle: "Interface e Mapa",
    canonicalStyleTitle: "Estilo visual canônico ativo",
    canonicalStyleDescription:
      "Mudanças globais de estilo são bloqueadas por padrão. Variações futuras devem existir apenas como opção do usuário neste menu.",
    themeLabelLight: "Tema Claro",
    themeLabelDark: "Tema Escuro",
    themeLabelSunlight: "Alto Contraste (Campo)",
    toggleTheme: "Alternar tema",
    mapVector: "Mapa Vetorial",
    mapSatellite: "Satélite",
    interfaceLanguage: "Idioma da interface",
    interfaceLanguageHint:
      "Base oficial do produto permanece em pt-BR; este seletor prepara a camada de i18n para ambientes multiempresa.",
    dxfLayersTitle: "Camadas DXF",
    layerBuildings: "Edificações (Hatch Sólido)",
    layerDimensions: "Gerar Cotas Automáticas",
    layerRoads: "Vias (Eixos e Bordas)",
    layerCurbs: "Gerar Guias e Sarjetas (Offsets)",
    layerTerrain: "Terreno (Malha 2.5D)",
    layerContours: "Curvas de Nível (Isolinhas)",
    contourInterval: "Intervalo de Curva",
    contourType: "Tipo de Curva",
    contourSpline: "Curva Suave (Spline)",
    contourPolyline: "Polilinha (Compatível)",
    layerFurniture: "Detalhes (Árvores/Postes)",
    layerLabels: "Rótulos e Dados BIM",
    layerGrid: "Malha de Coordenadas (Grid)",
    systemTitle: "Sistema",
    geometryProcessing: "Processamento Geométrico",
    simplificationOff: "Des.",
    simplificationLow: "Baixa",
    simplificationMedium: "Média",
    simplificationHigh: "Alta",
    orthogonalize: "Forçar Ângulos Retos (Ortogonalizar)",
    projectionTitle: "Projeção DXF",
    projectionLocal: "Local (Relativo)",
    projectionUtm: "UTM (Absoluto)",
    projectionHint:
      "UTM Absoluto usa coordenadas reais compatíveis com Google Earth e GPS",
    slopeAnalysisLabel: "Hachura de Declividade Crítica",
    uiDensityTitle: "Densidade da Interface",
    uiDensityCompact: "Compacta",
    uiDensityComfortable: "Confortável",
    focusModeLabel: "Modo Foco (Auto-ocultar UI)",
    focusModeHint: "Oculta painéis durante a edição para maximizar o mapa.",
  },
  "en-US": {
    panelTitle: "Control Panel",
    closePanel: "Close panel",
    generalTabLabel: "General & Export",
    generalTabTitle: "Open General and Export tab",
    projectTabLabel: "Project & Metadata",
    projectTabTitle: "Open Project and Metadata tab",
    exportResultsTitle: "Export Results",
    exportDisabledMessage: "Run an analysis first to enable export.",
    exportGeoJson: "GeoJSON",
    exportDxf: "DXF (CAD)",
    exportMemorialPdfLabel: "Generate descriptive memorial PDF with DXF",
    exportMemorialPdfHint:
      "When enabled, the system also downloads a technical memorial PDF after the DXF.",
    saveProject: "Save Project",
    loadProject: "Load Project",
    loadProjectFile: "Load project file",
    titleBlockTitle: "Title Block",
    titleBlockDescription: "Automatic data for the CAD file.",
    projectName: "Project Name",
    projectNamePlaceholder: "Project name",
    companyName: "Company",
    companyNamePlaceholder: "Company name",
    engineerName: "Responsible Engineer",
    engineerNamePlaceholder: "Responsible engineer name",
    projectDate: "Date",
    projectDatePlaceholder: "MM/DD/YYYY",
    btTopologyTitle: "LV Network Topology",
    projectType: "Project Type",
    projectTypeBranch: "BRANCHES",
    projectTypeGeneral: "GENERAL",
    projectTypeClandestine: "UNREG.",
    clandestineArea: "Unregistered Area (m²)",
    clandestineAreaTitle: "Unregistered area in square meters",
    clandestineAreaHelp: "Required field for the unregistered-area workflow.",
    mapEditorMode: "Map Editing Mode",
    editorModeNavigate: "Navigate",
    editorModeAddPole: "Add Pole",
    editorModeAddEdge: "Add Conductor",
    editorModeAddTransformer: "Add Transformer",
    transformerCalculationTitle: "Transformer Calculation",
    transformerCalculationAuto: "Automatic",
    transformerCalculationManual: "Manual",
    transformerCalculationHelp:
      "Automatic: recalculates demand/current from topology. Manual: preserves what is entered in the card.",
    qtPontoMethodTitle: "QT-POINT Method",
    qtPontoMethodImpedance: "|Z| Modulus",
    qtPontoMethodPowerFactor: "R·cosφ + X·sinφ",
    qtPontoMethodHelp:
      "Default: impedance modulus to keep the calculation conservative and compatible with the current spreadsheet.",
    qtPowerFactorTitle: "QT Power Factor",
    qtPowerFactorInputTitle:
      "Power factor used in QT-POINT when the power-factor method is active",
    qtPowerFactorHelp:
      "Used only when the R·cosφ + X·sinφ method is active. Initial value: 0,92.",
    interfaceMapTitle: "Interface & Map",
    canonicalStyleTitle: "Canonical visual style active",
    canonicalStyleDescription:
      "Global style changes are blocked by default. Future variations must exist only as a user option in this menu.",
    themeLabelLight: "Light Theme",
    themeLabelDark: "Dark Theme",
    themeLabelSunlight: "High Contrast (Sunlight)",
    toggleTheme: "Toggle theme",
    mapVector: "Vector Map",
    mapSatellite: "Satellite",
    interfaceLanguage: "Interface language",
    interfaceLanguageHint:
      "The official product baseline remains pt-BR; this selector prepares the i18n layer for multi-company environments.",
    dxfLayersTitle: "DXF Layers",
    layerBuildings: "Buildings (Solid Hatch)",
    layerDimensions: "Generate Automatic Dimensions",
    layerRoads: "Roads (Centerlines and Edges)",
    layerCurbs: "Generate Curbs and Gutters (Offsets)",
    layerTerrain: "Terrain (2.5D Mesh)",
    layerContours: "Contour Lines",
    contourInterval: "Contour Interval",
    contourType: "Contour Type",
    contourSpline: "Smooth Curve (Spline)",
    contourPolyline: "Polyline (Compatible)",
    layerFurniture: "Details (Trees/Poles)",
    layerLabels: "Labels and BIM Data",
    layerGrid: "Coordinate Grid",
    systemTitle: "System",
    geometryProcessing: "Geometry Processing",
    simplificationOff: "Off",
    simplificationLow: "Low",
    simplificationMedium: "Medium",
    simplificationHigh: "High",
    orthogonalize: "Force Right Angles (Orthogonalize)",
    projectionTitle: "DXF Projection",
    projectionLocal: "Local (Relative)",
    projectionUtm: "UTM (Absolute)",
    projectionHint:
      "Absolute UTM uses real-world coordinates compatible with Google Earth and GPS",
    slopeAnalysisLabel: "Critical Slope Hatch",
    uiDensityTitle: "UI Density",
    uiDensityCompact: "Compact",
    uiDensityComfortable: "Comfortable",
    focusModeLabel: "Focus Mode (Auto-hide UI)",
    focusModeHint: "Hides panels during editing to maximize the map.",
  },
  "es-ES": {
    panelTitle: "Panel de Control",
    closePanel: "Cerrar panel",
    generalTabLabel: "General y Exportación",
    generalTabTitle: "Abrir pestaña General y Exportación",
    projectTabLabel: "Proyecto y Metadados",
    projectTabTitle: "Abrir pestaña Proyecto y Metadados",
    exportResultsTitle: "Exportar Resultados",
    exportDisabledMessage:
      "Ejecute un análise primero para habilitar la exportación.",
    exportGeoJson: "GeoJSON",
    exportDxf: "DXF (CAD)",
    exportMemorialPdfLabel: "Generar memorial descriptivo en PDF junto con DXF",
    exportMemorialPdfHint:
      "Cuando está activo, el sistema también descarga un memorial técnico en PDF después del DXF.",
    saveProject: "Guardar Proyecto",
    loadProject: "Cargar Proyecto",
    loadProjectFile: "Cargar archivo de proyecto",
    titleBlockTitle: "Rótulo (Title Block)",
    titleBlockDescription: "Datos automáticos para el archivo CAD.",
    projectName: "Nombre del Proyecto",
    projectNamePlaceholder: "Nombre del proyecto",
    companyName: "Empresa",
    companyNamePlaceholder: "Nombre de la empresa",
    engineerName: "Responsable",
    engineerNamePlaceholder: "Nombre del responsable",
    projectDate: "Fecha",
    projectDatePlaceholder: "DD/MM/AAAA",
    btTopologyTitle: "Topología Red BT",
    projectType: "Tipo de Proyecto",
    projectTypeBranch: "RAMALES",
    projectTypeGeneral: "GENERAL",
    projectTypeClandestine: "CLANDEST.",
    clandestineArea: "Área de Clandestinos (m²)",
    clandestineAreaTitle: "Área de clandestinos en metros cuadrados",
    clandestineAreaHelp: "Campo obligatorio para el flujo de clandestinos.",
    mapEditorMode: "Modo de Edición en el Mapa",
    editorModeNavigate: "Navegar",
    editorModeAddPole: "Insertar Poste",
    editorModeAddEdge: "Insertar Conductor",
    editorModeAddTransformer: "Insertar Trafo",
    transformerCalculationTitle: "Cálculo de los Transformadores",
    transformerCalculationAuto: "Automático",
    transformerCalculationManual: "Manual",
    transformerCalculationHelp:
      "Automático: recalcula demanda/corriente según la topología. Manual: conserva lo informado en la tarjeta.",
    qtPontoMethodTitle: "Método del QT-PUNTO",
    qtPontoMethodImpedance: "Módulo |Z|",
    qtPontoMethodPowerFactor: "R·cosφ + X·sinφ",
    qtPontoMethodHelp:
      "Predeterminado: módulo de la impedancia para mantener el cálculo más conservador y compatible con la hoja actual.",
    qtPowerFactorTitle: "Factor de Potencia del QT",
    qtPowerFactorInputTitle:
      "Factor de potencia usado en QT-PUNTO cuando el método con factor de potencia está activo",
    qtPowerFactorHelp:
      "Usado solo cuando el método R·cosφ + X·sinφ está activo. Valor inicial: 0,92.",
    interfaceMapTitle: "Interfaz y Mapa",
    canonicalStyleTitle: "Estilo visual canónico activo",
    canonicalStyleDescription:
      "Los cambios globales de estilo están bloqueados por defecto. Las variaciones futuras solo deben existir como opción del usuario en este menú.",
    themeLabelLight: "Tema Claro",
    themeLabelDark: "Tema Oscuro",
    themeLabelSunlight: "Alto Contraste (Campo)",
    toggleTheme: "Cambiar tema",
    mapVector: "Mapa Vectorial",
    mapSatellite: "Satélite",
    interfaceLanguage: "Idioma de la interfaz",
    interfaceLanguageHint:
      "La base oficial del producto sigue siendo pt-BR; este selector prepara la capa de i18n para entornos multiempresa.",
    dxfLayersTitle: "Capas DXF",
    layerBuildings: "Edificaciones (Hatch Sólido)",
    layerDimensions: "Generar Cotas Automáticas",
    layerRoads: "Vías (Ejes y Bordes)",
    layerCurbs: "Generar Guías y Cunetas (Offsets)",
    layerTerrain: "Terreno (Malla 2.5D)",
    layerContours: "Curvas de Nível",
    contourInterval: "Intervalo de Curva",
    contourType: "Tipo de Curva",
    contourSpline: "Curva Suave (Spline)",
    contourPolyline: "Polilínea (Compatible)",
    layerFurniture: "Detalles (Árboles/Postes)",
    layerLabels: "Rótulos y Datos BIM",
    layerGrid: "Cuadrícula de Coordenadas",
    systemTitle: "Sistema",
    geometryProcessing: "Procesamiento Geométrico",
    simplificationOff: "Des.",
    simplificationLow: "Baja",
    simplificationMedium: "Media",
    simplificationHigh: "Alta",
    orthogonalize: "Forzar Ángulos Rectos (Ortogonalizar)",
    projectionTitle: "Proyección DXF",
    projectionLocal: "Local (Relativa)",
    projectionUtm: "UTM (Absoluta)",
    projectionHint:
      "UTM Absoluta usa coordenadas reales compatibles con Google Earth e GPS",
    slopeAnalysisLabel: "Tramado de Pendiente Crítica",
    uiDensityTitle: "Densidad de la Interfaz",
    uiDensityCompact: "Compacta",
    uiDensityComfortable: "Cómoda",
    focusModeLabel: "Modo Foco (Auto-ocultar UI)",
    focusModeHint: "Oculta paneles durante la edición para maximizar el mapa.",
  },
};

export function getSettingsModalText(locale: AppLocale): SettingsModalText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
