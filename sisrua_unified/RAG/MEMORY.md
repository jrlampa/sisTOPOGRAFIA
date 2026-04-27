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
