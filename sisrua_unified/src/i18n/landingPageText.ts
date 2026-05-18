import type { AppLocale } from "../types";

type LandingPageText = {
  headerSub: string;
  navModules: string;
  navPlans: string;
  heroBadge: string;
  heroTitle: string;
  heroTitleHighlight: string;
  heroDesc: string;
  btnPilot: string;
  btnExplore: string;
  metricSpeed: string;
  metricRework: string;
  metricConsistency: string;
  cockpitTitle: string;
  miniKpiArea: string;
  miniKpiEdges: string;
  miniKpiPartitions: string;
  miniKpiCqt: string;
  diffTitle: string;
  diffPoint1: string;
  diffPoint2: string;
  diffPoint3: string;
  archTitleBadge: string;
  archTitle: string;
  module1Badge: string;
  module1Title: string;
  module1Text: string;
  module2Badge: string;
  module2Title: string;
  module2Text: string;
  module3Badge: string;
  module3Title: string;
  module3Text: string;
  timelineBadge: string;
  timelineStep1Title: string;
  timelineStep1Detail: string;
  timelineStep2Title: string;
  timelineStep2Detail: string;
  timelineStep3Title: string;
  timelineStep3Detail: string;
  plansBadge: string;
  plansTitle: string;
  plan1Name: string;
  plan1Price: string;
  plan1Cadence: string;
  plan1Points: string[];
  plan2Name: string;
  plan2Price: string;
  plan2Cadence: string;
  plan2Points: string[];
  plan3Name: string;
  plan3Price: string;
  plan3Cadence: string;
  plan3Points: string[];
  btnSelectPlan: (name: string) => string;
  ctaTitleBadge: string;
  ctaTitle: string;
  btnDemo: string;
  footerRights: string;
  footerLinks: {
    privacy: string;
    terms: string;
    support: string;
  };
};

const TEXTS: Record<AppLocale, LandingPageText> = {
  "pt-BR": {
    headerSub: "engenharia de redes MT/BT & precisão geodésica",
    navModules: "Módulos Técnicos",
    navPlans: "Licenciamento",
    heroBadge: "Padrão Concessionária Enterprise",
    heroTitle: "Projetos de Distribuição com",
    heroTitleHighlight: "metadados BIM e 2.5D.",
    heroDesc: "Acelere projetos de expansão e reforma de redes MT/BT com precisão geodésica. Integração nativa com OSM para extração topográfica, cálculo de queda de tensão (CQT) e exportação DXF. Comece agora, sem instalação.",
    btnPilot: "Acessar Plataforma Grátis",
    btnExplore: "Documentação Técnica",
    metricSpeed: "redução de levantamento",
    metricRework: "retrabalho evitado",
    metricConsistency: "conformidade regulatória",
    cockpitTitle: "centro de operações geospaciais",
    miniKpiArea: "abrangência",
    miniKpiEdges: "vãos de rede",
    miniKpiPartitions: "circuitos",
    miniKpiCqt: "ΔV máximo",
    diffTitle: "engenharia sem fricção",
    diffPoint1: "Topografia 2.5D: curvas de nível e meio-fio extraídos para CAD",
    diffPoint2: "Metadados BIM: ativos com atributos técnicos reais (Half-way BIM)",
    diffPoint3: "Validação em tempo real: conformidade NBR/ANEEL automática",
    archTitleBadge: "ecossistema de engenharia",
    archTitle: "Soluções integradas para o ciclo de vida da rede",
    module1Badge: "GEOFÍSICA URBANA",
    module1Title: "Gêmeo Digital Territorial",
    module1Text: "Extração automatizada da malha urbana com precisão centimétrica para base de projetos elétricos.",
    module2Badge: "CÁLCULO ELÉTRICO",
    module2Title: "Motor de Fluxo de Carga",
    module2Text: "Análise dinâmica de queda de tensão e otimização de bitolas sob normas regulatórias.",
    module3Badge: "ENTREGA TÉCNICA",
    module3Title: "Exportação Multicamadas",
    module3Text: "Geração de pranchas DXF 2.5D organizadas por layers de projeto e inventário.",
    timelineBadge: "workflow de alta performance",
    timelineStep1Title: "Delimitação Geográfica",
    timelineStep1Detail: "Definição da área via polígono com leitura instantânea de altimetria e obstáculos.",
    timelineStep2Title: "Engenharia Generativa",
    timelineStep2Detail: "Otimização automática de rotas e alocação de ativos com validação elétrica.",
    timelineStep3Title: "Entrega Executiva",
    timelineStep3Detail: "Pacote de projeto completo: DXF 2.5D, CSV e relatório de conformidade técnica.",
    plansBadge: "modelos de licenciamento",
    plansTitle: "Dimensione o poder de fogo da sua engenharia",
    plan1Name: "Individual",
    plan1Price: "R$ 0",
    plan1Cadence: "uso grátis contínuo",
    plan1Points: ["1 projeto por vez", "Exportação DXF limitada", "Acesso à base OSM"],
    plan2Name: "Pro Engenharia",
    plan2Price: "R$ 490",
    plan2Cadence: "por licença/mês",
    plan2Points: ["Projetos ilimitados", "Cálculo Elétrico Avançado", "Suporte a Metadados BIM"],
    plan3Name: "Corporate Grid",
    plan3Price: "Consultoria",
    plan3Cadence: "escala de rede",
    plan3Points: ["Integração GIS Corporativo", "Customização de Normas", "SLA de Alta Disponibilidade"],
    btnSelectPlan: (name) => `Licenciar ${name}`,
    ctaTitleBadge: "decisão de engenharia",
    ctaTitle: "Transforme meses de levantamento em minutos de design de rede. Grátis para começar.",
    btnDemo: "Solicitar Demo Enterprise",
    footerRights: `© ${new Date().getFullYear()} sisTOPOGRAFIA · Engenharia & Contexto Real`,
    footerLinks: {
      privacy: "Privacidade",
      terms: "Termos",
      support: "Suporte",
    },
  },
  "en-US": {
    headerSub: "corporate platform for LV engineering",
    navModules: "Modules",
    navPlans: "View Plans",
    heroBadge: "Enterprise B2B Evolution",
    heroTitle: "Electrical planning with",
    heroTitleHighlight: "real urban context.",
    heroDesc: "Experience designed for technical decision-makers: territorial context, GD engine, and DXF delivery in a single narrative for field, engineering, and executive management.",
    btnPilot: "Start Pilot",
    btnExplore: "Explore Modules",
    metricSpeed: "speed gain",
    metricRework: "rework avoided",
    metricConsistency: "technical consistency",
    cockpitTitle: "operational cockpit",
    miniKpiArea: "area",
    miniKpiEdges: "segments",
    miniKpiPartitions: "partitions",
    miniKpiCqt: "max v-drop",
    diffTitle: "immediate benefits",
    diffPoint1: "Streets and curbs in DXF for immediate contextual reading in CAD",
    diffPoint2: "Comparable GD scenarios per layer for engineering decision",
    diffPoint3: "Visual narrative ready for technical and commercial proposals",
    archTitleBadge: "value architecture",
    archTitle: "Three blocks to demonstrate technical value without friction",
    module1Badge: "CARTOGRAPHIC BASE",
    module1Title: "Live territorial reading",
    module1Text: "Consolidates urban mesh and technical context into a single base for LV engineering and regulatory planning.",
    module2Badge: "ORCHESTRATION",
    module2Title: "Risk-guided workflow",
    module2Text: "Prioritizes critical segments, organizes sectioning, and reduces rework between office, field, and operations.",
    module3Badge: "INTELLIGENCE",
    module3Title: "Actionable GD Engine",
    module3Text: "Executes partitioning scenarios and transforms technical results into operational action with traceability.",
    timelineBadge: "recommended operational flow",
    timelineStep1Title: "Select area",
    timelineStep1Detail: "Polygon or radius with immediate reading of terrain, urban mesh, and network context.",
    timelineStep2Title: "Run GD",
    timelineStep2Detail: "Partitions, conductors, and transformers with auditable electrical diagnosis per scenario.",
    timelineStep3Title: "Export DXF",
    timelineStep3Detail: "CAD-ready output with streets, curbs, and standardized engineering layers.",
    plansBadge: "commercial model",
    plansTitle: "Scale tailored to your operation",
    plan1Name: "Freemium",
    plan1Price: "$ 0",
    plan1Cadence: "continuous use",
    plan1Points: ["1 active project", "Essential DXF", "Learning base"],
    plan2Name: "Operational Pro",
    plan2Price: "$ 49",
    plan2Cadence: "per month",
    plan2Points: ["Unlimited projects", "GD Engine", "History and audit"],
    plan3Name: "Enterprise",
    plan3Price: "Contact us",
    plan3Cadence: "dedicated scale",
    plan3Points: ["SSO and governance", "Contractual SLA", "Isolated environment"],
    btnSelectPlan: (name) => `Select ${name}`,
    ctaTitleBadge: "next step",
    ctaTitle: "Take your LV network operation to a corporate standard.",
    btnDemo: "Request Demo",
    footerRights: `© ${new Date().getFullYear()} sisTOPOGRAFIA · Engineering & Real Context`,
    footerLinks: {
      privacy: "Privacy",
      terms: "Terms",
      support: "Support",
    },
  },
  "es-ES": {
    headerSub: "plataforma corporativa para ingeniería BT",
    navModules: "Módulos",
    navPlans: "Ver Planes",
    heroBadge: "Evolución B2B Enterprise",
    heroTitle: "Planeamiento eléctrico con",
    heroTitleHighlight: "lectura urbana real.",
    heroDesc: "Experiencia pensada para decisores técnicos: contexto territorial, motor DG y entrega DXF en una narrativa única para campo, ingeniería y gestión ejecutiva.",
    btnPilot: "Iniciar Piloto",
    btnExplore: "Explorar Módulos",
    metricSpeed: "ganancia de velocidad",
    metricRework: "retrabajo evitado",
    metricConsistency: "consistencia técnica",
    cockpitTitle: "cockpit operacional",
    miniKpiArea: "área",
    miniKpiEdges: "tramos",
    miniKpiPartitions: "particiones",
    miniKpiCqt: "cqt máx",
    diffTitle: "diferenciales inmediatos",
    diffPoint1: "Calles y bordillos en DXF para lectura contextual inmediata en CAD",
    diffPoint2: "Escenarios DG comparables por capa para decisión de ingeniería",
    diffPoint3: "Narrativa visual lista para propuestas técnicas y comerciales",
    archTitleBadge: "arquitectura de valor",
    archTitle: "Tres bloques para demostrar valor técnico sem fricción",
    module1Badge: "BASE CARTOGRÁFICA",
    module1Title: "Lectura territorial viva",
    module1Text: "Consolida malla urbana y contexto técnico en una base única para ingeniería de BT y planeamiento regulatorio.",
    module2Badge: "ORQUESTACIÓN",
    module2Title: "Flujo guiado por riesgo",
    module2Text: "Prioriza tramos críticos, organiza seccionamiento y reduce retrabajo entre oficina, campo y operación.",
    module3Badge: "INTELIGENCIA",
    module3Title: "Motor DG accionable",
    module3Text: "Ejecuta escenarios de particionamiento y transforma el resultado técnico en acción operativa con trazabilidad.",
    timelineBadge: "flujo operativo recomendado",
    timelineStep1Title: "Seleccionar área",
    timelineStep1Detail: "Polígono o radio con lectura inmediata del terreno, malla urbana y contexto de red.",
    timelineStep2Title: "Ejecutar DG",
    timelineStep2Detail: "Particiones, conductores y trafos con diagnóstico eléctrico auditable por escenario.",
    timelineStep3Title: "Exportar DXF",
    timelineStep3Detail: "Salida lista para CAD con calles, bordillos y capas de ingeniería estandarizadas.",
    plansBadge: "modelo comercial",
    plansTitle: "Escala a la medida de su operación",
    plan1Name: "Freemium",
    plan1Price: "€ 0",
    plan1Cadence: "uso continuo",
    plan1Points: ["1 proyecto activo", "DXF esencial", "Base de aprendizaje"],
    plan2Name: "Pro Operacional",
    plan2Price: "€ 45",
    plan2Cadence: "por mes",
    plan2Points: ["Proyectos ilimitados", "Motor DG", "Historial y auditoría"],
    plan3Name: "Enterprise",
    plan3Price: "Consultar",
    plan3Cadence: "escala dedicada",
    plan3Points: ["SSO y gobernanza", "SLA contractual", "Ambiente aislado"],
    btnSelectPlan: (name) => `Seleccionar ${name}`,
    ctaTitleBadge: "próximo paso",
    ctaTitle: "Lleve su operación de red BT a un estándar corporativo.",
    btnDemo: "Solicitar Demostración",
    footerRights: `© ${new Date().getFullYear()} sisTOPOGRAFIA · Ingeniería y Contexto Real`,
    footerLinks: {
      privacy: "Privacidad",
      terms: "Términos",
      support: "Soporte",
    },
  },
};

export function getLandingPageText(locale: AppLocale): LandingPageText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
