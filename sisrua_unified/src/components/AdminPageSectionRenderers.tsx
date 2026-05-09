/**
 * AdminPageSectionRenderers.tsx — Ponto de entrada para renderizadores do Painel Admin.
 * Modularizado para cumprir limites de Clean Code.
 */

export { renderSaude, renderDashboardMvs } from "./AdminPageRenderers/HealthRenderers";
export { renderUsuarios, renderPapeis } from "./AdminPageRenderers/UserRenderers";
export { renderTenants, renderQuotas, renderFlags } from "./AdminPageRenderers/TenantRenderers";
export { renderServicos } from "./AdminPageRenderers/ServiceRenderers";
export { renderRetencao, renderCapacidade, renderVulns, renderHoldings, renderClassificacao, renderKpis, renderFinOps } from "./AdminPageRenderers/OperationalRenderers";
