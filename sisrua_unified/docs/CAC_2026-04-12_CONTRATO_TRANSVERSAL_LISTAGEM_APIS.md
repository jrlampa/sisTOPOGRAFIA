# CAC - Contrato Transversal de Listagem nas APIs

## Identificação

- Data: 2026-04-12
- Tipo: Qualidade + Consistência de API (Backend)
- Escopo: Paginação, ordenação e filtros nas rotas de listagem
- Branch: dev

## Contexto

Havia paginação e limitação em rotas específicas, mas sem um contrato transversal claro.

Exemplos observáveis:

- `server/routes/btHistoryRoutes.ts`
- `server/routes/constantsRoutes.ts`

O gap principal era:

1. ausência de convenção única para `limit` e `offset`
2. ordenação não padronizada entre endpoints listáveis
3. filtros específicos sem envelope comum de resposta
4. respostas de listagem com formatos heterogêneos

## Causa Raiz

1. Crescimento incremental de rotas sem helper compartilhado de listagem.
2. Cada domínio introduziu sua própria convenção local.
3. Não havia contrato backend explícito para coleções pagináveis.

## Contrato Definido

### Query padrão

Todas as rotas listáveis desta entrega passam a aceitar, conforme aplicável:

- `limit`
- `offset`
- `sortBy`
- `sortOrder`
- filtros específicos da rota, validados por schema Zod

### Resposta padrão

As respostas passam a expor, além da coleção principal já existente:

- `total`
- `limit`
- `offset`
- `meta`
  - `limit`
  - `offset`
  - `total`
  - `returned`
  - `hasMore`
  - `sortBy`
  - `sortOrder`
  - `filters`

## Mudanças Aplicadas

### 1. Helper transversal de schema

Arquivo:

- `server/schemas/apiSchemas.ts`

Adições:

- `listSortOrderSchema`
- `createListQuerySchema()`

Objetivo:

- evitar redefinição manual de `limit`, `offset`, `sortBy` e `sortOrder`
- garantir convenção única com Zod

### 2. Helper transversal de metadados e comparação

Arquivo:

- `server/utils/listing.ts`

Adições:

- `buildListMeta()`
- `comparePrimitiveValues()`

Objetivo:

- padronizar o envelope `meta`
- permitir ordenação consistente em listas vindas de banco ou memória

### 3. btHistory com ordenação formalizada

Arquivo:

- `server/routes/btHistoryRoutes.ts`
- `server/services/btExportHistoryService.ts`

Mudanças:

- `GET /api/bt-history` agora usa contrato comum de listagem
- ordenação formalizada por `exportedAt`
- retorno inclui `meta`

Filtros cobertos:

- `projectType`
- `cqtScenario`

### 4. constants com contrato operacional completo

Arquivo:

- `server/routes/constantsRoutes.ts`
- `server/services/constantsService.ts`

Mudanças:

- `GET /api/constants/refresh-events`
- `GET /api/constants/snapshots`

Agora suportam:

- `limit`
- `offset`
- `sortBy`
- `sortOrder`
- filtros específicos

Filtros cobertos:

- `refresh-events`: `actor`, `namespace`, `success`
- `snapshots`: `actor`, `namespace`

Ajuste adicional:

- `isRefreshAuthorized()` passou a checar comprimento do token antes de `timingSafeEqual`, evitando exceção por tamanhos diferentes.

### 5. IBGE com listagem uniforme

Arquivo:

- `server/routes/ibgeRoutes.ts`

Endpoints cobertos:

- `GET /api/ibge/states`
- `GET /api/ibge/municipios/:uf`

Filtros cobertos:

- `search`

### 6. INDE features com paginação e meta

Arquivo:

- `server/routes/indeRoutes.ts`

Endpoint coberto:

- `GET /api/inde/features/:source`

Mudanças:

- suporte a `offset`
- ordenação por `id`
- retorno paginado com `meta`

### 7. Catálogos mecânicos padronizados

Arquivo:

- `server/routes/mechanicalAndAnalysisRoutes.ts`

Endpoints cobertos:

- `GET /catalog/postes`
- `GET /catalog/condutores`
- `GET /catalog/vento-coeficientes`

Filtros cobertos:

- `search`
- `materialTipo` onde aplicável

### 8. Cenários de paridade BT padronizados

Arquivo:

- `server/routes/btCalculationRoutes.ts`

Endpoint coberto:

- `GET /parity/scenarios`

Mudanças:

- paginação
- ordenação
- filtro `search`
- retorno com `meta`

## Evidência Técnica

Testes focados executados com sucesso:

- `server/tests/btHistoryRoutesValidation.test.ts`
- `server/tests/constantsRoutes.test.ts`
- `server/tests/btCalculationRoutes.test.ts`
- `server/tests/ibgeRoutesSanitization.test.ts`
- `server/tests/indeRoutesBboxValidation.test.ts`

## Critério de Aceite

1. Rotas listáveis cobertas expõem convenção única de query para paginação/ordenação.
2. Filtros específicos continuam por domínio, mas padronizados via Zod.
3. Respostas de coleção retornam `meta` com estrutura estável.
4. Compatibilidade retroativa da coleção principal foi preservada sempre que possível.

## Riscos Residuais

1. Nem toda rota de leitura simples do sistema é necessariamente uma rota paginável.
2. Alguns endpoints legados ainda podem demandar futura convergência para o mesmo contrato.
3. O typecheck backend completo do repositório já possuía erros legados fora deste escopo.

## Mitigação

1. Novo endpoint listável deve nascer usando `createListQuerySchema()`.
2. Toda resposta listável nova deve incluir `meta` via `buildListMeta()`.
3. PRs devem reprovar paginação/ordenação ad hoc sem aderência ao contrato.

## Rollback

- Reverter os commits desta entrega no branch `dev`.
