# TEMP - Arquitetura Poste-Driven (Restart Seguro)

Status: temporário para guiar reimplementação incremental sem regressão de frontend.
Data: 2026-04-20

## 1) Objetivo Arquitetural

Tornar o poste (PoleNode) o Aggregate Root único do domínio de rede.
Tudo físico no poste deve morar no mesmo agregado:
- estruturas BT
- estruturas MT
- equipamentos
- ramais
- status físico e verificação

Arestas (NetworkEdge) conectam postes e carregam somente conectividade e condutores.

## 2) Princípios de Implantação

- Backend + banco primeiro (fonte da verdade).
- Frontend só consome dados estáveis e compatíveis.
- Migração por camadas, com dual-read/dual-write temporário controlado.
- Nenhuma mudança visual no mapa antes de testes de regressão.
- Feature flags para ativar cada etapa.

## 3) Modelo Alvo (Canônico)

### 3.1 PoleNode (canônico)
Campos mínimos recomendados:
- id
- lat, lng
- title
- hasBt, hasMt
- btStructures (si1..si4)
- mtStructures (n1..n4)
- equipments[]
- ramais[]
- poleSpec
- conditionStatus
- verified
- nodeChangeFlag
- circuitBreakPoint
- generalNotes

### 3.2 NetworkEdge (canônico)
- id
- fromPoleId
- toPoleId
- lengthMeters
- btConductors[]
- mtConductors[]
- edgeChangeFlag
- verified

### 3.3 NetworkTopology (canônico)
- poles: PoleNode[]
- edges: NetworkEdge[]
- transformers[] (separado por regra de domínio atual)

## 4) Estratégia Backend + Banco (prioridade)

### Fase B1 - Banco sem quebra
- Criar novas colunas/tabelas canônicas para PoleNode/NetworkEdge.
- Não remover legado nesta fase.
- Backfill idempotente dos dados BT/MT legados para estrutura canônica.
- Índices para lookup por pole_id e relação de arestas.

Critérios de aceite:
- Migração roda N vezes sem alterar resultado final.
- Contagem de polos/arestas consistente com legado.

### Fase B2 - API dual-read
- Endpoints passam a ler prioritariamente do canônico.
- Fallback explícito para legado enquanto cobertura não é 100%.
- Adicionar campo de diagnóstico (source: canonical|legacy) para auditoria.

Critérios de aceite:
- Respostas equivalentes para casos críticos BT/MT.
- Sem alteração de payload consumido pelo frontend atual.

### Fase B3 - API dual-write controlado
- Escrita entra no canônico e replica no legado (temporário).
- Logging de divergência canônico vs legado.
- Job de reconciliação diária.

Critérios de aceite:
- Divergência abaixo do threshold definido.
- Sem erro funcional em operações de edição existentes.

## 5) Estratégia Frontend (lenta e segura)

### Fase F1 - Sem alteração visual
- Introduzir adaptadores de leitura (mappers) para consumir canônico.
- Manter componentes atuais de marcador/popup sem mudanças de UX.
- Proibir mudança de ícone/cor/shape nesta fase.

### Fase F2 - Feature flag por camada
- Flag 1: leitura de polos canônicos no estado interno.
- Flag 2: leitura de arestas canônicas.
- Flag 3: popup unificado (somente após validação visual).

### Fase F3 - Remoção de legado
- Após estabilidade comprovada, remover bridge legada.
- Marcar tipos legados como deprecated antes de excluir.

## 6) Regras Anti-Regressão de Mapa

- Marcador BT padrão deve permanecer círculo azul (baseline atual).
- Sem anel/overlay visual novo sem validação explícita.
- Popup só muda com aprovação manual em preview.
- Teste visual obrigatório em:
  - polo simples BT
  - polo com trafo
  - polo crítico
  - fluxo add-edge e drag

## 7) Checklist Operacional do Restart

1. Criar branch de restart a partir do estado pós-rollback.
2. Implementar apenas Fase B1.
3. Rodar migrações + auditoria de consistência.
4. Implementar Fase B2 (read canônico com fallback).
5. Validar preview sem mudança de UX.
6. Implementar Fase B3.
7. Só então iniciar Fase F1 no frontend.

## 8) Artefatos que devem existir no próximo ciclo

- migration SQL canônica + script de backfill idempotente
- relatório de reconciliação canônico vs legado
- matriz de testes de regressão visual do mapa
- feature flags documentadas (backend/frontend)

---
Nota: este arquivo é temporário e deve ser removido após estabilização da migração Poste-Driven.
