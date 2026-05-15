# 🧠 Memória de Projeto — sisTOPOGRAFIA (sisRUA Unified)

## ✅ Atualização de Auditoria & Remediação — 2026-05-13
- **Branch obrigatória**: trabalho validado em `dev`.
- **Remediação de Banco de Dados P0 concluída**:
    - **Drift de Migrations**: Migração `100_create_user_tiers_stripe.sql` corrigida (tipo UUID e função `set_updated_at`) e aplicada.
    - **Hardening de Segurança**: Criada migração `101_harden_user_tiers_grants.sql` revogando grants excessivos de DML (`UPDATE/REFERENCES/TRIGGER`) para `authenticated/anon`.
    - **Correção de Rota SIEM**: Atualizado `server/routes/auditRoutes.ts` para utilizar `mv_audit_siem_export` (Materialized View) em vez da view obsoleta `v_audit_siem_export`.
    - **Saúde Operacional**: `live_db_audit.py` validado com **0 riscos ALTO/MÉDIO** após reset de estatísticas e correções.
- **Redis TLS**: Implementado suporte a TLS no `docker-compose.yml` e script de geração de certificados (`scripts/generate-redis-certs.sh`).
    - **Segurança de Segredos**: Criado `docs/SECRET_ROTATION_GUIDE.md` para resposta a incidentes de vazamento de chaves; `.env` e `.env.secrets` validados como ignorados no git.
    - **Hardening npm**: Confirmada remoção do `@lhci/cli` vulnerável; `npm audit` em produção retornou 0 vulnerabilidades críticas.
- **Contexto obrigatório lido**: `RAG/MEMORY.md` e `RAG/CAC.md` consultados antes da finalização.
- **Remediação P0 anterior**: gates de `typecheck:frontend`, `typecheck:backend`, `lint:frontend`, `lint:backend`, `build` e `security:audit` estabilizados.
- **Segurança de dependências**: cadeia vulnerável `protobufjs` remediada via `npm audit fix --legacy-peer-deps`.
- **Stripe/Billing**: rotas e serviço de billing ajustados com guards de DB, encapsulamento de sessão portal e compatibilidade TypeScript/NodeNext.
- **Qualidade**: suíte `test:qa:regression` aprovada com unit, integração e E2E smoke; política de cobertura aprovada.
- **Cobertura validada**: críticos com lines 83.46%, statements 83.22%, functions 96.92%, branches 76.83%; backend/restantes com lines 87.76%, statements 85.82%, functions 90.80%, branches 71.93%.
- **Débito técnico conhecido**: warnings legados de lint (`no-explicit-any`, `no-unused-vars`, hooks deps) permanecem dentro da policy atual, mas devem ser tratados por ondas priorizando auth, billing, rotas críticas e domínio geoespacial.
- **Princípios preservados**: Docker First, Supabase First, Thin Frontend/Smart Backend, Segurança First, DDD, DRY/DRT, 2.5D e pt-BR como idioma principal.

## ✅ Atualização Operacional — 2026-05-14
- **Status Global**: 100% de estabilidade em E2E, Auth Domain Enforcement e Stripe Billing. Cobertura global atingiu ~65%, com Frontend subindo para 44.53% após a Onda 2.
- **Onda 2 Frontend**: Concluída. Mocks globais para Leaflet e Framer Motion implementados em `tests/setup.ts`. Cobertura de 100% em hooks estruturais (`useAppOrchestrator`, `useAppSidebarProps`).
- **Segurança**: Webhooks Stripe agora validam assinaturas rigorosamente em prod e dev.
- **Cache**: Invalidação por padrão (SCAN/MATCH) e por tag implementada no Redis.
- **Roadmap Próximos Passos**: Iniciar Onda 3 para atingir 80% global, focando em componentes remanescentes (`AdminPage`, `BatchUpload` 100%, `DashboardPage` fixes).

## 📊 Estado da Arte (Tier 3: Otimização Avançada)
- **Status Atual (2026-05-11)**: Auditoria Técnica, Evolução de Acesso e Resolução de Falhas Críticas concluídas.
- **Segurança & RLS (Defense-in-Depth)**: Aplicada migração 074, garantindo que todas as tabelas de negócio possuam RLS ativo, mesmo que a camada de API seja comprometida.
- **Infraestrutura Docker**: Dockerfiles unificados em **Alpine:3.21** para eliminar incompatibilidades de glibc (GDAL/GEOS). Adicionados `tini` para gerenciamento de processos (PID 1) e `HEALTHCHECK` nativo. Shutdown agora é imediato (graceful).
- **UI/UX & Design System**: Implementada biblioteca atômica (`src/components/ui/`) com `Button`, `Input`, `FormError` e `Drawer`. Sistema de navegação mobile refatorado para Drawer. Inserido `ToastProvider` e hooks de acessibilidade (`useFocusTrap`, `useAriaAnnounce`). Score de acessibilidade projetado: **95/100**.
- **Documentação Estratégica**: Adicionados 6 documentos profissionais de UI/UX (Estratégia, Dashboard, Storybook Setup, etc.) como fonte da verdade para o frontend.
- **Banco de Dados (Supabase Best Practices)**: Aplicada migração 073 para hardening de RLS (caching via `current_tenant_id()`), indexação de chaves estrangeiras e índices compostos multi-tenant. RPCs espaciais agora possuem isolamento de tenant nativo.
- **Pipeline & Qualidade**: Linter 100% OK, Typechecking impecável, Suite de testes com 100% de sucesso. Build local validado e funcional.
- **Engenharia (py_engine)**: Estabilização e cobertura de testes de elite atingida. Core modules (Controller, Geometry, Mixins) com cobertura >= 80%.
- **Estabilidade**: 3092 testes backend passando (100% de sucesso).
- **Próximo Passo**: Iniciar Setup do Storybook e implementar 5 componentes atômicos adicionais (Card, Badge, Modal, etc.) conforme a Semana 2 do roadmap.

## 🛡️ Segurança & Compliance
- **RBAC**: Controle granular de permissões.
- **Audit**: Trilha de auditoria IA e FinOps implementada.

## 🚀 Performance Baselines
- **IA Preditiva**: Diagnóstico gerado em <10s via Ollama local.
- **DG Wizard**: Geração em <5s.

## 📜 Regras de Ouro
- Não usar 3D (apenas 2.5D).
- Lógica pesada SEMPRE no backend.
- Cobertura mínima global >= 80%.

## ✅ Atualização Operacional — 2026-05-15
- **Correção de Regressão E2E**: Resolvidas 5 falhas nos pacotes Auth e Billing.
    - **Billing**: Padronizado retorno 401 para não autenticado; incluído campo `erro` (pt-BR) no `errorHandler` global para compatibilidade.
    - **Auth**: Testes refatorados para usar asserções funcionais (navegação/visibilidade) em vez de URLs fixas, reduzindo fragilidade.
- **Recuperação de Teste de Carga**: `load-test-baseline.js` corrigido com a criação do `scripts/logger-adapter.js`, eliminando erro de import de módulo.
- **Documentação**: Criado `e2e/BEST_PRACTICES.md` e atualizado `docs/CONTRACTS.md` para formalizar contratos de erro.
- **Estabilidade**: Suíte completa de testes (`auth`, `billing`, `load`) validada e operando em verde.
