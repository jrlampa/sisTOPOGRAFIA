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

## Plano de implementacao por etapas - DG Wizard Completo

Objetivo desta secao:

- Transformar o DG de "otimizacao pontual" para "projeto completo guiado".
- Permitir execucao com postes projetados (incluindo clandestino), sem depender de trafo previamente definido.
- Coletar dados minimos via wizard e automatizar: demanda, trafo, conexoes, esforco e BT.

### Estado atual (baseline)

- Ja existe botao/fluxo DG, recomendacao e aceite parcial.
- Ja existe motor de candidatos, constraints, score e ranking.
- Gap principal: entrada ainda pressupoe trafo existente e nao guia o usuario em parametros de projeto completo.

### Etapa 0 - Preparacao e contratos (curta)

Objetivo: travar contratos para evitar retrabalho entre frontend/backend.

1. Definir versao de contrato `DG Wizard v1` para payload de execucao guiada.
2. Adicionar feature flag `DG_WIZARD_FULL_MODE`.
3. Definir dicionario de parametros minimos:
   - clientesPorPoste
   - areaClandestinaM2
   - demandaMediaClienteKva
   - fatorSimultaneidade
   - faixaKvaTrafoPermitida
   - maxSpanMeters

Criterio de aceite:

- Contrato versionado publicado e validado em schema.

### Etapa 1 - Wizard de entrada (Frontend)

Objetivo: ao clicar em "Otimizar Rede", abrir fluxo guiado quando houver rede projetada.

1. Gate de entrada no botao DG:
   - Se detectar postes projetados, abrir modal wizard.
   - Se nao detectar, manter fluxo atual.
2. Passos do wizard:
   - Passo A: quantidade de clientes por ponto (edicao em lote + ajustes por poste).
   - Passo B: area clandestina e parametros de densidade.
   - Passo C: parametros tecnicos (vmax, limite CQT, limites de utilizacao).
   - Passo D: revisao final e executar.
3. Validacoes de UX:
   - bloqueio de avancar com campos obrigatorios invalidos.
   - resumo consolidado antes de executar.

Criterio de aceite:

- Usuario executa DG sem preencher dados manualmente fora do wizard.

### Etapa 2 - Motor DG Full Project (Backend)

Objetivo: suportar execucao completa sem trafo inicial obrigatorio.

1. Expandir endpoint `POST /api/dg/optimize` (ou criar `POST /api/dg/wizard-optimize`) para aceitar entrada guiada.
2. Pipeline de calculo:
   - transformar clientes/area em demanda por poste.
   - gerar candidatos de trafo (postes existentes + centro de carga + grade opcional).
   - dimensionar trafo (kVA) dentro da faixa permitida.
   - montar conexoes radiais entre postes e trafo.
   - avaliar CQT, utilizacao, comprimento total e score.
3. Saida tecnica:
   - melhor cenario + alternativas.
   - justificativas de descarte.
   - memoria de calculo resumida (auditoria).

Criterio de aceite:

- DG retorna recomendacao viavel para caso sem trafo inicial, com rastreabilidade.

### Etapa 3 - Aplicacao automatica do projeto (Frontend + Estado)

Objetivo: aplicar rede sugerida no mapa com seguranca operacional.

1. Aplicar no estado:
   - inserir/realocar trafo.
   - criar/atualizar conexoes de condutor.
   - atualizar flags de mudanca (`new`/`replace`).
2. Preservar comparativo "Atual x Sugerido" antes do aceite definitivo.
3. Permitir:
   - aplicar tudo.
   - aplicar so trafo.
   - descartar.

Criterio de aceite:

- Projeto sugerido pode ser aplicado sem quebrar fluxo manual existente.

### Etapa 4 - Robustez, testes e rollout

Objetivo: liberar com seguranca em `dev` e depois promover para fluxo padrao.

1. Testes automatizados:
   - unitarios de contrato e calculo.
   - integracao da API DG wizard.
   - componente wizard (fluxo feliz + validacoes).
2. Testes de regressao funcional:
   - cenarios com/sem trafo inicial.
   - cenarios clandestino com area informada.
3. Rollout:
   - ativacao inicial por feature flag.
   - monitoramento de taxa de sucesso e tempos.

Criterio de aceite:

- Fluxo DG wizard estavel com testes passando e regressao controlada.

## Backlog tecnico objetivo por etapa

### Frontend

- Criar componente `DgWizardModal` com passos e validacoes.
- Integrar wizard ao painel DG atual sem remover fluxo legado.
- Exibir memoria de calculo resumida no resultado.

### Backend

- Evoluir schema de entrada e validacao zod.
- Implementar derivacao de demanda por poste para modo guiado.
- Implementar dimensionamento de trafo por faixa de kVA.
- Persistir metadados do wizard na run DG para auditoria.

### Dados e auditoria

- Registrar input versionado do wizard e hash.
- Registrar decisao aplicada (all/trafo-only/discard).

## Metricas de sucesso

- Tempo medio para gerar projeto BT completo via DG <= 90 s (casos tipicos).
- Taxa de runs com cenario viavel >= 80% em base de homologacao.
- Reducao de interacoes manuais para fechar proposta inicial de rede.

## Governanca de branch para experimentacao

Branch de trabalho para este aditivo: `feat/dg-implementation-pilot`.

Este fluxo de experimentacao pode evoluir fora de `dev` ate estabilizar os contratos. Depois, promover via PR para `dev`.
