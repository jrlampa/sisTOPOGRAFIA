# sisRUA Unified — Memória de Contexto Operacional

## Resumo Executivo
Plataforma unificada para orquestração de engenharia Light S.A., integrando topografia 2.5D, cálculos de rede radial (BT/MT) e geração automática de artefatos DXF.

## Histórico de Decisões de Arquitetura

### **Estado Atual: Estabilização de Infraestrutura e Frontend Concluída**
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

## Próximos Passos (Próxima Sessão)
1. **Fase 2 BIM**: Iniciar integração de metadados de Engenharia e BIM nos componentes de mapa.
2. **Dashboard de Monitoramento**: Implementar visão de KPIs operacionais no frontend.
3. **Auditoria de Performance**: Validar tempo de carregamento com as novas dependências.

## Padrões Técnicos (Non-negotiables)
- **Thin Frontend / Smart Backend**: Lógica pesada no servidor (Node.js/Python).
- **Supabase First**: Persistência de jobs e metadados via Postgres.
- **Segurança First**: Sanitização de entradas e auditoria de dependências constante.
- **BIM Evolution**: Manter estrutura compatível com metadados de engenharia.
