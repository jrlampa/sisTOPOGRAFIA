# 🗺️ sisRUA Unified — Strategic Roadmap 2026

## 🚀 Tier 1: Enterprise Go-Live (Q1-Q2)
*Foco: Estabilidade, Segurança, Performance e Conformidade Crítica.*

| Item | Descrição | Status |
| :--- | :--- | :--- |
| P3.1. | Acessibilidade Plena (WCAG 2.1) | ✅ Implementado |
| P3.2. | Aumento de Cobertura Crítica (20%) | ✅ Implementado |
| P3.3. | Baseline de Performance (Load Testing) | ✅ Implementado |
| P3.4. | Checklist Final de Produção | ✅ Implementado |
| 125. | Observabilidade de Negócio (KPIs) | ✅ Implementado |
| 126. | Gestão de Capacidade & Planning | ✅ Implementado |
| 127. | Gestão de Vulnerabilidades (CVSS) | ✅ Implementado |
| 128. | Classificação da Informação | ✅ Implementado |
| 129. | Modelo Multiempresa & Holding | ✅ Implementado |
| 130. | FinOps: Controle de Custo | ✅ Implementado |

## 📈 Tier 2: Expansão Regulatória e Escala (Q2-Q3)
*Foco: Diferenciação técnica, orçamentação e conformidade.*

| Item | Descrição | Status |
| :--- | :--- | :--- |
| 42. | **[T2] Integração SINAPI / ORSE Automática** | ✅ Implementado |
| 43. | **[T2] Análise de BDI e ROI Preditivo** | ✅ Implementado |
| 44. | **[T2] Simulador de TCO / Capex / Opex** | ✅ Implementado |
| 45. | **[T2] Relatório de Impacto Ambiental Automático** | ✅ Implementado |
| 60. | **[T2] Verificação NBR 9050 Automática** | ✅ Implementado |
| 61. | **[T2] Análise de Sombreamento 2.5D Automática** | ✅ Implementado |
| 46. | **[T2] Inventário de Vegetação Simulado** | ✅ Implementado |
| 107. | **[T2] Gestão de Servidões Fundiárias** | ✅ Implementado |
| 59. | [T2] Motor de Caminho de Menor Custo (LCP) | ✅ Implementado |
| 19. | [T2] Resiliência: Chaos Engineering | ✅ Implementado |

## 💎 Tier 3: Otimização Avançada e Realidade Aumentada (Q3-Q4)
*Foco: Design Generativo, IA e Produtividade de Campo.*

| Item | Descrição | Status |
| :--- | :--- | :--- |
| 131. | **[T3] Design Generativo (DG) Wizard Completo** | ✅ Implementado |
| 132. | **[T3] Integração com Realidade Aumentada (AR)** | 🧊 Ignorado Indeterminadamente |
| 133. | **[T3] Manutenção Preditiva baseada em IA (Ollama)** | ✅ Implementado |
| 134. | **[T3] Colaboração em Tempo Real (Multiplayer)** | ✅ Implementado |
| 135. | **[T3] Engine Modularity (RBAC & Performance)** | ✅ Implementado |
| 136. | **[T3] Portal & Dashboard de Engenharia** | ✅ Implementado |

---

## ✅ Double Check de Pontos Implementados (2026-05-09) — Tier 3 Expansion

| Ponto | Status | Evidência |
| :--- | :--- | :--- |
| 134. Colaboração Multiplayer | ✅ Implementado | `useMultiplayer.ts` e `collaboration_realtime.sql` |
| 135. **Modulariedade SaaS (Feature Flags)** | ✅ Implementado | `FeatureFlagContext.tsx` e `FeatureSettingsModal.tsx`. |
| 133. Manutenção Preditiva IA | ✅ Implementado | `predictiveMaintenanceService.ts` e `MaintenancePanel.tsx`. |
| 131. DG Wizard Completo | ✅ Implementado | `dgWizardT3.test.ts` e `DgWizardModal.tsx`. |
| 107. Gestão Fundiária | ✅ Implementado | `LandManagementService` e `POST /land/auto-detect` |
| 42. Orçamentação SINAPI | ✅ Implementado | `SinapiService.gerarOrcamentoAutomatico` |
| 43/44. FinOps e ROI | ✅ Implementado | `BudgetPanel.tsx` e `BdiRoiService` |
| 45/46. Ambiental e Vegetal | ✅ Implementado | `EsgAmbientalService` e `VegetacaoInventarioService` |
| 60/61. Urbano e Solar | ✅ Implementado | `Nbr9050Service` e `Sombreamento2D5Service` |

## 🏁 Workflow de Encerramento

Ao final de cada task:
1. Executar suite de testes: `npm run test:backend`
2. Verificar cobertura: `npm run test:coverage` (Mínimo 80%)
3. Realizar commit na branch `dev`.
4. Atualizar o RAG/MEMORY/CAC.md.
