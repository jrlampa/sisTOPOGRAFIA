# Aditivo de Implementacao - Design Generativo 2026

Este documento e lido em paralelo ao roadmap estrategico para acelerar a implementacao de Design Generativo sem reescrever o documento principal.

Documento base: `docs/STRATEGIC_ROADMAP_2026.md`

## Escopo deste aditivo

- Definir plano de execucao em 3 frentes: Banco de Dados, Backend, Frontend.
- Focar em rede BT com restricoes tecnicas e geoespaciais para sugestao automatica.
- Preservar o fluxo manual atual com modo comparativo "Atual x Sugerido".

## Regras tecnicas do DG

- Vao maximo por trecho: 40 m (parametrizavel para faixa 35-40 m).
- Restricoes duras de viabilidade:
  - Cenario fora de corredor viario permitido deve ser descartado.
  - Cenario com candidato dentro de edificacao deve ser descartado.
  - Cenario com violacao de CQT limite deve ser descartado.
  - Cenario com sobrecarga de trafo deve ser descartado.
  - Rede deve permanecer radial valida.
- Distancias e buffers devem ser avaliados em CRS metrico (SIRGAS/UTM), nunca em lat/lon.

## Plano de implementacao em 3 frentes

### Frente 1 - Banco de Dados (primeiro)

Objetivo: persistir cenarios DG, insumos espaciais e resultados de otimização com trilha auditavel.

1. Criar tabelas de dominio DG:
   - `dg_runs` (execucao da otimizacao)
   - `dg_candidates` (postes/posicoes candidatas)
   - `dg_scenarios` (solucoes avaliadas)
   - `dg_constraints` (resultado por restricao)
   - `dg_recommendations` (solucao final e alternativas)
2. Criar colunas de geometria para operacoes espaciais (PostGIS):
   - ponto candidato, linha de trecho, poligono de exclusao.
3. Criar indices:
   - GIST em geometrias.
   - BRIN/B-tree em `created_at`, `run_id`, `score_total`.
4. Criar trilha de auditoria:
   - hash de entrada e hash do resultado por run.
   - metadados de versao de formula CQT e versao do motor DG.
5. Criar views operacionais:
   - ranking de runs.
   - taxa de descarte por restricao.

Critorio de aceite da frente 1:

- Uma run DG completa pode ser gravada e consultada com todas as restricoes e pontuacoes.

### Frente 2 - Backend (segundo)

Objetivo: orquestrar geracao, avaliacao e ranking de cenarios DG usando o motor eletrico atual.

1. Criar servico `dgOptimizationService` com pipeline:
   - gerar candidatos.
   - aplicar restricoes espaciais duras.
   - montar cenarios.
   - avaliar eletricamente (reuso do calculo BT radial/CQT).
   - rankear e selecionar recomendacao.
2. Criar endpoint de execucao:
   - `POST /api/dg/optimize`
3. Criar endpoints de leitura:
   - `GET /api/dg/runs/:id`
   - `GET /api/dg/runs/:id/scenarios`
   - `GET /api/dg/runs/:id/recommendation`
4. Definir estrategia de busca hibrida:
   - exaustiva para realocacao de trafo em conjunto pequeno.
   - heuristica/metaheuristica para particao/multi-trafo/novos postes.
5. Definir funcao objetivo multi-criterio configuravel:
   - custo de cabos, custo de postes, custo de trafo, penalidade CQT, penalidade sobrecarga.
6. Garantir seguranca e rastreabilidade:
   - validacao de payload com schema.
   - logs de decisao por restricao.

Critorio de aceite da frente 2:

- Endpoint retorna ranking reproducivel com melhor cenario, alternativas e justificativa tecnica por penalidade/restricao.

### Frente 3 - Frontend (por fim)

Objetivo: expor DG sem quebrar o fluxo manual atual.

1. Criar modo "Otimizar Rede" no fluxo BT.
2. Implementar visualizacao comparativa:
   - "Atual" e "Sugerido" com troca rapida.
3. Exibir score e penalizacao em tempo real durante ajuste manual.
4. Exibir motivos de descarte por cenario (restricoes violadas).
5. Permitir aceite parcial:
   - aceitar somente realocacao de trafo.
   - aceitar particao sem novos postes.
   - aceitar tudo.
6. Persistir decisao no historico de projeto.

Critorio de aceite da frente 3:

- Usuario consegue executar otimizacao, comparar com cenario atual e aplicar sugestao total ou parcial sem perder controle manual.

## Ordem de entrega recomendada

1. Sprint 1: Frente 1 completa + contratos de API da Frente 2.
2. Sprint 2: Frente 2 com otimizacao em postes existentes (sem novos postes).
3. Sprint 3: Frente 2/3 com restricoes espaciais completas e UX comparativa final.

## Governanca de branch para experimentacao

Branch de trabalho para este aditivo: `feat/dg-implementation-pilot`.

Este fluxo de experimentacao pode evoluir fora de `dev` ate estabilizar os contratos. Depois, promover via PR para `dev`.
