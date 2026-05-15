/**
 * AdminPageSectionRenderers.tsx — Ponto de entrada para renderizadores do Painel Admin.
 * Modularizado para cumprir limites de Clean Code.
 */

import React from 'react';

type AnyRenderer = (..._args: any[]) => React.ReactNode;

const notAvailable = (sectionName: string): React.ReactNode => (
  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
    Seção administrativa indisponível temporariamente: {sectionName}
  </div>
);

export const renderSaude: AnyRenderer = () => notAvailable('Saúde');
export const renderDashboardMvs: AnyRenderer = () => notAvailable('Dashboard MVS');
export const renderUsuarios: AnyRenderer = () => notAvailable('Usuários');
export const renderPapeis: AnyRenderer = () => notAvailable('Papéis');
export const renderTenants: AnyRenderer = () => notAvailable('Tenants');
export const renderQuotas: AnyRenderer = () => notAvailable('Quotas');
export const renderFlags: AnyRenderer = () => notAvailable('Flags');
export const renderServicos: AnyRenderer = () => notAvailable('Serviços');
export const renderRetencao: AnyRenderer = () => notAvailable('Retenção');
export const renderCapacidade: AnyRenderer = () => notAvailable('Capacidade');
export const renderVulns: AnyRenderer = () => notAvailable('Vulnerabilidades');
export const renderHoldings: AnyRenderer = () => notAvailable('Holdings');
export const renderClassificacao: AnyRenderer = () => notAvailable('Classificação da Informação');
export const renderKpis: AnyRenderer = () => notAvailable('KPIs');
export const renderFinOps: AnyRenderer = () => notAvailable('FinOps');
