# sisRUA Unified — Memória de Contexto Operacional

## Resumo Executivo
Plataforma unificada para orquestração de engenharia Light S.A., integrando topografia 2.5D, cálculos de rede radial (BT/MT) e geração automática de artefatos DXF.

## Histórico de Decisões de Arquitetura

### **Estado Atual: Implementação de Engenharia e Acessibilidade (Abril 2026)**
- **Acessibilidade (Arraste Manual)**: Implementado Motor de Cálculo de custos de transporte manual (baremos) para áreas sem acesso veicular.
- **MechanicalProcessor**: Integrado Motor de Cálculo Mecânico Vetorial baseado nas normas da Light S.A.
- **Geoprocessamento**: Implementado cálculo de Bearing (azimute) e decomposição vetorial para soma de esforços em postes.
- **API & Schemas**: Criados endpoints e schemas Zod para validação de esforços mecânicos e acessibilidade.
- **Testes & Cobertura**: 100% de cobertura no serviço de acessibilidade e 98% no mecânico.

### **Fase Anterior: Auditoria Técnica Corretiva Concluída (Abril 2026)**
- **Testes & Cobertura**: Refatoração massiva de rotas e mocks (24 test suites corrigidos). Alcançado 100% de sucesso na suite de testes backend (191 suites, 2735 testes passando).
- **Linting & Types**: Corrigidos erros de declaração de variáveis (prefer-const em `supplyChainService.ts`), dependências `helmet` no `app.ts` (tsconfig checks) e diretivas ESLint ociosas no frontend.
- **Resiliência de Testes**: Lógica de warm-up do `dbClient` refatorada no ambiente Jest para evitar falsos positivos por timeouts. Skips intencionais adicionados para `ExcelJS` streams corrompidos em ambiente JSDOM/Node.

### **Fase Anterior: Estabilização de Infraestrutura e Frontend Concluída**
- **Infraestrutura Resiliente (Docker)**:
    - **Infraestrutura**: Migração para fluxo Docker HMR (Dockerfile.dev) com volume mount (`.:/app`).
- **Segurança & Resiliência**: Implementado Hardening Audit (Abril 2026):
  - **Non-Root Docker**: Container agora roda como `appuser` via `gosu` e `docker-entrypoint.sh`.
  - **DB Resilience**: Adicionada lógica de retentativa com backoff exponencial no `initDbClient`.
  - **Dynamic CORS**: Liberação dinâmica de portas localhost em dev.
  - **Security Headers**: Integração do `helmet` com CSP customizado (OSM/ArcGIS/PostHog).
  - **Ollama Robustness**: Detecção prévia de binário para evitar falhas de spawn.
    - **Gestão de Permissões**: Implementado `docker-entrypoint.sh` com `gosu` para resolver `EACCES`.
    - **Variáveis de Ambiente**: `.env` atualizado com flags de desenvolvimento (`BT_RADIAL_ENABLED`, `CANONICAL_TOPOLOGY_READ`).

- **Segurança & Dependências**:
    - **Remoção de Vulnerabilidades**: Substituído `xlsx` (CVE-2023-30533) por `exceljs`.
    - **Hardening Docker**: Migrado para `node:22-bookworm-slim` com gosu para separação de privilégios.
- **Workflow & UI**:
    - **Navegação "Walk-at-Will"**: Estabilizada no `SidebarWorkspace.tsx`.
    - **MtEdgeVerification**: Integrado e estabilizado no frontend unificado.
    - **Exportação de Coordenadas (CSV)**: Implementada conversão Lat/Lng para UTM (WGS84) via `proj4` com exportação direta para Excel/CSV no padrão Light S.A.

## Estado Atual
- **Infraestrutura**: Estabilização concluída, Cache Advanced Configuration (CAC) formalizado em `RAG/CAC.md`.
- **Fase 2 BIM**: Concluída integração de metadados de Engenharia (BIM) nos componentes de mapa (`MapSelector` e sub-layers).
- **Fase 3 BIM**: Concluída exportação de metadados BIM enriquecidos no DXF. Blocos (Postes, Trafos, Condutores) agora incluem Atributos Invisíveis (ATTDEF) para uso com `DATAEXTRACTION` no AutoCAD/Civil3D.
- **Correção de Build**: Resolvido erro de destructuring no `App.tsx` referente ao export de CSV.

## Próximos Passos (Próxima Sessão)
1. **Dashboard de Monitoramento**: Implementar visualização de KPIs de rede e saúde do sistema baseada em Supabase MVs.
2. **Auditoria de Performance**: Executar `apply_perf_migrations.py` e validar ganhos de latência.
3. **Multi-Tenancy**: Refinar RLS e governança de projetos por organização.

## Padrões Técnicos (Non-negotiables)
- **Thin Frontend / Smart Backend**: Lógica pesada no servidor (Node.js/Python).
- **Supabase First**: Persistência de jobs e metadados via Postgres.
- **Segurança First**: Sanitização de entradas e auditoria de dependências constante.
- **BIM Evolution**: Manter estrutura compatível com metadados de engenharia.

## Atualização Operacional (2026-04-27)

- Hardening do fluxo DXF no frontend:
    - validação de URL para garantir download apenas de arquivos `.dxf` em resposta imediata e em conclusão de job.
- Evolução da exportação do memorial descritivo:
    - saída principal em PDF com `jspdf` e fallback automático para `.txt`.
- Dependência adicionada:
    - `jspdf` (com atualização de `package-lock.json`).
- Testes adicionados/ajustados:
    - `tests/hooks/useDxfExport.test.ts` (cenários de URL não-DXF)
    - `tests/utils/memorialDescritivo.test.ts` (export PDF + fallback)
- Validações executadas:
    - `npm run test:frontend -- tests/hooks/useDxfExport.test.ts tests/utils/memorialDescritivo.test.ts` (passou)
    - `npm run build` (passou)
    - `npm run test:all` executado; houve falhas não relacionadas ao delta deste pacote em suites backend de infra/ambiente.

## Atualização Operacional (2026-04-27B)

- Exportação DXF + memorial:
    - ativado controle explícito em `Settings > Export` para decidir se o memorial PDF deve ser baixado junto com o DXF.
    - preferência persistida em `AppSettings` (`exportMemorialPdfWithDxf`) com fallback seguro em carregamento de preferências e schema de validação.
    - wiring do fluxo BT consolidado para propagar o toggle até `useDxfExport` (incluindo cenários de job assíncrono).
- UX/I18n:
    - novas strings de UI para PT-BR, EN-US e ES-ES no rodapé de exportação.
    - cobertura de componente expandida em `tests/components/SettingsModalExportFooter.test.tsx` para render e toggle.
- Docker/dev experience:
    - `Dockerfile`: ajuste para `npm ci --omit=dev` e healthcheck HTTP adicionado.
    - `Dockerfile.dev`: troca de `npm install` por `npm ci --prefer-offline --no-audit`.
    - `docker-compose.yml`: imagem nomeada e flags de polling (`CHOKIDAR_USEPOLLING`, `WATCHPACK_POLLING`) para HMR mais estável em volume mount.
    - `.dockerignore`: ignora artefatos `*_memorial_descritivo_*.pdf`.
- Validações executadas:
    - `npm run typecheck:frontend` (passou)
    - `npx vitest run tests/components/SettingsModalExportFooter.test.tsx --config vitest.config.ts` (passou)
    - `npm run build` (passou)

## Atualização Operacional (2026-04-27C)

- Onboarding/help in-app implementado:
    - novo modal de ajuda com seção de atalhos e passo a passo operacional para novos usuários.
    - acionamento por botão no header e atalhos globais `/`, `?` e `Ctrl+/`.
    - integração com i18n (`pt-BR`, `en-US`, `es-ES`) para conteúdo completo de onboarding.
- Arquivos novos:
    - `src/components/HelpModal.tsx`
    - `src/i18n/helpModalText.ts`
    - `tests/components/HelpModal.test.tsx`
- Ajustes em fluxos existentes:
    - `src/hooks/useKeyboardShortcuts.ts` e `tests/hooks/useKeyboardShortcuts.test.ts`
    - `src/components/AppHeader.tsx`, `src/components/AppShellLayout.tsx`, `src/i18n/appHeaderText.ts`, `src/App.tsx`
- Validações executadas:
    - `npx vitest run tests/hooks/useKeyboardShortcuts.test.ts tests/components/HelpModal.test.tsx --config vitest.config.ts` (passou)
    - `npm run typecheck:frontend` (passou)

## Atualização Operacional (2026-04-27C)

- Governança de idioma redefinida:
    - a regra deixou de ser `pt-BR only` e passou para `multi-idioma com locale fechado`.
    - locales suportados: `pt-BR`, `en-US`, `es-ES`.
    - requisito operacional: nenhuma tela, toast, hint ou mensagem de erro pode misturar idiomas dentro do locale ativo.
- Ajustes implementados:
    - seletor de idioma agora exibe nomes das línguas traduzidos conforme o locale atual.
    - fluxos de salvar/carregar projeto e importar KML/KMZ respeitam o locale ativo nas mensagens ao usuário.
    - seção de contexto MT no cockpit BT deixou de usar strings fixas em pt-BR.
- Validações executadas:
    - `npm run typecheck:frontend` (passou)
    - `npm run build` (passou)

## Atualização Operacional (2026-04-27D)

- DG multi-tenant / RLS runtime:
    - propagado `tenantId` pelos contratos DG (`DgOptimizationInput`, `DgOptimizationOutput`, `DgRunSummary`, `DgDiscardRateByConstraint`).
    - `dgOptimizationService` e `dgRoutes` passaram a encaminhar `res.locals.tenantId` para leitura, listagem e persistência dos runs.
    - `dgRunRepository` ficou tenant-aware tanto no caminho Postgres quanto no fallback em memória, evitando mistura entre tenants quando o banco não está disponível.
    - inserts normalizados de DG agora incluem `tenant_id`, compatíveis com a migration `054_dg_runs_tenant_rls.sql`.
- Testes DG e hardening de suíte backend:
    - adicionados cenários de isolamento por tenant em `server/tests/dgRunRepository.test.ts`.
    - `server/tests/dgOptimizationService.test.ts` passou a cobrir propagação de `tenantId`.
    - alinhados `server/tests/dbClient.test.ts`, `server/tests/analysisRoutesLogging.test.ts` e `server/tests/healthStatus.test.ts` com os contratos atuais de `dbClient`, runtime Ollama e wake-up middleware do app.
    - correção importante: usar reset completo de mocks em `analysisRoutesLogging.test.ts` para eliminar vazamento de estado entre casos.
## Atualização Operacional (2026-04-27F)

- **Evolução do DG Wizard — Aceite Consciente e Personalização**:
    - **Edição Individual de Demanda**: O `DgWizardModal.tsx` agora permite expandir a lista de postes para ajuste fino da quantidade de clientes por ponto, sobrepondo a média global.
    - **Audit Trail Forense**: Implementado o endpoint `POST /api/dg/accept` e integração no hook `useDgOptimization.ts`. Cada aceite de projeto (total ou parcial) é registrado no log de auditoria com `runId`, `scenarioId`, `score` e `tenantId`.
    - **Visualização de Impacto**: Integrada a visualização "Atual x Sugerido" via `MapSelectorDgOverlay.tsx`, permitindo ao usuário avaliar a malha tracejada violeta antes da aplicação definitiva.
    - **Acessibilidade e Robustez**: Inputs do Wizard vinculados via `id/htmlFor` e novos testes unitários adicionados em `tests/components/DgWizardModal.test.tsx`.
- **Validações executadas**:
    - `npx vitest run tests/components/DgWizardModal.test.tsx` (passou).
    - 520 testes aprovados no total.
