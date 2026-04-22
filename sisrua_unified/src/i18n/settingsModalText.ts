import type { AppLocale } from "../types";

type SettingsModalText = {
  panelTitle: string;
  closePanel: string;
  generalTabLabel: string;
  generalTabTitle: string;
  projectTabLabel: string;
  projectTabTitle: string;
  interfaceMapTitle: string;
  canonicalStyleTitle: string;
  canonicalStyleDescription: string;
  themeLabelLight: string;
  themeLabelDark: string;
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
};

const TEXTS: Record<AppLocale, SettingsModalText> = {
  "pt-BR": {
    panelTitle: "Painel de Controle",
    closePanel: "Fechar painel",
    generalTabLabel: "Geral & Exportação",
    generalTabTitle: "Abrir aba Geral e Exportação",
    projectTabLabel: "Projeto & Metadados",
    projectTabTitle: "Abrir aba Projeto e Metadados",
    interfaceMapTitle: "Interface e Mapa",
    canonicalStyleTitle: "Estilo visual canônico ativo",
    canonicalStyleDescription:
      "Mudanças globais de estilo são bloqueadas por padrão. Variações futuras devem existir apenas como opção do usuário neste menu.",
    themeLabelLight: "Tema Claro",
    themeLabelDark: "Tema Escuro",
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
  },
  "en-US": {
    panelTitle: "Control Panel",
    closePanel: "Close panel",
    generalTabLabel: "General & Export",
    generalTabTitle: "Open General and Export tab",
    projectTabLabel: "Project & Metadata",
    projectTabTitle: "Open Project and Metadata tab",
    interfaceMapTitle: "Interface & Map",
    canonicalStyleTitle: "Canonical visual style active",
    canonicalStyleDescription:
      "Global style changes are blocked by default. Future variations must exist only as a user option in this menu.",
    themeLabelLight: "Light Theme",
    themeLabelDark: "Dark Theme",
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
  },
  "es-ES": {
    panelTitle: "Panel de Control",
    closePanel: "Cerrar panel",
    generalTabLabel: "General y Exportación",
    generalTabTitle: "Abrir pestaña General y Exportación",
    projectTabLabel: "Proyecto y Metadatos",
    projectTabTitle: "Abrir pestaña Proyecto y Metadatos",
    interfaceMapTitle: "Interfaz y Mapa",
    canonicalStyleTitle: "Estilo visual canónico activo",
    canonicalStyleDescription:
      "Los cambios globales de estilo están bloqueados por defecto. Las variaciones futuras solo deben existir como opción del usuario en este menú.",
    themeLabelLight: "Tema Claro",
    themeLabelDark: "Tema Oscuro",
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
    layerContours: "Curvas de Nivel",
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
      "UTM Absoluta usa coordenadas reales compatibles con Google Earth y GPS",
  },
};

export function getSettingsModalText(locale: AppLocale): SettingsModalText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}