# Contrato estável de topologia canônica

## Objetivo

Este documento fixa o contrato transitório entre backend e frontend durante a migração Poste-Driven.
Enquanto os consumidores visuais ainda dependem de `btTopology` e `mtTopology`, o backend e o estado interno do app passam a reconhecer `canonicalTopology` como fonte estável do domínio de rede.

## Backend

Leitura canônica exposta por [server/repositories/canonicalTopologyRepository.ts](../server/repositories/canonicalTopologyRepository.ts).

### Interface principal

```ts
interface TopologyReadResult {
  topology: CanonicalNetworkTopology;
  source: "canonical" | "legacy";
  poleCount: number;
  edgeCount: number;
}
```

### Regras de resolução

1. `readTopology(taskId?, forceLegacy?)`
   Lê `canonical_poles` e `canonical_edges` quando houver dados e `forceLegacy !== true`.
2. Se o canônico estiver vazio e `taskId` existir, faz fallback para `dxf_tasks.payload.btContext/mtContext`.
3. `readTopologyForTenant(tenantId, taskId?)`
   Resolve `canonical_topology_read` por tenant e, na ausência de override, usa `config.canonicalTopologyRead`.
4. Quando `taskId` é informado e a leitura canônica vence, o repositório compara contagens de legado e canônico e registra `warn` em caso de divergência.

## Frontend

Estado global em [src/types.ts](../src/types.ts) agora suporta os três níveis abaixo:

```ts
interface GlobalState {
  btTopology?: BtTopology;
  mtTopology?: MtTopology;
  canonicalTopology?: CanonicalNetworkTopology;
  canonicalTopologyMeta?: {
    source: "legacy-derived" | "canonical-hydrated" | "empty";
    divergenceWarnings: string[];
    lastSynchronizedAt: string;
  };
}
```

### Invariantes

1. Se existir somente legado, `canonicalTopology` é derivado automaticamente.
2. Se existir somente `canonicalTopology`, o app reidrata `btTopology` e `mtTopology` para compatibilidade.
3. Se existirem ambos, legado continua sendo a fonte operacional no frontend atual e o canônico é recalculado a partir dele.
4. Transformadores continuam fora do canônico nesta fase e permanecem em `btTopology.transformers`.

## Fora de escopo nesta fase

1. Renderização direta de marcadores BT/MT a partir do canônico.
2. Popup/editor usando exclusivamente `canonicalTopology`.
3. Remoção dos tipos legados de [src/types.ts](../src/types.ts).
