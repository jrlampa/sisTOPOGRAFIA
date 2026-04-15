# Matriz de Contrato Crítico API-E2E

## Escopo

Contrato oficial do fluxo crítico de negócio:

Projeto -> Ponto -> Persistido -> Snapshot

Endpoint oficial:

POST /api/business-kpi/:tenantId/fluxo-critico/eventos

## Regras de Segurança

- Autenticação: Bearer token via header Authorization
- Autorização de escopo: header x-contract-scope deve ser critical-flow:write

## Payload de Requisição

Campos:

- etapa: projeto | ponto | persistido | snapshot
- projetoId: string obrigatória
- pontoId: string obrigatória para etapas ponto, persistido e snapshot
- metadados: objeto opcional

Exemplo (etapa projeto):

```json
{
  "etapa": "projeto",
  "projetoId": "PRJ-2026-001",
  "metadados": {
    "origem": "e2e-suite"
  }
}
```

Exemplo (etapa ponto):

```json
{
  "etapa": "ponto",
  "projetoId": "PRJ-2026-001",
  "pontoId": "PT-0001",
  "metadados": {
    "lat": -23.5505,
    "lng": -46.6333
  }
}
```

## Semântica Oficial de Status

### 200 OK

Semântica:

- Evento aceito e transição de estado válida
- Estado atual do projeto retornado

Exemplo de resposta:

```json
{
  "ok": true,
  "status": 200,
  "code": "OK",
  "message": "Snapshot registrado com sucesso.",
  "estadoAtual": {
    "projetoId": "PRJ-2026-001",
    "pontos": [
      {
        "pontoId": "PT-0001",
        "persistido": true,
        "snapshotCriado": true
      }
    ]
  }
}
```

### 401 Unauthorized

Semântica:

- Token ausente, inválido ou malformado

Exemplo de resposta:

```json
{
  "erro": "Não autorizado"
}
```

### 403 Forbidden

Semântica:

- Token válido, mas sem escopo de escrita para contrato crítico

Exemplo de resposta:

```json
{
  "erro": "Acesso proibido para o fluxo crítico",
  "code": "FORBIDDEN_SCOPE"
}
```

### 404 Not Found

Semântica:

- Projeto não encontrado para registrar ponto
- ou ponto não encontrado para persistido/snapshot

Exemplo de resposta (projeto ausente):

```json
{
  "ok": false,
  "status": 404,
  "code": "PROJECT_NOT_FOUND",
  "message": "Projeto não encontrado para o tenant informado."
}
```

### 422 Unprocessable Entity

Semântica:

- Payload semanticamente inválido para a etapa
- ou transição inválida de estado

Casos:

- pontoId ausente em etapa que exige ponto
- snapshot antes de persistido
- projeto/ponto/snapshot duplicados

Exemplo de resposta:

```json
{
  "ok": false,
  "status": 422,
  "code": "INVALID_TRANSITION",
  "message": "Snapshot exige ponto previamente persistido."
}
```

## Sequência de Referência E2E

1. etapa projeto
2. etapa ponto
3. etapa persistido
4. etapa snapshot

Esperado: 200 em todas as etapas na ordem acima.

## Cobertura Automatizada

Validação de contrato implementada em teste de integração:

- server/tests/businessKpiRoutes.test.ts
