export const FEATURES = [
  {
    icon: "Map",
    title: "Mapa 2.5D de Alta Fidelidade",
    desc: "Extração vetorial precisa do OpenStreetMap com elevação e topografia real. Pronto para projeto, medição e BDGD/ANEEL.",
    color: "indigo",
  },
  {
    icon: "FileDown",
    title: "Exportação DXF Profissional",
    desc: "Arquivos AutoCAD com camadas semânticas, BIM light, metadados de proveniência e versionamento por artefato.",
    color: "emerald",
  },
  {
    icon: "Building2",
    title: "Multi-tenant Enterprise",
    desc: "Isolamento total por organização, RBAC granular, quotas configuráveis e trilha de auditoria exportável.",
    color: "violet",
  },
  {
    icon: "ShieldCheck",
    title: "Compliance LGPD + ANEEL",
    desc: "Residência de dados no Brasil, dossiê regulatório nativo, RIPD automatizado e cadeia de custódia verificável.",
    color: "rose",
  },
  {
    icon: "Zap",
    title: "SLO Contratual por Tenant",
    desc: "Catálogo SoA com SLA/SLO por tier de serviço. Monitoramento em tempo real com alertas acionáveis e runbooks.",
    color: "amber",
  },
  {
    icon: "BarChart3",
    title: "Observabilidade de Negócio",
    desc: "KPIs operacionais, taxa de sucesso por projeto, gargalos por região e FinOps com alertas de consumo.",
    color: "sky",
  },
];

export const PLANS = [
  {
    name: "Freemium",
    price: "R$ 0",
    subtitle: "Para validar a operação",
    cta: "Começar grátis",
    ctaLink: "/app",
    highlight: false,
    features: [
      "1 projeto ativo simultâneo",
      "Mapa 2.5D com edição essencial",
      "Exportação DXF limitada (50 objetos)",
      "1 usuário por organização",
      "Base de conhecimento e FAQ",
    ],
  },
  {
    name: "Pro Operacional",
    price: "R$ 249",
    period: "/mês",
    subtitle: "Para equipes técnicas em campo",
    cta: "Testar 14 dias grátis",
    ctaLink: "/app",
    highlight: true,
    features: [
      "Projetos ilimitados",
      "DXF completo com histórico de versões",
      "Dashboard com métricas de risco e SLO",
      "Até 10 usuários por organização",
      "Suporte prioritário em horário comercial",
      "Exportação BDGD (ANEEL)",
    ],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    subtitle: "Para concessionárias e integradores",
    cta: "Falar com especialista",
    ctaLink: "#contato",
    highlight: false,
    features: [
      "SSO, SCIM e governança avançada",
      "SLA contratual com penalidades",
      "Ambiente isolado (VPC dedicada)",
      "Onboarding técnico e treinamento",
      "Roadmap compartilhado e CAB",
      "Compliance LGPD + ANEEL + ICP-Brasil",
    ],
  },
];

export const FAQ = [
  {
    q: "O plano Freemium tem prazo de expiração?",
    a: "Não. O plano Freemium é permanente e ideal para validar o fluxo, treinamento interno e projetos pequenos.",
  },
  {
    q: "Como funciona a migração do Freemium para o Pro?",
    a: "A mudança de plano preserva todos os projetos e histórico. A diferença é o desbloqueio dos recursos avançados — sem perda de dados.",
  },
  {
    q: "Os dados ficam armazenados no Brasil?",
    a: "Sim. Todos os dados são processados e armazenados exclusivamente em infraestrutura localizada no Brasil, em conformidade com a LGPD.",
  },
  {
    q: "O sisTOPOGRAFIA exporta no formato BDGD da ANEEL?",
    a: "Sim, no plano Pro e Enterprise. O módulo de exportação nativo valida e gera o formato BDGD com dossiê de proveniência técnica.",
  },
  {
    q: "Existe suporte a implantação on-premise?",
    a: "Sim, no plano Enterprise. Oferecemos suporte a implantação on-premise ou híbrida para clientes com restrições de nuvem.",
  },
];
