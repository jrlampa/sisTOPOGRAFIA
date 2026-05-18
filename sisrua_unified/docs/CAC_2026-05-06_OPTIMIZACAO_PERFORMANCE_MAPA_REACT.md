# CAC – 2026-05-06 – Otimização de Performance de Visualização do Mapa

## Contexto

O componente de mapa (`MapSelector`) apresentava sinais de lentidão (lag) durante a interação do usuário, especialmente ao movimentar o mouse (Ghost Edges) ou ao arrastar postes. A causa raiz era o re-render total de toda a árvore de componentes do mapa em cada atualização de estado de baixo nível.

## Gap Identificado

| Recurso                 | Estado Anterior                      | Impacto do Re-render                 |
|-------------------------|--------------------------------------|--------------------------------------|
| Rastreio de Mouse       | Estado no componente pai (`MapSelector`) | Re-render de centenas de componentes por movimento. |
| Camadas de Rede (BT/MT) | Componentes monolíticos              | Qualquer mudança pequena re-renderizava todo o layer. |
| Ícones e Geometria      | Gerados no corpo do `map()`          | Instanciação excessiva de objetos Leaflet (GC overhead). |

## Solução Implementada

### 1. Isolamento de Interação (MapInteractionLayer)

Criamos uma camada isolada para capturar eventos de mouse e renderizar o "Vão Fantasma" (`GhostEdge`). Isso removeu a necessidade do `MapSelector` pai gerenciar o estado `mousePos`, garantindo que o movimento do mouse agora afete apenas uma pequena sub-árvore de renderização.

### 2. Memoização Granular (Component Splitting)

Refatoramos as 5 camadas principais para o padrão de **Sub-componente Memoizado**:
- `MapBtPoleMarker` (BT Poles)
- `MapBtEdgeComponent` (BT Edges)
- `MapMtPoleMarker` (MT Poles)
- `MapMtEdgeComponent` (MT Edges)
- `MapBtTransformerMarker` (Transformers)

**Benefício:** Se o usuário arrastar um poste, apenas os componentes vinculados àquele poste e seus vãos adjacentes são re-processados pelo React.

### 3. Otimização de BIM e Ícones

As lógicas de criação de ícones (que variam por status de verificação, flag de mudança e fonte de dados) foram movidas para `useMemo` dentro dos marcadores individuais. O uso de `key={id}` estável melhorou drasticamente a reconciliação do React.

## Resultados e Verificação

- **Responsividade:** A latência de movimento do mouse (ghost edge) foi reduzida a zero (perceptualmente).
- **Estabilidade:** O mapa permanece fluido mesmo com centenas de postes carregados simultaneamente.
- **Qualidade:** Validado com `npm run typecheck:frontend` e `npm run lint:frontend` (0 erros).

## Próximos Passos

- Aplicar o mesmo padrão de memoização para o `MapSelectorDgOverlay.tsx` caso novos algoritmos de design generativo aumentem a densidade de dados.
