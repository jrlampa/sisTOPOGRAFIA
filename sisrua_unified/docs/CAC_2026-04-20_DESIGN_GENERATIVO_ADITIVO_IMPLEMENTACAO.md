# CAC - Design Generativo com Aditivo Operacional em 3 Frentes

## Identificacao

- Data: 2026-04-20
- Tipo: Governanca de Implementacao (Arquitetura + Produto)
- Escopo: Planejamento de execucao DG sem reescrita do roadmap principal
- Branch: feat/dg-implementation-pilot

## Contexto

A equipe definiu implementar Design Generativo para rede BT com base em postes existentes, demandas por ponto e restricoes espaciais ligadas ao OSM.

O roadmap estrategico principal ja contem os direcionadores de negocio e maturidade, mas faltava um documento curto e operacional com sequencia de implementacao para nao dispersar as entregas.

## Causa Raiz

1. Alto risco de perda de foco ao implementar DG em paralelo com backlog enterprise.
2. Ausencia de ordem unica para as frentes de execucao.
3. Falta de ponte formal entre estrategia (roadmap) e execucao tecnica (tarefas).

## Mudancas Aplicadas

1. Criado aditivo paralelo ao roadmap:
   - `docs/DG_IMPLEMENTATION_ADDENDUM_2026.md`
2. Acrescida referencia curta no roadmap principal:
   - `docs/STRATEGIC_ROADMAP_2026.md`
3. Atualizado contexto persistente (RAG):
   - `RAG/MEMORY.md`

## Decisao de Execucao

Implementar em 3 frentes obrigatorias e sequenciais:

1. Banco de Dados (primeiro)
   - persistencia de runs, cenarios e restricoes
   - base auditavel para reproducao e comparacao
2. Backend (segundo)
   - motor de orquestracao DG + avaliacao eletrica + ranking
3. Frontend (terceiro)
   - modo comparativo Atual x Sugerido e aceite parcial/total

## Critero de Aceite

1. Existe documento paralelo oficial de execucao DG.
2. Roadmap principal foi alterado com minimo impacto (apenas referencia ao aditivo).
3. RAG foi atualizado com a diretriz operacional e branch de experimentacao.
4. Ordem de implementacao em 3 frentes ficou explicita e auditavel.

## Riscos Residuais

1. Divergencia entre aditivo e implementacao real se backlog nao seguir ordem.
2. Acoplamento antecipado de frontend sem contratos estaveis de backend.

## Mitigacao

1. Gate de PR: validar aderencia ao aditivo DG antes de merge em `dev`.
2. Congelar mudancas de UX DG ate contratos de DB/API estarem estabilizados.

## Rollback

- Reverter os commits desta CAC na branch de experimentacao.
- Manter o roadmap principal sem o bloco de referencia ao aditivo, se necessario.
