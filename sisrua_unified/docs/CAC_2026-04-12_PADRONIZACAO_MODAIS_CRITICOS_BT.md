# CAC - Padronização de Modais Críticos BT

## Identificação

- Data: 2026-04-12
- Tipo: Melhoria + Segurança Operacional (Frontend)
- Componente: Fluxo BT (confirmações destrutivas/sensíveis)
- Arquivos principais:
  - src/components/BtModals.tsx
  - src/components/BtModalStack.tsx
  - src/components/BtTopologyPanel.tsx
  - src/components/SidebarBtEditorSection.tsx
  - src/App.tsx
- Branch: dev

## Contexto

As confirmações de ações críticas estavam parcialmente distribuídas e com uso pontual de `window.confirm`, sem padrão único consistente no produto.

## Causa Raiz

1. Ausência de um contrato central para confirmações críticas reutilizáveis.
2. Acoplamento local de confirmações em componentes específicos.
3. Diferenças de UX entre confirmações nativas e modais da aplicação.

## Mudanças Aplicadas

1. Introdução de modelo central de confirmação:

- `CriticalConfirmationConfig`
- `CriticalActionModal`

2. Integração no stack central de modais BT (`BtModalStack`).

3. Centralização no `App.tsx` dos wrappers de confirmação para ações destrutivas/sensíveis:

- excluir poste;
- excluir trecho;
- excluir transformador;
- reduzir ramal de poste;
- reduzir condutor de trecho.

4. Substituição de confirmações locais no `BtTopologyPanel`:

- remoção de `window.confirm`;
- uso de callback central `onRequestCriticalConfirmation`.

## Arquivos Impactados

- src/components/BtModals.tsx
- src/components/BtModalStack.tsx
- src/components/BtTopologyPanel.tsx
- src/components/SidebarBtEditorSection.tsx
- src/App.tsx
- RAG/MEMORY.md

## Validação Executada

- Build: `npm --prefix sisrua_unified run build` (sucesso)
- Verificação funcional dos fluxos críticos com modal único (sem `window.confirm`).

## Riscos Residuais

- Ação crítica sem callback central em novos componentes futuros pode reintroduzir divergência de padrão.

## Mitigação

- Requisito de revisão: toda ação destrutiva/sensível deve usar `CriticalActionModal` via callback central.

## Rollback

- Reverter o commit desta CAC no branch `dev`.

## Critério de Aceite

1. Nenhuma confirmação crítica via `window.confirm` no frontend BT.
2. Ações destrutivas/sensíveis usam modal único e consistente.
3. Build frontend sem erros.

## Acessibilidade Transversal

1. Esta CAC passa a seguir a diretriz transversal formalizada em `CAC_2026-04-12_ACESSIBILIDADE_TRANSVERSAL_WCAG.md`.
2. Modais críticos BT devem manter navegação por teclado, foco visível e nome acessível dos controles.
3. Regressões de a11y `serious`/`critical` em fluxos críticos invalidam aceite funcional.
