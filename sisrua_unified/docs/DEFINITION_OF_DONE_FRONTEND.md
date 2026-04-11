# Definition of Done — Frontend

> Versão 1.0 · Abril 2026  
> Aplica-se a toda entrega que toque arquivos em `src/`, `public/`, `index.html` ou configurações de build/lint/test.

---

## 1. Código

| Critério | Comando de verificação |
|---|---|
| Sem erros de TypeScript | `npm run typecheck:frontend` |
| Sem violações de lint críticas (≤ 50 avisos) | `npm run lint:frontend` |
| Sem `console.log` / `debugger` esquecido | revisão manual no PR |
| Arquivos > 500 linhas refatorados ou justificados | checklist do PR |

## 2. Testes

| Critério | Comando de verificação |
|---|---|
| Testes unitários passando | `npm run test:frontend` |
| Gate de risco passando (módulos críticos) | `npm run test:frontend:risk` |
| Cobertura ≥ 80% nos módulos críticos | relatório em `coverage/` |
| Novos fluxos críticos têm pelo menos 1 teste | revisão manual no PR |

## 3. Build e Performance

| Critério | Comando de verificação |
|---|---|
| Build de produção sem erros | `npm run build` |
| Score Lighthouse performance ≥ 60 (aviso) | `npm run lhci` |
| Score Lighthouse best-practices ≥ 75 (aviso) | `npm run lhci` |
| Sem regressão de bundle acima de 10% sem justificativa | comparar saída do build |

## 4. Acessibilidade

| Critério | Comando de verificação |
|---|---|
| Zero violações axe de impacto `critical` ou `serious` | `npm run a11y:smoke` |
| Score Lighthouse accessibility ≥ 85 (erro bloqueante) | `npm run lhci` |
| Botões icon-only têm `aria-label` | revisão manual no PR |
| Contraste de texto ≥ 4,5:1 (WCAG 2.1 AA) | verificado pelo axe |

## 5. UX / i18n

| Critério |
|---|
| Toda UI/UX em pt-BR (sem termos em inglês expostos ao usuário) |
| Estados visuais implementados: loading, erro, vazio, sucesso |
| Responsivo para viewport ≥ 320 px |
| Não introduz modo escuro inconsistente (usar tokens de `src/index.css`) |

## 6. Segurança

| Critério |
|---|
| `npm audit --audit-level=moderate` sem vulnerabilidades moderadas/altas |
| Sem dados sensíveis hardcodados (tokens, URLs, senhas) |
| Entradas do usuário sanitizadas antes de exibir no DOM |
| Variáveis de ambiente de produção usam `VITE_` prefix e não são expostas desnecessariamente |

---

## Pipeline automatizado (PR)

O workflow `.github/workflows/pr-frontend.yml` executa automaticamente em todo PR para `dev`/`main`:

```
lint-frontend → typecheck-frontend → test-frontend → build-frontend → a11y-smoke → lighthouse → frontend-pr-gate
```

O **frontend-pr-gate** bloqueia o merge se qualquer job falhar.

---

## Checklist rápido para o autor do PR

- [ ] `npm run ci:frontend` passou localmente
- [ ] Nenhum novo `eslint-disable` sem comentário explicativo
- [ ] Componentes novos seguem `docs/FRONTEND_COMPONENT_GUIDELINES.md`
- [ ] A11y: botões icon-only têm `aria-label`
- [ ] Textos pequenos usam cor ≥ `text-slate-400` sobre fundo escuro
# Definition of Done – Frontend

> Versão: 1.0 | Atualizado em: 2026-04-10 | Branch: dev

Este documento define os critérios obrigatórios que **toda alteração de frontend** deve satisfazer antes de ser considerada "pronta" (done). Serve como contrato entre devs, revisores e CI.

---

## 1. Código

| Critério | Obrigatório | Verificação |
|---|---|---|
| Nenhum erro de TypeScript (`tsc --noEmit`) | ✅ | `npm run typecheck:frontend` |
| Nenhum erro de lint ESLint em `src/` | ✅ | `npm run lint:frontend` |
| Nenhum console.error / console.warn desnecessário em produção | ✅ | Revisão manual no PR |
| Arquivos > 500 linhas divididos em módulos menores | ✅ | Revisão manual no PR |
| Nenhuma secret / credencial hardcoded | ✅ | `npm run security:audit` |
| Props não usadas removidas | ✅ | ESLint (`no-unused-vars`) |

---

## 2. Testes

| Critério | Obrigatório | Verificação |
|---|---|---|
| Suite frontend passa 100% | ✅ | `npm run test:frontend` |
| Gate de risco por arquivo passa | ✅ | `npm run test:frontend:risk` |
| Cobertura de linhas ≥ 55% nos módulos críticos | ✅ | `vitest.risk.config.ts` |
| Novos comportamentos testados unitariamente | ✅ | Revisão de PR |
| Testes não dependem de backend ou banco | ✅ | `NODE_ENV=test` + mocks |
| Smoke E2E não quebra (`@smoke` tag) | ✅ | Workflow `pr-frontend.yml` |

---

## 3. Build e Performance

| Critério | Obrigatório | Verificação |
|---|---|---|
| Build de produção sem erros (`npm run build`) | ✅ | Workflow `pr-frontend.yml` (job `build-frontend`) |
| Nenhum módulo novo de > 500 kB não justificado | ✅ | Relatório Vite (stdout do build) |
| Lighthouse performance ≥ 60 (meta de médio prazo: ≥ 80) | ⚠️ warn | `npm run lhci` |
| Lazy-loading aplicado em rotas e assets pesados | ✅ | Revisão manual no PR |

---

## 4. Acessibilidade

| Critério | Obrigatório | Verificação |
|---|---|---|
| Zero violações axe WCAG 2.1 AA de impacto `critical` ou `serious` | ✅ | `npm run a11y:smoke` |
| Todos os elementos interativos com rótulo acessível | ✅ | axe rule `button-name`, `label`, `link-name` |
| Lighthouse accessibility score ≥ 85 | ✅ | `npm run lhci` (bloqueia gate) |
| Foco visível (focus-visible) em todos os elementos interativos | ✅ | Revisão manual no PR |
| Atributos `lang` e `alt` presentes onde necessário | ✅ | Revisão manual no PR |

---

## 5. UX e Internacionalização

| Critério | Obrigatório | Verificação |
|---|---|---|
| Todo texto visível ao usuário em pt-BR | ✅ | Revisão manual no PR |
| Estados de carregamento e erro sempre visíveis | ✅ | Revisão manual no PR |
| Feedback visual para ações do usuário (toast, spinner, etc.) | ✅ | Revisão manual no PR |
| Tema claro/escuro funcional sem inconsistências visuais | ✅ | Revisão manual no PR |
| Responsividade testada em 375px, 768px e 1440px | ✅ | Revisão manual no PR |

---

## 6. Segurança

| Critério | Obrigatório | Verificação |
|---|---|---|
| Nenhum dado sensível exibido ou logado no browser | ✅ | Revisão manual no PR |
| Inputs do usuário sanitizados antes de envio à API | ✅ | Revisão de código |
| CSP configurada (não inline scripts/styles em produção) | ✅ | `vite.config.ts` plugin CSP |
| Dependências sem vulnerabilidades `moderate` ou superior | ✅ | `npm run security:audit` |

---

## 7. Revisão de PR

| Critério | Obrigatório |
|---|---|
| PR title inicia com tipo semântico (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`) | ✅ |
| Descrição do PR explica **o quê** e **por quê** (não apenas **como**) | ✅ |
| Screenshots ou gravação para mudanças visuais | ✅ |
| Nenhum `TODO` não rastreado (deve virar issue se não for feito no PR) | ✅ |
| Self-review feito pelo autor antes de pedir revisão | ✅ |
| Branch `dev` atualizada antes de abrir PR | ✅ |

---

## 8. Checklist rápida para o autor do PR

Copie e cole no corpo do PR:

```markdown
## Checklist Frontend

### Código
- [ ] `npm run typecheck:frontend` passou
- [ ] `npm run lint:frontend` passou (0 erros)
- [ ] Sem secrets hardcoded
- [ ] Arquivos sem violação do limite de 500 linhas

### Testes
- [ ] `npm run test:frontend` → 100% passou
- [ ] `npm run test:frontend:risk` → gate por módulo passou
- [ ] Novo comportamento tem teste

### Build & Performance
- [ ] `npm run build` sem erros
- [ ] Nenhum bundle novo > 500 kB não justificado

### Acessibilidade
- [ ] `npm run a11y:smoke` → zero violações críticas
- [ ] Elementos interativos com label acessível

### UX
- [ ] Textos em pt-BR
- [ ] Estados de loading/erro tratados
- [ ] Responsividade verificada (375 / 768 / 1440 px)

### Segurança
- [ ] `npm run security:audit` limpo
- [ ] Sem dados sensíveis expostos no browser

### PR
- [ ] Title semântico (`feat:` / `fix:` / etc.)
- [ ] Screenshots/gravação para mudanças visuais
- [ ] `dev` atualizado
```

---

## Pipeline de CI associado

O workflow `.github/workflows/pr-frontend.yml` executa automaticamente os gates marcados como ✅ acima em todo PR. Itens marcados como ⚠️ geram aviso mas não bloqueiam o merge.

### Diagrama de jobs

```
push/PR (src/** alterado)
│
├── lint-frontend ──────┐
├── typecheck-frontend ─┤
├── test-frontend ──────┤─→ build-frontend ─┬─→ a11y-smoke ─┐
│                       │                    └─→ lighthouse   │
│                       └────────────────────────────────────┤
│                                                             └─→ frontend-pr-gate ✅
```

### Regra de bloqueio

Jobs **bloqueantes** (gate falha se qualquer um falhar):
- `lint-frontend`
- `typecheck-frontend`
- `test-frontend`
- `build-frontend`
- `a11y-smoke`

Jobs **warn-only** (reportam mas não bloqueiam):
- `lighthouse` (performance < 60 gera warn)

---

*Documento mantido em `docs/DEFINITION_OF_DONE_FRONTEND.md`.*
*Para propor alterações, abra um PR com a label `dx` e `documentation`.*
