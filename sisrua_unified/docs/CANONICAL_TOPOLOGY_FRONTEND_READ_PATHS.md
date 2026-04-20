# Mapeamento de read-paths críticos no frontend

## Objetivo

Listar os pontos que ainda consomem BT/MT legado diretamente, para orientar a migração gradual do estado interno para `canonicalTopology`.

## Ponto central

1. [src/App.tsx](../src/App.tsx)
   Orquestra `appState`, injeta `btTopology` e `mtTopology` em hooks e componentes, e agora sincroniza o estado canônico no setter global.

## Estado BT legado

1. [src/hooks/useBtCrudHandlers.ts](../src/hooks/useBtCrudHandlers.ts)
   Escrita principal de `btTopology`.
2. [src/hooks/useBtPoleOperations.ts](../src/hooks/useBtPoleOperations.ts)
   CRUD de postes BT.
3. [src/hooks/useBtEdgeOperations.ts](../src/hooks/useBtEdgeOperations.ts)
   CRUD de arestas BT.
4. [src/hooks/useBtTransformerOperations.ts](../src/hooks/useBtTransformerOperations.ts)
   CRUD de transformadores BT.
5. [src/hooks/useBtDerivedState.ts](../src/hooks/useBtDerivedState.ts)
   Cálculos derivados a partir do legado BT.
6. [src/hooks/useBtDxfWorkflow.ts](../src/hooks/useBtDxfWorkflow.ts)
   Geração de `btContext` para exportação.
7. [src/utils/btDxfContext.ts](../src/utils/btDxfContext.ts)
   Serialização final de topologia BT para contexto de DXF.
8. [src/utils/btTopologyFlow.ts](../src/utils/btTopologyFlow.ts)
   Regras e sumários elétricos dependentes de `BtTopology`.

## Estado MT legado

1. [src/hooks/useMtCrudHandlers.ts](../src/hooks/useMtCrudHandlers.ts)
   Escrita principal de `mtTopology`.
2. [src/hooks/useMtPoleOperations.ts](../src/hooks/useMtPoleOperations.ts)
   CRUD de postes MT.
3. [src/hooks/useMtEdgeOperations.ts](../src/hooks/useMtEdgeOperations.ts)
   CRUD de arestas MT.

## Fluxos transversais

1. [src/hooks/useProjectDataWorkflow.ts](../src/hooks/useProjectDataWorkflow.ts)
   Importa KML e grava em `btTopology`.
2. [src/hooks/useFileOperations.ts](../src/hooks/useFileOperations.ts)
   Carrega e salva `GlobalState`; precisa aceitar projetos antigos e futuros.
3. [src/app/initialState.ts](../src/app/initialState.ts)
   Estado inicial legado ainda preservado por compatibilidade.

## Implicação prática para a migração

1. Itens 14 e 15 podem ser feitos sem alterar esses consumidores, desde que o setter global mantenha `canonicalTopology` sincronizado.
2. Itens 17 e 18 deverão migrar primeiro os componentes de leitura visual mais críticos para o adaptador canônico.
3. A remoção do bridge legado só pode ocorrer depois que os arquivos acima deixarem de depender de `BtTopology` e `MtTopology` diretamente.
