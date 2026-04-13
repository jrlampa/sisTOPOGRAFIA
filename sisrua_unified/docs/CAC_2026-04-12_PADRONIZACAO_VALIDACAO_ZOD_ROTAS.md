# CAC - Padronização de Validação Zod em Rotas Backend

## Identificação

- Data: 2026-04-12
- Tipo: Qualidade + Segurança de API (Backend)
- Escopo: Rotas Express com validação de entrada
- Branch: dev

## Contexto

Havia validação Zod em parte das rotas, porém com lacunas e validações manuais dispersas em endpoints críticos. Isso gerava inconsistência de respostas e maior custo de manutenção.

## Causa Raiz

1. Crescimento incremental de rotas sem padrão obrigatório unificado.
2. Mistura de validação manual (`if`, `parseInt`, `typeof`) com validação schema-driven.
3. Falta de contrato explícito por rota para `query`, `params` e `body`.

## Mudanças Aplicadas

1. Migração para Zod de rotas com validação manual relevante:

- `server/routes/btHistoryRoutes.ts`
- `server/routes/constantsRoutes.ts`
- `server/routes/elevationRoutes.ts` (`POST /batch`)
- `server/routes/ibgeRoutes.ts`
- `server/routes/indeRoutes.ts`
- `server/routes/jobRoutes.ts`
- `server/routes/mechanicalAndAnalysisRoutes.ts`

2. Padronização de retorno de erro de entrada inválida:

- HTTP 400
- payload com `error` + `details` de issues do schema quando aplicável

3. Consolidação de validações de parâmetros sensíveis:

- `:id`, `:source`, `:uf`
- bbox (`west/south/east/north`)
- limites e paginação (`limit`, `offset`)
- payloads de cálculo mecânico e cenários

## Evidência Técnica

- Verificação de erros nos arquivos alterados (sem erros de editor nos arquivos migrados).
- Contratos de entrada agora definidos de forma declarativa por endpoint.

## Critério de Aceite

1. Rotas críticas listadas sem validação manual dispersa como mecanismo primário.
2. Contrato de entrada por rota definido em schema Zod.
3. Erro de entrada inválida padronizado (HTTP 400 + detalhes).

## Riscos Residuais

1. Rotas sem payload/param sensível permanecem sem schema por não haver entrada a validar.
2. Trechos legados fora do escopo desta entrega podem manter validação híbrida.

## Mitigação

1. Novo endpoint com entrada obrigatória deve nascer com schema Zod.
2. Revisão de PR deve reprovar validação manual onde schema for aplicável.

## Rollback

- Reverter o commit desta CAC no branch `dev`.
