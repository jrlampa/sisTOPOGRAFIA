# Análise Completa de Todos os Arquivos — sisTOPOGRAFIA

> Data: 13/05/2026
> Total de arquivos analisados: ~2.200+ (excluindo node_modules, .git, caches e builds)

---

## Índice

1. [Raiz do Projeto](#1-raiz-do-projeto-sistopografia)
2. [sisrua_unified/ (Raiz)](#2-sisrua_unified-raiz)
3. [src/ — Frontend React](#3-src--frontend-react)
4. [server/ — Backend Node.js](#4-server--backend-nodejs)
5. [py_engine/ — Motor Python](#5-py_engine--motor-python)
6. [migrations/ — SQL](#6-migrations--sql)
7. [testes (e2e + tests)](#7-testes-e2e--tests)
8. [scripts/](#8-scripts)
9. [docs/](#9-docs)
10. [config/infra](#10-config--infra)
11. [arquivos residuais](#11-arquivos-residuais)

---

## 1. Raiz do Projeto (sisTOPOGRAFIA/)

### Arquivos de Configuração

| Arquivo | Finalidade |
|---------|------------|
| `.env` | Variáveis de ambiente para desenvolvimento local |
| `.gitattributes` | Regras do Git para terminações de linha e diff |
| `.gitignore` | Regras de ignore para o monorepo |
| `package.json` | Dependências Node.js raiz |
| `package-lock.json` | Lockfile das dependências raiz |

### Documentação e Auditoria

| Arquivo | Finalidade |
|---------|------------|
| `INDEX_MASTER.md` | Índice mestre da documentação de UI/UX |
| `ACTION_PLAN_IMPLEMENTATION.md` | Plano de ação para melhorias |
| `AUDITORIA_LEIA_ME.md` | Instruções para auditoria de qualidade |
| `AUDIT_REPORT_MAY_2026.md` | Relatório de auditoria (Maio/2026) |
| `DELIVERABLES_MANIFEST.md` | Manifesto de entregáveis do projeto |
| `DEVELOPER_REFERENCE_CARD.md` | Cartão de referência rápida para devs |
| `EXECUTIVE_SUMMARY.md` | Resumo executivo do projeto |
| `FRONTEND_CODEBASE_ANALYSIS.md` | Análise do codebase frontend |
| `README_AUDITORIA.md` | Leia-me da auditoria |
| `STORYBOOK_SETUP.md` | Configuração do Storybook |
| `UI_UX_IMPROVEMENT_DASHBOARD.md` | Dashboard de melhorias UI/UX |
| `UI_UX_IMPROVEMENT_STRATEGY.md` | Estratégia de melhorias UI/UX |
| `UI_UX_QUICK_START.md` | Guia rápido de UI/UX |

### Scripts

| Arquivo | Finalidade |
|---------|------------|
| `audit_file_sizes.js` | Auditoria de tamanhos de arquivos |
| `list_tree.py` | Gerador de árvore de diretórios |

### Dados

| Arquivo | Finalidade |
|---------|------------|
| `PADRE DECAMINADA-todos os pontos.kmz` | Dados geoespaciais de exemplo (KMZ) |

### Diretórios Ocultos

| Diretório | Conteúdo |
|-----------|----------|
| `.agents/rules/rules.md` | Regras do agente Cline |
| `.clinerules/non-negociaveis.md` | Regras não negociáveis do projeto |
| `.cursor/settings.json` | Configurações do Cursor IDE |
| `.vscode/mcp.json` | Configuração MCP do VS Code |
| `.vscode/settings.json` | Configurações do VS Code |
| `.vscode/tasks.json` | Tasks do VS Code |
| `.vite/vitest/results.json` | Resultados de teste do Vitest |
| `_tmp_kmz/` | Diretório temporário para arquivos KMZ |

### .github/ — Workflows CI/CD

| Arquivo | Finalidade |
|---------|------------|
| `DEPLOYMENT_SETUP.md` | Documentação de setup de deploy |
| `FUNDING.yml` | Configuração de funding do GitHub |
| `IAM_SETUP_REQUIRED.md` | Configuração IAM necessária |
| `MONITORING_WORKFLOWS.md` | Documentação de monitoramento |
| `QUICK_SETUP.md` | Setup rápido do projeto |
| `README.md` | README do diretório .github |
| `SECRETS_TEMPLATE.md` | Template de secrets |
| `WORKFLOWS_RESUMO.md` | Resumo dos workflows |
| `WORKFLOW_DIAGRAMA.md` | Diagrama dos workflows |
| `commands/gemini-*.toml` | 5 arquivos de comandos Gemini (invoke, plan-execute, review, triage, scheduled-triage) |
| `scripts/health-check.js` | Script de health check |
| `workflows/` | 13 workflows YAML: deploy-cloud-run, enforce-non-negotiables, gemini-*, health-check, post-deploy, pre-deploy, quality-gates, security-supply-chain, version-check |

### archive/ — Código Legado

| Estrutura | Conteúdo |
|-----------|----------|
| `db.js` | Cliente de banco de dados legado |
| `sisrua_unified - Copia/` | Cópia antiga do projeto (preservada para referência) |
| `py_engine/` | Motor Python antigo com domain/analysis, cad, engineering, hydrology, solar, terrain |
| `server/` | Servidor Express antigo com controllers, services, routes, public (HTML/JS/CSS) |
| `tests/` | Testes legados (Python: e2e_api, dxf_logic, hydrology, polygon, topography) |
| `scripts/` | Scripts legados (dxf_compliance_test, utm_validation) |

---

## 2. sisrua_unified/ (Raiz do Projeto Principal)

### Arquivos de Configuração

| Arquivo | Finalidade |
|---------|------------|
| `package.json` | Dependências Node.js do frontend + backend |
| `package-lock.json` | Lockfile |
| `tsconfig.json` | Configuração TypeScript principal |
| `tsconfig.node.json` | Config TS para Node |
| `tsconfig.server.json` | Config TS para o servidor |
| `vite.config.ts` | Configuração do Vite bundler |
| `vitest.config.ts` | Config principal do Vitest |
| `vitest.backend.config.ts` | Config do Vitest para backend |
| `vitest.integration.config.ts` | Config do Vitest para testes de integração |
| `vitest.risk.config.ts` | Config do Vitest para testes de risco |
| `postcss.config.js` | Config do PostCSS/Tailwind |
| `tailwind.config.js` | Config do Tailwind CSS |
| `.eslintrc.cjs` | Config do ESLint |
| `.prettierrc.json` | Config do Prettier |
| `.prettierignore` | Ignore do Prettier |
| `.gitignore` | Git ignore |
| `.gitattributes` | Git attributes |
| `.dockerignore` | Docker ignore |
| `.env` | Variáveis de ambiente (local) |
| `.env.example` | Exemplo de env |
| `.env.local.example` | Exemplo de env local |
| `.env.secrets` | Secrets de ambiente |
| `.env.supabase` | Config Supabase |
| `.gitleaks.toml` | Config do Gitleaks (security scanning) |
| `.bandit` | Config do Bandit (segurança Python) |

### Docker

| Arquivo | Finalidade |
|---------|------------|
| `Dockerfile` | Dockerfile de produção |
| `Dockerfile.dev` | Dockerfile de desenvolvimento |
| `Dockerfile.dev.optimized` | Dockerfile dev otimizado |
| `Dockerfile.prod` | Dockerfile produção alternativo |
| `docker-compose.yml` | Docker Compose principal |
| `docker-compose.dev.yml` | Docker Compose dev |
| `docker-compose.prod.yml` | Docker Compose produção |
| `docker-entrypoint.sh` | Entrypoint do container |
| `healthcheck.sh` | Health check do container |

### Documentação Raiz

| Arquivo | Finalidade |
|---------|------------|
| `README.md` | README principal |
| `README_LOCAL.md` | README para setup local |
| `ARCHITECTURE.md` | Documentação de arquitetura |
| `CHANGELOG.md` | Histórico de mudanças |
| `CLAUDE.md` | Instruções para Claude/Cline |
| `PROJECT_BRIEF.md` | Briefing do projeto |
| `ROADMAP.md` | Roadmap do projeto |
| `UX_DESIGN_SYSTEM.md` | Sistema de design UX |
| `FEATURE_FLAGS_BY_TIER.md` | Feature flags por tier |
| `FINOPS_STRIPE_VALUATION.md` | Valuation FinOps/Stripe |
| `FRONTEND_AUDIT_REPORT.md` | Relatório de auditoria frontend |
| `FRONTEND_CHECKLIST.md` | Checklist frontend |
| `FRONTEND_IMPLEMENTATION_PHASE1.md` | Implementação fase 1 |
| `FRONTEND_SUMMARY.md` | Sumário frontend |
| `SECURITY_AUDIT.md` | Auditoria de segurança |
| `STRIPE_IMPLEMENTATION_SUMMARY.md` | Sumário Stripe |
| `STRIPE_QUICKSTART.md` | Quickstart Stripe |

### Outros Arquivos Raiz

| Arquivo | Finalidade |
|---------|------------|
| `index.html` | HTML entrypoint do Vite |
| `VERSION` | Versão atual do projeto |
| `metadata.json` | Metadados do projeto |
| `lighthouserc.json` | Config do Lighthouse CI |
| `test.dxf` | Arquivo DXF de teste |
| `test.kml` | Arquivo KML de teste |
| `test_empty.dxf` | DXF vazio de teste |
| `test_full_metadata.csv` | CSV de metadados completo |
| `test_metadata.csv` | CSV de metadados |
| `test-metrics.config.json` | Config de métricas de teste |
| `pytest.ini` | Config do Pytest |
| `playwright.config.ts` | Config do Playwright |
| `playwright.a11y.config.ts` | Config de acessibilidade Playwright |
| `playwright.release-smoke.config.ts` | Config de smoke test Playwright |
| `apply_migrations.py` | Script para aplicar migrations |
| `apply_partitioning.py` | Script para aplicar particionamento |
| `apply_perf_migrations.py` | Script para migrations de performance |
| `setup-secrets.sh` | Script de setup de secrets |
| `setup-docker-secrets.sh` | Script de setup de secrets Docker |
| `start-dev.ps1` | Script de início dev (PowerShell) |
| `db.js` | Cliente de banco legado |
| `dg-result-visual.geojson` | Resultado DG GeoJSON |

### Logs e Depuração

| Arquivo | Finalidade |
|---------|------------|
| `.act-quality.log` | Log de qualidade do ACT |
| `dep-check-full.log` | Log completo de dependências |
| `dep-check-single.log` | Log individual de dependência |
| `dep-trace.log` | Trace de dependências |
| `docker-build.log` | Log de build Docker |
| `.coverage` | Dados de cobertura |

---

## 3. src/ — Frontend React (229 arquivos)

### Raiz (8 arquivos)

| Arquivo | Finalidade |
|---------|------------|
| `index.tsx` | Entry point da SPA React |
| `index.css` | Estilos globais Tailwind |
| `vite-env.d.ts` | Tipagens Vite |
| `App.tsx` | Componente raiz do editor fullscreen |
| `router.tsx` | Roteador SPA (Landing, Portal, Editor, Admin) |
| `constants.ts` | Constantes globais do frontend |
| `types.ts` | Tipagens genéricas do frontend |
| `types.map.ts` | Tipagens específicas do mapa |
| `types.canonical.ts` | Tipagens da topologia canônica |

### components/ — Componentes React (78 arquivos)

| Componente | Finalidade |
|------------|-----------|
| `AdminPageLegacy.tsx` | Página admin legada |
| `AdminPagePrimitives.tsx` | Primitivos da página admin |
| `AdminPageSectionRenderers.tsx` | Renderizadores de seção admin |
| `AppHeader.tsx` | Header principal do app |
| `AppNavigation.tsx` | Navegação principal |
| `AppSettingsOverlay.tsx` | Overlay de configurações |
| `AppShellLayout.tsx` | Layout shell do app |
| `AppStatusStack.tsx` | Pilha de status do app |
| `AppWorkspace.tsx` | Workspace principal do editor |
| `AutoSaveIndicator.tsx` | Indicador de salvamento automático |
| `BatchUpload.tsx` | Upload em lote |
| `BimInspectorDrawer.tsx` | Drawer de inspeção BIM |
| `Breadcrumb.tsx` | Navegação breadcrumb |
| `BtExportSummaryBanner.tsx` | Banner de sumário de exportação BT |
| `BtModals.tsx` | Modais BT |
| `BtModalStack.tsx` | Pilha de modais BT |
| `BtTelescopicSuggestionModal.tsx` | Modal de sugestão telescópica BT |
| `BtTopologyPanel.tsx` | Painel de topologia BT |
| `BtViolationJumpList.tsx` | Lista de violações BT |
| `BudgetPanel.tsx` | Painel de orçamento |
| `CommandPalette.tsx` | Paleta de comandos |
| `CompliancePanel.tsx` | Painel de conformidade |
| `ConfirmationModal.tsx` | Modal de confirmação genérico |
| `ConstantsCatalogOps.tsx` | Operações do catálogo de constantes |
| `CqtHeatmapLegend.tsx` | Legenda do heatmap CQT |
| `Dashboard.tsx` | Dashboard principal |
| `DgOptimizationPanel.tsx` | Painel de otimização DG |
| `DgWizardModal.tsx` | Modal wizard DG |
| `DxfLegend.tsx` | Legenda DXF |
| `DxfProgressBadge.tsx` | Badge de progresso DXF |
| `ElectricalAuditDrawer.tsx` | Drawer de auditoria elétrica |
| `ElevationProfile.tsx` | Perfil de elevação |
| `EmptyStateMapOverlay.tsx` | Overlay de mapa vazio |
| `ErrorBoundary.tsx` | Boundary de erro |
| `FeatureSettingsModal.tsx` | Modal de configurações de feature |
| `FloatingLayerPanel.tsx` | Painel de camada flutuante |
| `FormFieldFeedback.tsx` | Feedback de campo de formulário |
| `GuidedTaskChecklist.tsx` | Checklist de tarefa guiada |
| `HelpModal.tsx` | Modal de ajuda |
| `HistoryControls.tsx` | Controles de histórico |
| `JurisdictionStatus.tsx` | Status de jurisdição |
| `LandingDraftPage.tsx` | Rascunho da landing page |
| `LcpPanel.tsx` | Painel LCP |
| `MainMapWorkspace.tsx` | Workspace do mapa principal |
| `MaintenancePanel.tsx` | Painel de manutenção |
| `MapPreview.tsx` | Prévia do mapa |
| `MapSelector.tsx` | Seletor de mapa |
| `MapSelectorEdgesLayer.tsx` | Camada de arestas no seletor |
| `MapSelectorSelectionManager.tsx` | Gerenciador de seleção |
| `MapSelectorStyles.ts` | Estilos do seletor de mapa |
| `MtRouterPanel.tsx` | Painel de roteamento MT |
| `MtTopologyPanel.tsx` | Painel de topologia MT |
| `MultiplayerAvatars.tsx` | Avatares multiplayer |
| `NewProjectModal.tsx` | Modal de novo projeto |
| `PageShell.tsx` | Shell de página |
| `PortalLayout.tsx` | Layout do portal |
| `ProgressIndicator.tsx` | Indicador de progresso |
| `SessionRecoveryBanner.tsx` | Banner de recuperação de sessão |
| `SettingsModal.tsx` | Modal de configurações |
| `SidebarAnalysisResults.tsx` | Resultados de análise na sidebar |
| `SidebarBtEditorSection.tsx` | Seção do editor BT na sidebar |
| `SidebarBulkEditSection.tsx` | Seção de edição em lote |
| `SidebarMtEditorSection.tsx` | Seção do editor MT |
| `SidebarSelectionControls.tsx` | Controles de seleção |
| `SidebarWorkspace.tsx` | Workspace da sidebar |
| `Skeleton.tsx` | Componente Skeleton de loading |
| `SnapshotModal.tsx` | Modal de snapshot |
| `Toast.tsx` | Componente de notificação Toast |

#### Subcomponentes Agrupados

| Diretório | Arquivos | Finalidade |
|-----------|----------|------------|
| `AdminPage/` | `AdminPage.tsx`, `AdminServiceTiers.tsx`, `AdminSettings.tsx` | Página admin modular |
| `AdminPageRenderers/` | 5 renderizadores (Health, Operational, Service, Tenant, User) | Renderização admin |
| `BtTopologyPanel/` | 15 arquivos (contexto, subseções, modal de importação, stats, dashboard, cockpits, hooks) | Painel BT completo |
| `forms/` | `FormGroup.tsx`, `NumberInput.tsx`, `SelectInput.tsx` | Componentes de formulário |
| `landing/` | 8 componentes (Atmosphere, Auth, Data, Faq, Features, Footer, Header, Hero, Pricing) | Landing page |
| `MapLayers/` | 10 camadas (GhostEdge, Interaction, Jurisdiction, MtRouter, DgOverlay, MtEdges, MtPoles, Poles, Transformers) | Camadas do mapa Leaflet |
| `MtTopologyPanel/` | 2 componentes (EdgeVerification, PoleVerification) | Painel MT |
| `settings/` | 3 componentes (ExportFooter, GeneralTab, ProjectTab) | Abas de configurações |
| `ui/` | 12 componentes atômicos (Button, ConfirmDialog, Drawer, EmptyState, ErrorAlert, FormError, Input, LoadingSpinner, ProgressBar, SkeletonLoader, index.ts) | Design system atômico |

### pages/ — Páginas (9 arquivos)

| Arquivo | Finalidade |
|---------|------------|
| `AjudaPage.tsx` | Página de ajuda |
| `DashboardPage.tsx` | Página de dashboard |
| `LandingPage.tsx` | Landing page (marketing) |
| `NotFoundPage.tsx` | Página 404 |
| `ProjectPage.tsx` | Página de projeto |
| `SaaSAdminPage.tsx` | Página de admin SaaS |
| `StatusPage.tsx` | Página de status do sistema |
| `SuperAdminDashboard.tsx` | Dashboard de super admin |
| `TeamPage.tsx` | Página de time |

### hooks/ — Custom Hooks (37 arquivos)

| Hook | Finalidade |
|------|------------|
| `useABTest.ts` | Teste A/B |
| `useAdminForm.ts` | Formulário admin |
| `useAppAnalysisWorkflow.ts` | Workflow de análise |
| `useAppBimInspector.ts` | Inspetor BIM |
| `useAppCommandPalette.ts` | Paleta de comandos |
| `useAppElectricalAudit.ts` | Auditoria elétrica |
| `useAppEngineeringWorkflows.ts` | Workflows de engenharia |
| `useAppGlobalHotkeys.ts` | Atalhos globais |
| `useAppHooks.ts` | Agregador de hooks do app |
| `useAppInspectedElement.ts` | Elemento inspecionado |
| `useAppLifecycleEffects.ts` | Efeitos de ciclo de vida |
| `useAppMainHandlers.ts` | Handlers principais |
| `useAppMapSelectorProps.ts` | Props do seletor de mapa |
| `useAppOrchestrator.ts` | Orquestrador do app |
| `useAppSidebarProps.ts` | Props da sidebar |
| `useAppTopologySources.ts` | Fontes de topologia |
| `useAriaAnnounce.ts` | Anúncio ARIA para acessibilidade |
| `useAutoSave.ts` | Salvamento automático |
| `useBackendHealth.ts` | Health do backend |
| `useBtCriticalConfirmations.ts` | Confirmações críticas BT |
| `useBtCrudHandlers.ts` | Handlers CRUD BT |
| `useBtDerivedState.ts` | Estado derivado BT |
| `useBtDxfWorkflow.ts` | Workflow DXF BT |
| `useBtEdgeOperations.ts` | Operações de aresta BT |
| `useBtExportHistory.ts` | Histórico de exportação BT |
| `useBtNavigationState.ts` | Estado de navegação BT |
| `useBtPoleClandestinoHandlers.ts` | Handlers de poste clandestino |
| `useBtPoleOperations.ts` | Operações de poste BT |
| `useBtTelescopicAnalysis.ts` | Análise telescópica BT |
| `useBtTopologySelection.ts` | Seleção de topologia BT |
| `useBtTopologyUpdaters.ts` | Atualizadores de topologia BT |
| `useBtTransformerOperations.ts` | Operações de transformador BT |
| `useBudget.ts` | Orçamento |
| `useCompliance.ts` | Conformidade |
| `useDgOptimization.ts` | Otimização DG |
| `useDxfExport.ts` | Exportação DXF |
| `useElevationProfile.ts` | Perfil de elevação |
| `useFileOperations.ts` | Operações de arquivo |
| `useFocusTrap.ts` | Focus trap para acessibilidade |
| `useKeyboardShortcuts.ts` | Atalhos de teclado |
| `useKmlImport.ts` | Importação KML |
| `useLcp.ts` | LCP (Least Cost Path) |
| `useMapState.ts` | Estado do mapa |
| `useMapUrlState.ts` | Estado do mapa na URL |
| `useMemoizedDistance.ts` | Distância memoizada |
| `useMtCrudHandlers.ts` | CRUD handlers MT |
| `useMtEdgeOperations.ts` | Operações de aresta MT |
| `useMtPoleOperations.ts` | Operações de poste MT |
| `useMtRouter.ts` | Roteador MT |
| `useMultiplayer.ts` | Multiplayer/colaboração |
| `useNeighborhoodAwareness.ts` | Consciência de vizinhança |
| `useOsmEngine.ts` | Motor OSM |
| `usePagination.tsx` | Paginação |
| `useProjectDataWorkflow.ts` | Workflow de dados do projeto |
| `useSearch.ts` | Busca |
| `useTelescopicRemediation.ts` | Remediação telescópica |
| `useToast.tsx` | Toast de notificação |
| `useUndoRedo.ts` | Desfazer/refazer |

### services/ — Serviços Frontend (10 arquivos)

| Serviço | Finalidade |
|---------|------------|
| `apiClient.ts` | Cliente HTTP centralizado |
| `btDerivedService.ts` | Serviço de operações BT derivadas |
| `btExportHistoryService.ts` | Histórico de exportação BT |
| `constantsCatalogService.ts` | Catálogo de constantes |
| `dxfService.ts` | Geração DXF |
| `elevationService.ts` | Dados de elevação |
| `geminiService.ts` | Integração Gemini AI |
| `osmService.ts` | Dados OpenStreetMap |
| `projectService.ts` | CRUD de projetos |
| `spatialJurisdictionService.ts` | Jurisdição espacial |

### utils/ — Utilitários (26 arquivos)

| Utilitário | Finalidade |
|------------|------------|
| `a11y.ts` | Utilitários de acessibilidade |
| `analytics.ts` | Analytics/PostHog |
| `btCalculations.ts` | Cálculos BT |
| `btClandestinoCalculations.ts` | Cálculos de clandestino BT |
| `btDxfContext.ts` | Contexto DXF BT |
| `btNormalization.ts` | Normalização BT |
| `btPoleProjectTypeUtils.ts` | Tipo de projeto de poste |
| `btTopologyFlow.ts` | Fluxo de topologia BT |
| `btTransformerCalculations.ts` | Cálculos de transformador |
| `btTransformerConflicts.ts` | Conflitos de transformador |
| `cn.ts` | Utilitário classnames (Tailwind) |
| `debounce.ts` | Debounce |
| `dgSemanticFeedback.ts` | Feedback semântico DG |
| `downloads.ts` | Download de arquivos |
| `geo.ts` | Utilitários geoespaciais |
| `geometriaUtils.ts` | Utilitários de geometria |
| `gridReadability.ts` | Legibilidade do grid |
| `idGenerator.ts` | Gerador de IDs |
| `immutability.ts` | Imutabilidade |
| `kmlParser.ts` | Parser KML |
| `lazyWithRetry.ts` | Lazy loading com retry |
| `logger.ts` | Logger |
| `memorialDescritivo.ts` | Memorial descritivo |
| `mtDxfContext.ts` | Contexto DXF MT |
| `mtNormalization.ts` | Normalização MT |
| `mtTopologyBridge.ts` | Bridge de topologia MT |
| `numericFormatting.ts` | Formatação numérica |
| `numericValidation.ts` | Validação numérica |
| `preferencesPersistence.ts` | Persistência de preferências |
| `sanitization.ts` | Sanitização de dados |
| `selectMapTopologyRenderSources.ts` | Seleção de fontes de renderização |
| `smartSnapping.ts` | Snap inteligente |
| `synchronizeGlobalTopologyState.ts` | Sincronização de estado global |
| `validation.ts` | Validação |

### i18n/ — Internacionalização (13 arquivos)

| Arquivo | Finalidade |
|---------|------------|
| `index.ts` | Agregador de textos |
| `adminText.ts` | Textos admin |
| `appHeaderText.ts` | Textos do header |
| `appLocale.ts` | Config de locale |
| `btTopologyPanelText.ts` | Textos do painel BT |
| `budgetText.ts` | Textos de orçamento |
| `commandPaletteText.ts` | Textos da paleta |
| `complianceText.ts` | Textos de compliance |
| `dxfProgressText.ts` | Textos de progresso DXF |
| `electricalAuditDrawerText.ts` | Textos de auditoria elétrica |
| `guidedTaskChecklistText.ts` | Textos de checklist guiada |
| `helpModalText.ts` | Textos de ajuda |
| `landingPageText.ts` | Textos da landing page |
| `lcpText.ts` | Textos LCP |
| `mainMapWorkspaceText.ts` | Textos do workspace de mapa |
| `mtRouterText.ts` | Textos do roteador MT |
| `mtTopologyPanelText.ts` | Textos do painel MT |
| `selectionManagerText.ts` | Textos do gerenciador de seleção |
| `settingsModalText.ts` | Textos de configurações |
| `sidebarAnalysisText.ts` | Textos de análise |
| `sidebarBtEditorText.ts` | Textos do editor BT |
| `sidebarMtEditorText.ts` | Textos do editor MT |
| `sidebarSelectionText.ts` | Textos de seleção |
| `sidebarWorkspaceText.ts` | Textos do workspace |
| `utilsText.ts` | Textos utilitários |
| `locales/pt-BR.json` | Tradução pt-BR |
| `locales/en-US.json` | Tradução en-US |
| `locales/es-ES.json` | Tradução es-ES |

### Outros Diretórios src/

| Diretório | Arquivos | Finalidade |
|-----------|----------|------------|
| `config/` | `api.ts`, `featureFlags.ts`, `version.ts` | Configurações do frontend |
| `constants/` | 6 constantes (physical, clandestino, workbook, magicNumbers, mtStructure) | Constantes de engenharia |
| `context/` | `BtContext.tsx` | Contexto BT |
| `contexts/` | `FeatureFlagContext.tsx` | Contexto de feature flags |
| `theme/` | 4 arquivos (btTopologyTheme, motion, ThemeProvider, tokens) | Sistema de tema |
| `types/` | 3 arquivos (featureFlags, index, supabase) | Tipagens compartilhadas |
| `lib/` | `supabaseClient.ts` | Cliente Supabase |
| `adapters/` | `canonicalTopologyAdapter.ts` | Adaptador de topologia canônica |
| `app/` | `initialState.ts` | Estado inicial do app |
| `auth/` | `AuthProvider.tsx`, `authSession.ts` | Provedor de autenticação |

---

## 4. server/ — Backend Node.js (201+ arquivos)

### Raiz (6 arquivos)

| Arquivo | Finalidade |
|---------|------------|
| `app.ts` | Bootstrap do Express (middleware + rotas) |
| `config.ts` | Config validator com Zod |
| `index.ts` | Entrypoint do servidor |
| `errorHandler.ts` | Handler centralizado de erros (ApiError) |
| `pythonBridge.ts` | Ponte para execução do motor Python |
| `shutdown.ts` | Graceful shutdown |
| `swagger.ts` | Configuração Swagger/OpenAPI |

### routes/ — Rotas Express (96 arquivos)

Rotas organizadas por domínio:

| Rota | Finalidade |
|------|------------|
| `academyRoutes.ts` | Academia/cursos |
| `acervoGedRoutes.ts` | Acervo GED |
| `adminRoutes.ts` | Administração |
| `analysisRoutes.ts` | Análise topográfica |
| `asBuiltMobileRoutes.ts` | As-built mobile |
| `assinaturaNuvemRoutes.ts` | Assinatura em nuvem |
| `auditColdStorageRoutes.ts` | Auditoria cold storage |
| `auditRoutes.ts` | Auditoria |
| `authRoutes.ts` | Autenticação |
| `bcpDrRoutes.ts` | BCP/DR |
| `bdgdRoutes.ts` | BDGD |
| `bdiRoiRoutes.ts` | BDI/ROI |
| `billingRoutes.ts` | Faturamento Stripe |
| `blueGreenRoutes.ts` | Blue-green deploy |
| `btBulkImportRoutes.ts` | Importação em lote BT |
| `btCalculationRoutes.ts` | Cálculos BT |
| `btDerivedRoutes.ts` | Derivados BT |
| `btHistoryRoutes.ts` | Histórico BT |
| `businessKpiRoutes.ts` | KPIs de negócio |
| `capacityPlanningRoutes.ts` | Planejamento de capacidade |
| `changeManagementRoutes.ts` | Gerenciamento de mudanças |
| `chaosRoutes.ts` | Chaos engineering |
| `complianceRoutes.ts` | Conformidade |
| `constantsRoutes.ts` | Catálogo de constantes |
| `contractualSlaRoutes.ts` | SLAs contratuais |
| `corporateHardeningRoutes.ts` | Hardening corporativo |
| `costCenterRoutes.ts` | Centros de custo |
| `creditosCarbonoRoutes.ts` | Créditos de carbono |
| `dataRetentionRoutes.ts` | Retenção de dados |
| `dgBufferValidationRoutes.ts` | Validação de buffer DG |
| `dgRoutes.ts` | Roteamento DG |
| `dossieRoutes.ts` | Dossiê regulatório |
| `dxfRoutes.ts` | Geração DXF |
| `edicaoColaborativaRoutes.ts` | Edição colaborativa |
| `eivRoutes.ts` | EIV |
| `elevationRoutes.ts` | Dados de elevação |
| `encryptionAtRestRoutes.ts` | Criptografia em repouso |
| `enterpriseOnboardingRoutes.ts` | Onboarding enterprise |
| `enterpriseReadinessRoutes.ts` | Readiness enterprise |
| `environmentPromotionRoutes.ts` | Promoção de ambiente |
| `esgAmbientalRoutes.ts` | ESG ambiental |
| `esgSustentabilidadeRoutes.ts` | ESG sustentabilidade |
| `expansaoCargasRoutes.ts` | Expansão de cargas |
| `featureFlagRoutes.ts` | Feature flags |
| `finOpsRoutes.ts` | FinOps |
| `firestoreRoutes.ts` | Firestore |
| `formulaVersioningRoutes.ts` | Versionamento de fórmulas |
| `gisHardeningRoutes.ts` | Hardening GIS |
| `gridLegibilityRoutes.ts` | Legibilidade do grid |
| `holdingRoutes.ts` | Holding |
| `hybridCloudRoutes.ts` | Cloud híbrida |
| `ibgeRoutes.ts` | IBGE |
| `identityLifecycleRoutes.ts` | Ciclo de vida de identidade |
| `indeRoutes.ts` | INDE |
| `infoClassificationRoutes.ts` | Classificação da informação |
| `investorAuditRoutes.ts` | Auditoria de investidores |
| `jobIdempotencyRoutes.ts` | Idempotência de jobs |
| `jobRoutes.ts` | Jobs |
| `knowledgeBaseRoutes.ts` | Base de conhecimento |
| `lccFamiliaRoutes.ts` | LCC família |
| `lccRoutes.ts` | LCC |
| `lcpRoutes.ts` | LCP |
| `lgpdResidenciaRoutes.ts` | LGPD residência |
| `lgpdRetencaoRoutes.ts` | LGPD retenção |
| `lgpdRoutes.ts` | LGPD |
| `licencaSocialRoutes.ts` | Licença social |
| `licitacoesRoutes.ts` | Licitações |
| `maintenanceRoutes.ts` | Manutenção |
| `mechanicalAndAnalysisRoutes.ts` | Análise mecânica |
| `medicaoPagamentoRoutes.ts` | Medição e pagamento |
| `metricsRoutes.ts` | Métricas |
| `modelRetrocompatRoutes.ts` | Retrocompatibilidade |
| `multiTenantIsolationRoutes.ts` | Isolamento multi-tenant |
| `nbr9050Routes.ts` | NBR 9050 (acessibilidade) |
| `nbrCalcadasRoutes.ts` | NBR calçadas |
| `ollamaGovernanceRoutes.ts` | Governança Ollama |
| `onPremiseRoutes.ts` | On-premise |
| `operationalRunbookRoutes.ts` | Runbooks operacionais |
| `opsRoutes.ts` | Operações |
| `osmRoutes.ts` | OpenStreetMap |
| `pentestRoutes.ts` | Pentest |
| `perdasNaoTecnicasRoutes.ts` | Perdas não técnicas |
| `portalStakeholderRoutes.ts` | Portal stakeholder |
| `predictiveMaintenanceRoutes.ts` | Manutenção preditiva |
| `predictiveObservabilityRoutes.ts` | Observabilidade preditiva |
| `produtividadeTerritorialRoutes.ts` | Produtividade territorial |
| `provenienciaForenseRoutes.ts` | Proveniência forense |
| `qrRastreabilidadeRoutes.ts` | QR rastreabilidade |
| `quotaRoutes.ts` | Quotas |
| `rastreabilidadeRoutes.ts` | Rastreabilidade |
| `releaseCabRoutes.ts` | Release CAB |
| `releaseIntegrityRoutes.ts` | Integridade de release |
| `remuneracaoRegulatoriaRoutes.ts` | Remuneração regulatória |
| `rfpReadinessRoutes.ts` | RFP readiness |
| `searchRoutes.ts` | Busca |
| `serviceDeskRoutes.ts` | Service desk |
| `servidoesFundiariasIncraRoutes.ts` | Servidões fundiárias INCRA |
| `servidoesFundiariosRoutes.ts` | Servidões fundiárias |
| `sinapiRoutes.ts` | SINAPI |
| `sombreamento2D5Routes.ts` | Sombreamento 2.5D |
| `speedDraftRoutes.ts` | Speed draft |
| `sreRoutes.ts` | SRE |
| `storageRoutes.ts` | Storage |
| `supplyChainRoutes.ts` | Supply chain |
| `tcoCapexOpexRoutes.ts` | TCO Capex/Opex |
| `teleEngenhariaArRoutes.ts` | Tele-engenharia AR |
| `tenantAuditExportRoutes.ts` | Exportação de auditoria tenant |
| `vegetacaoInventarioRoutes.ts` | Inventário de vegetação |
| `vulnManagementRoutes.ts` | Gerenciamento de vulnerabilidades |
| `zeroTrustRoutes.ts` | Zero Trust |

### services/ — Serviços (76 arquivos)

Inclui serviços para todos os domínios acima, mais serviços especializados:

| Serviço Destacado | Finalidade |
|-------------------|------------|
| `dxfEngine.ts` | Motor de geração DXF |
| `cqtEngine.ts` | Motor CQT (Comparação de Tabelas de Cálculo) |
| `dxfService.ts` | Serviço de DXF |
| `elevationService.ts` | Dados de elevação (SRTM/Topodata) |
| `geocodingService.ts` | Geocodificação |
| `stripeService.ts` | Integração Stripe |
| `supabaseAdminService.ts` | Admin Supabase |
| `topodataService.ts` | Dados Topodata |
| `topologicalValidator.ts` | Validador topológico |
| `cloudTasksService.ts` | Cloud Tasks GCP |
| `batchService.ts` | Processamento em lote |
| `bt/` | 12 serviços BT (Accessibility, Catalog, Demand, Derived, Graph, Mechanical, Radial, Voltage, etc.) |
| `dg/` | 9 serviços DG (Candidates, Constraints, Cuts, Eccentricity, MST, MtRouter, Objective, Optimizer, Partitioner) + kmzPreprocessing + lcp |

### middleware/ — Middleware (9 arquivos)

| Middleware | Finalidade |
|------------|------------|
| `authGuard.ts` | Guard de autenticação JWT |
| `monitoring.ts` | Monitoramento de requisições |
| `permissionHandler.ts` | Controle de permissões RBAC |
| `rateLimiter.ts` | Rate limiting |
| `requestMetrics.ts` | Métricas de requisição |
| `schemaValidator.ts` | Validação de schema Zod |
| `validation-enhanced.ts` | Validação aprimorada |
| `validation.ts` | Validação base |
| `writeAuthPolicy.ts` | Política de escrita autorizada |

### repositories/ — Repositórios (11 arquivos)

| Repositório | Finalidade |
|-------------|------------|
| `dbClient.ts` | Cliente de banco de dados |
| `btExportHistoryRepository.ts` | Histórico de exportação BT |
| `canonicalTopologyRepository.ts` | Topologia canônica |
| `dgRunRepository.ts` | Execuções DG |
| `dxfTaskRepository.ts` | Tasks DXF |
| `jobRepository.ts` | Jobs |
| `maintenanceRepository.ts` | Manutenção |
| `roleRepository.ts` | Papéis RBAC |
| `index.ts` | Barrel export |

### Outros Diretórios server/

| Diretório | Arquivos | Finalidade |
|-----------|----------|------------|
| `constants/` | `bdgdAneel.ts`, `cqtBaselineTargets.ts`, `cqtLookupTables.ts` | Constantes do backend |
| `core/mechanicalCalc/` | `posteCalc.ts`, `types.ts` | Cálculo mecânico de postes |
| `schemas/` | `apiSchemas.ts`, `dgBufferValidation.ts`, `dxfRequest.ts` | Schemas Zod |
| `seeds/` | 3 SQLs de seed (cqt_lookup, clandestino_rules, config_constants) | Dados iniciais |
| `swagger/` | 3 arquivos (components, definition, paths) | Documentação OpenAPI |
| `standards/` | `br.ts`, `index.ts`, `types.ts` | Padrões/normas brasileiras |
| `tests/` | 200+ arquivos de teste | Testes unitários e de integração |
| `tests/chaosEngine/` | `faultInjector.ts` | Injeção de falhas |
| `tests/fixtures/` | `cqtParityWorkbookFixture.ts` | Fixtures de teste |
| `utils/` | 14 utilitários (artifactProvenance, bearerAuth, cache, circuitBreaker, correlationIds, dxfDirectory, externalApi, listing, logger, readSecret, requestContext, sanitizer, schemaValidator, webhookNotifier) | Utilitários backend |

---

## 5. py_engine/ — Motor Python (47 arquivos)

### Raiz

| Arquivo | Finalidade |
|---------|------------|
| `main.py` | Entrypoint do motor Python |
| `controller.py` | Controlador principal |
| `dxf_generator.py` | Gerador DXF principal |
| `dxf_bt_mixin.py` | Mixin BT para DXF |
| `dxf_geometry_mixin.py` | Mixin de geometria DXF |
| `dxf_labels_mixin.py` | Mixin de labels DXF |
| `dxf_layout_mixin.py` | Mixin de layout DXF |
| `dxf_styles.py` | Estilos DXF |
| `contour_generator.py` | Gerador de curvas de nível |
| `elevation_client.py` | Cliente de dados de elevação |
| `topodata_reader.py` | Leitor de dados Topodata |
| `osmnx_client.py` | Cliente OSMnx (OpenStreetMap) |
| `constants.py` | Constantes do motor |
| `spatial_audit.py` | Auditoria espacial |
| `verify_polygon.py` | Verificação de polígonos |
| `verify_supabase_and_dxf.py` | Verificação Supabase + DXF |
| `warmup_topodata_cache.py` | Warmup de cache Topodata |
| `live_test_generator.py` | Gerador de teste ao vivo |
| `reproduce_dxf_error.py` | Reprodução de erro DXF |
| `create_demo_dxf.py` | Criação de DXF demo |
| `generate_dxf.py` | Geração DXF simplificada |
| `debug_import.py` | Debug de importações |
| `debug_integration.py` | Debug de integração |
| `debug_labels.py` | Debug de labels |
| `requirements.txt` | Dependências Python |
| `__init__.py` | Init do pacote |

### domain/ — Domínios (6 arquivos)

| Arquivo | Finalidade |
|---------|------------|
| `annotation_drawer.py` | Desenho de anotações |
| `bt_drawer.py` | Desenho BT |
| `drawing_context.py` | Contexto de desenho |
| `geometry_drawer.py` | Desenho de geometria |
| `terrain_drawer.py` | Desenho de terreno |
| `__init__.py` | Init |

### dxf/ — Geração DXF (6 arquivos)

| Arquivo | Finalidade |
|---------|------------|
| `generator.py` | Gerador DXF |
| `__init__.py` | Init |
| `core/apresentacao.py` | Apresentação DXF |
| `core/bt_topologia.py` | Topologia BT DXF |
| `core/geometria.py` | Geometria DXF |
| `core/geometria_utils.py` | Utilitários de geometria DXF |
| `core/mt_topologia.py` | Topologia MT DXF |

### tests/ — Testes Python (14 arquivos)

| Teste | Finalidade |
|-------|------------|
| `test_contour_generator.py` | Teste do gerador de curvas |
| `test_controller.py` | Teste do controlador |
| `test_dxf_generator.py` | Teste do gerador DXF |
| `test_dxf_hardening.py` | Teste de hardening DXF |
| `test_elevation.py` | Teste de elevação |
| `test_elevation_robust.py` | Teste robusto de elevação |
| `test_geometria.py` | Teste de geometria |
| `test_infra.py` | Teste de infraestrutura |
| `test_main.py` | Teste do main |
| `test_offsets.py` | Teste de offsets |
| `test_osmnx_client.py` | Teste do cliente OSMnx |
| `test_schema_validator.py` | Teste do validador de schema |
| `test_smart_labels.py` | Teste de labels inteligentes |
| `test_spatial_audit.py` | Teste de auditoria espacial |

### utils/ — Utilitários Python

| Arquivo | Finalidade |
|---------|------------|
| `geo.py` | Utilitários geoespaciais |
| `logger.py` | Logger |
| `schema_validator.py` | Validador de schema |

### cache/ — Cache de Dados

27 arquivos JSON de cache de dados geoespaciais (elevação, topodata)

### assets/

| Arquivo | Finalidade |
|---------|------------|
| `legado.db` | Banco SQLite legado |

---

## 6. migrations/ — SQL (81 arquivos)

Migrations organizadas numericamente de `001` a `100`:

| Faixa | Finalidade |
|-------|------------|
| `001-008` | Base: jobs RLS, constants catalog, refresh events, schema alignment |
| `009-020` | BT export, CQT indices, history FK, search path, security hardening |
| `021-030` | Soft delete, backup/restore, performance indexes, maintenance |
| `031-040` | Snapshots, time-series partitioning, idempotency, multi-tenancy, LGPD |
| `041-050` | Tenant profiles, partition RLS, LGPD lifecycle, cleanup, canonical topology |
| `051-060` | Canonical indexes, DG persistence, tenant isolation, formula versions |
| `061-070` | Perf RLS, PostGIS, collaboration, user preferences, projects |
| `071-080` | Project snapshots, organization, audit triggers, geospatial governance, RPC neighbors |
| `081-100` | Stripe tables, billing helpers, user tiers |

---

## 7. Testes (e2e/ + tests/)

### e2e/ — Playwright (12 arquivos)

| Teste | Finalidade |
|-------|------------|
| `a11y-smoke.spec.ts` | Smoke test de acessibilidade |
| `auth-login.spec.ts` | Teste de login |
| `constants-observability.spec.ts` | Observabilidade de constantes |
| `dxfGeneration.spec.ts` | Geração DXF |
| `groq-and-dxf.spec.ts` | Groq + DXF |
| `hello-world.spec.ts` | Smoke test básico |
| `i18n-sidebar.spec.ts` | Internacionalização da sidebar |
| `release-smoke.spec.ts` | Smoke test de release |
| `security.spec.ts` | Testes de segurança |
| `factories/critical-flow-factory.ts` | Factory de fluxo crítico |
| `fixtures/critical-flow-fixtures.ts` | Fixtures de fluxo crítico |
| `fixtures/test-batch.csv` | CSV de teste batch |

### tests/ — Testes Unitários Frontend (38 arquivos)

| Categoria | Arquivos | Finalidade |
|-----------|----------|------------|
| Raiz | 10 testes (btCalculations, canonicalAdapter, featureFlags, sanitization, version, etc.) | Testes de utilidades e hooks |
| `components/` | 15 testes (Breadcrumb, ConfirmationModal, ConstantsCatalogOps, DgOptimizationPanel, MapSelector, Settings, Sidebar, Toast, etc.) | Testes de componentes |
| `config/` | `featureFlags.test.ts` | Teste de feature flags |
| `hooks/` | 14 testes (useAppAnalysisWorkflow, useAutoSave, useBtDerivedState, useBtEdgeOperations, useDxfExport, useElevationProfile, etc.) | Testes de hooks |
| `i18n/` | `appLocale.test.ts` | Teste de internacionalização |
| `services/` | 5 testes (btDerivedService, constantsCatalog, dxfService, elevation, gemini) | Testes de serviços |
| `utils/` | 13 testes (a11y, analytics, btCalculations, btDxfContext, btNormalization, btTopologyFlow, geo, gridReadability, idGenerator, immutability, kmlParser, logger, memorial, validation) | Testes de utilitários |
| `scripts/` | 8 scripts de teste Python (analise_workflow, backend_db_access, cloud_tasks_dxf, dxf_generation, supabase_and_dxf, tables_post_migration, workflow_with_mock) | Testes Python |

---

## 8. scripts/ (69 arquivos)

| Categoria | Arquivos | Finalidade |
|-----------|----------|------------|
| CI/CD | `ci/` (6 mjs: analyze-flakiness, enforce-checkpoints, enforce-d7-go, enforce-non-negotiables, enforce-normative-checklist, enforce-snapshot-slo, generate-sbom) | Scripts de CI |
| Build/Release | `build_release.ps1`, `build_release.sh`, `run-build-release.js` | Build de release |
| Setup | `setup-local.ps1`, `setup-local.sh`, `start-dev.ps1`, `setup-cloud-tasks-queue.sh` | Setup local |
| Segurança | `security_audit.py`, `security_scan.ps1`, `security_scan.sh`, `generate-redis-certs.sh` | Auditoria de segurança |
| Testes | `test-suite-metrics.js`, `verify-dxf-engine.py`, `verify_dxf_headless.ps1`, `robust_e2e_stress_test.py` | Testes e validação |
| Auditoria | `audit_cqt_workbook.py`, `audit_db_migrations.py`, `audit_dxf.py`, `live_db_audit.py`, `non-negotiables-audit.cjs` | Auditoria |
| DB | `apply-audit-fixes.ps1`, `apply-audit-fixes.sh`, `apply_migrations.py`, `predeploy_db_healthcheck.py` | Banco de dados |
| DXF/DG | `dg_test_padre_decaminada.ts`, `dg_to_dxf_ezdxf.py`, `diagnose_dxf.sh`, `compare-zna25282.ts`, `patch-zna25282-topology.ts` | Engenharia DXF/DG |
| Utilidades | `check-coverage-policy.js`, `check-version.sh`, `generate-node-sbom.js`, `update-version.ps1`, `update-version.sh` | Utilitários |

---

## 9. docs/ — Documentação Técnica (97 arquivos)

| Subdiretório | Arquivos | Finalidade |
|--------------|----------|------------|
| Raiz | 34 documentos (análise APIs, cálculos elétricos, arquitetura, auditoria, CACs, CQT, checkpoint, canonical, DATABASE_MAINTENANCE, DEFINITION_OF_DONE, DG implementation, FRONTEND_COMPONENT, ganhos técnicos, Melhorias Arquiteturais, NORMATIVE_VALIDATION, RESUMO_APIS, RULES_ENFORCEMENT, SECRET_ROTATION, STRATEGIC_ROADMAP, STRIPE, TEMP_POSTE_RESTART, TEST_DATA_FACTORY, UX_EXECUTION_BOARD) | Documentação principal |
| `audit/` | 5 arquivos (AUDIT_CHECKLIST_FULL, AUDIT_FINAL_REPORT, AUDIT_SESSION_6, SECURITY_CODE_QUALITY_AUDIT) | Auditoria |
| `brainstorm/` | 6 arquivos (ideation, discussion, concept A/B/C, team vote, summary) | Brainstorming |
| `guides/` | 6 guias (CLOUD_TASKS, COMMENT_STANDARDS, DEBUG, DOCKER_USAGE, SECURITY_ANTIVIRUS, TESTES_MANUAIS) | Guias |
| `history/` | 6 arquivos (BATCH_5, DOCKER_MIGRATION, MIGRATION_FIX, MIGRATION_SUMMARY, RESULTADO_FINAL, VERSIONING) | Histórico |
| `image/` | 1 imagem (STRATEGIC_ROADMAP_2026 roadmap png) | Imagens |
| `qa/` | `sprint-1-signoff.md` | QA |
| `roles/` | 5 documentos (DEVOPS_QA, INTERN, SENIOR_DEV, TECH_LEAD, UX_DESIGNER) | Papéis |
| `runbooks/` | 2 runbooks (API_CONNECTION_OUTAGE, CRITICAL_ROLLBACK) | Runbooks |
| `sprint-1/` | 3 arquivos (done, plan, progress) | Sprint 1 |
| `sre/` | 5 arquivos (ENTERPRISE_ONBOARDING, INCIDENT_PLAYBOOK_LGPD, RUNBOOKS, SLA_CONTRATOS, SLO_DEFINITIONS) | SRE |

---

## 10. Config / Infraestrutura

### Docker

| Arquivo | Finalidade |
|---------|------------|
| `Dockerfile` | Build de produção multi-stage |
| `Dockerfile.dev` | Build de desenvolvimento |
| `Dockerfile.prod` | Build produção alternativo |
| `docker-compose.yml` | Orquestração principal |
| `docker-compose.dev.yml` | Dev overrides |
| `docker-compose.prod.yml` | Prod overrides |
| `docker-entrypoint.sh` | Entrypoint |
| `healthcheck.sh` | Health check |

### Supabase

| Arquivo | Finalidade |
|---------|------------|
| `.supabase/config.json` | Config do Supabase CLI |
| `.supabase/migrations_applied.json` | Controle de migrations aplicadas |

### Secrets

| Arquivo | Finalidade |
|---------|------------|
| `secrets/admin_token.txt` | Token admin |
| `secrets/groq_api_key.txt` | API key Groq |
| `secrets/metrics_token.txt` | Token de métricas |
| `secrets/redis_password.txt` | Senha Redis |

### Schemas JSON

| Schema | Finalidade |
|--------|------------|
| `bt_calculate_request.schema.json` | Schema de requisição de cálculo BT |
| `bt_calculate_response.schema.json` | Schema de resposta de cálculo BT |
| `bt_mechanical_request.schema.json` | Schema de requisição mecânica BT |
| `bt_mechanical_response.schema.json` | Schema de resposta mecânica BT |
| `dxf_request.schema.json` | Schema de requisição DXF |
| `dxf_response.schema.json` | Schema de resposta DXF |

### Cache/Dados

| Diretório | Conteúdo |
|-----------|----------|
| `cache/` | 14 arquivos JSON de cache de elevação |
| `.cache/ezdxf/` | Cache de fontes DXF |
| `.cache/fontconfig/` | Cache de fontes |
| `.cache/matplotlib/` | Cache do Matplotlib |
| `.cache/srtm/` | Dados SRTM (S23W043.hgt) |
| `download/` | 3 arquivos (DG DXF + resultado JSON) |
| `public/` | Assets estáticos (SVG, PNG, JSON de catálogo) |
| `dist/` | Build de produção (JS, CSS, HTML, assets, branding) |

---

## 11. Arquivos Residuais

| Diretório | Conteúdo |
|-----------|----------|
| `_quarantine/` | 50+ arquivos movidos da raiz (scripts antigos, outputs, documentação legada, GeoJSONs, logs de teste) |
| `scratch/` | 20+ scripts de exploração e debug (analyze_excel, check_schema, refactor_app, test_osm, trace_formulas, etc.) |
| `tmp/` | 10+ arquivos temporários (coverage reports, logs a11y, check_migration) |
| `tmp/kmz_extracted/` | KMZ extraído com 12 fotos de campo |
| `tmp/custom-dxf-output/` | Diretório vazio para output DXF |
| `artifacts/` | 30+ artefatos de auditoria (audit-live JSON/MD, reports, bandit, sbom, stripe docs) |
| `artifacts/brain/` | Cache de brain |
| `artifacts/ci/` | 8 reports de CI (d7-go, flakiness, non-negotiables, normative-checklist, snapshot-slo) |
| `logs/` | 15+ logs (combined logs diários, error logs, db_debug) |
| `orchestrator/template/` | Template de orquestração (DADOS_BRUTOS, PROCESSAMENTO, ENTREGAVEIS, RELATORIOS) |
| `Light_estudo/` | README de estudo de iluminação |
| `.npm/_logs/` | Logs do npm |
| `.pytest_cache/` | Cache do Pytest |
| `.lighthouseci/` | Relatórios Lighthouse CI |
| `test-results/` | Resultados de teste (release-smoke) |
| `playwright-report/` | Relatório HTML do Playwright |

---

## Resumo Estatístico

| Categoria | Quantidade |
|-----------|------------|
| **Total de arquivos analisados** | ~2.200+ |
| **Componentes React** | 78 |
| **Páginas** | 9 |
| **Hooks** | 37 |
| **Serviços Frontend** | 10 |
| **Utilitários Frontend** | 26 |
| **Arquivos i18n** | 29 |
| **Rotas Express** | 96 |
| **Serviços Backend** | 76 |
| **Repositórios** | 10 |
| **Middlewares** | 9 |
| **Migrations SQL** | 81 |
| **Arquivos Python** | 47 |
| **Testes (unit + e2e)** | ~280+ |
| **Scripts** | 69 |
| **Documentos** | ~130 |
| **Workflows CI/CD** | 13 |

---

*Análise gerada automaticamente em 13/05/2026*