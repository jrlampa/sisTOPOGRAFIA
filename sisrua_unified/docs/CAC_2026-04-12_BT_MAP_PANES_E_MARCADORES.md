# CAC - Correção BT no Mapa

## Identificação

- Data: 2026-04-12
- Tipo: Corretiva (Frontend)
- Componente: Mapa BT (Leaflet)
- Arquivo principal: src/components/MapSelector.tsx
- Branch: dev

## Contexto

Foi identificado erro em runtime ao editar/inserir postes BT:
`A pane with this name already exists: bt-poles-pane`.

Além disso, havia inconsistência visual dos marcadores de postes em fundo claro do mapa.

## Causa Raiz

1. Colisão de nomes de panes Leaflet quando mais de uma instância do componente tentava registrar panes fixos com o mesmo nome.
2. Renderização duplicada de bloco de postes em trecho intermediário da refatoração.
3. Contraste/tamanho do ícone de poste insuficiente em alguns cenários visuais.

## Mudanças Aplicadas

1. Padronização de nomes de panes BT por instância com `React.useId()`:

- `bt-edges-pane-${id}`
- `bt-poles-pane-${id}`
- `bt-transformers-pane-${id}`

2. Remoção do bloco duplicado de `bt-poles-pane`.

3. Ajustes de legibilidade nos ícones de postes:

- aumento de tamanho;
- halo/sombra para contraste.

## Arquivos Impactados

- src/components/MapSelector.tsx
- RAG/MEMORY.md

## Validação Executada

- Build: `npm --prefix sisrua_unified run build` (sucesso)
- Validação funcional: fluxo de criação/edição de postes sem erro de pane duplicado.

## Riscos Residuais

- Cache de service worker pode manter assets antigos no navegador e simular regressão visual.

## Rollback

- Reverter commit desta CAC no branch `dev`.

## Critério de Aceite

1. Não ocorrer erro `A pane with this name already exists` ao inserir/editar postes.
2. Postes e condutores permanecem visíveis no mapa.
3. Build do frontend sem erros.
