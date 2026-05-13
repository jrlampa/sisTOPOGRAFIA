# 🧠 Memória de Projeto — sisTOPOGRAFIA (sisRUA Unified)

## ✅ Atualização de Auditoria & Remediação — 2026-05-13
- **Branch obrigatória**: trabalho validado em `dev`.
- **Contexto obrigatório lido**: `RAG/MEMORY.md` e `RAG/CAC.md` consultados antes da finalização.
- **Remediação P0 concluída**: gates de `typecheck:frontend`, `typecheck:backend`, `lint:frontend`, `lint:backend`, `build` e `security:audit` estabilizados.
- **Segurança de dependências**: cadeia vulnerável `protobufjs` remediada via `npm audit fix --legacy-peer-deps`; revalidação retornou `found 0 vulnerabilities` para dependências de produção.
- **Stripe/Billing**: rotas e serviço de billing ajustados com guards de DB, encapsulamento de sessão portal e compatibilidade TypeScript/NodeNext.
- **Qualidade**: suíte `test:qa:regression` aprovada com unit, integração e E2E smoke; política de cobertura aprovada.
- **Cobertura validada**: críticos com lines 83.46%, statements 83.22%, functions 96.92%, branches 76.83%; backend/restantes com lines 87.76%, statements 85.82%, functions 90.80%, branches 71.93%.
- **Débito técnico conhecido**: warnings legados de lint (`no-explicit-any`, `no-unused-vars`, hooks deps) permanecem dentro da policy atual, mas devem ser tratados por ondas priorizando auth, billing, rotas críticas e domínio geoespacial.
- **Princípios preservados**: Docker First, Supabase First, Thin Frontend/Smart Backend, Segurança First, DDD, DRY/DRT, 2.5D e pt-BR como idioma principal.

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

