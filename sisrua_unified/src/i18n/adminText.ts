import { AppLocale } from "../types";

export const getAdminText = (locale: AppLocale) => {
  const texts = {
    "pt-BR": {
      title: "Painel Administrativo",
      auth: {
        placeholder: "Insira o token de administrador",
        button: "Autenticar",
        error: "Não autorizado — verifique o token.",
      },
      sections: {
        saude: "Saúde do Sistema",
        dashboard: "Dashboard MVs",
        usuarios: "Usuários e Papéis",
        papeis: "Distribuição de Papéis",
        tenants: "Tenants",
        quotas: "Quotas",
        flags: "Feature Flags",
        kpis: "KPIs Operacionais",
        servicos: "Perfis de Serviço (SLA/SLO)",
        retencao: "Retenção de Dados",
        capacidade: "Capacity Planning",
        vulns: "Vulnerabilidades (CVSS SLA)",
        classificacao: "Classificação da Informação",
        holdings: "Holdings & Multiempresa",
        finops: "FinOps — Controle de Custos",
      },
      common: {
        loading: "Carregando...",
        errorPrefix: "Erro: ",
        noData: "Nenhum dado encontrado.",
        active: "Ativo",
        inactive: "Inativo",
      }
    },
    "en-US": {
      title: "Admin Panel",
      auth: {
        placeholder: "Enter admin token",
        button: "Authenticate",
        error: "Unauthorized — check token.",
      },
      sections: {
        saude: "System Health",
        dashboard: "MV Dashboard",
        usuarios: "Users & Roles",
        papeis: "Role Distribution",
        tenants: "Tenants",
        quotas: "Quotas",
        flags: "Feature Flags",
        kpis: "Operational KPIs",
        servicos: "Service Profiles (SLA/SLO)",
        retencao: "Data Retention",
        capacidade: "Capacity Planning",
        vulns: "Vulnerabilities (CVSS SLA)",
        classificacao: "Information Classification",
        holdings: "Holdings & Multi-company",
        finops: "FinOps — Cost Control",
      },
      common: {
        loading: "Loading...",
        errorPrefix: "Error: ",
        noData: "No data found.",
        active: "Active",
        inactive: "Inactive",
      }
    },
    "es-ES": {
      title: "Panel de Administración",
      auth: {
        placeholder: "Ingrese el token de administrador",
        button: "Autenticar",
        error: "No autorizado — verifique el token.",
      },
      sections: {
        saude: "Salud del Sistema",
        dashboard: "Tablero MVs",
        usuarios: "Usuarios y Roles",
        papeis: "Distribución de Roles",
        tenants: "Inquilinos",
        quotas: "Cuotas",
        flags: "Banderas de Características",
        kpis: "KPIs Operativos",
        servicos: "Perfiles de Servicio (SLA/SLO)",
        retencao: "Retención de Datos",
        capacidade: "Planificación de Capacidad",
        vulns: "Vulnerabilidades (CVSS SLA)",
        classificacao: "Clasificación de la Información",
        holdings: "Holdings y Multiempresa",
        finops: "FinOps — Control de Costos",
      },
      common: {
        loading: "Cargando...",
        errorPrefix: "Error: ",
        noData: "No se encontraron datos.",
        active: "Activo",
        inactive: "Inactivo",
      }
    },
  };

  return texts[locale] || texts["pt-BR"];
};
