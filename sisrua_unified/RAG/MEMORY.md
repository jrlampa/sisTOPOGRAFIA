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
