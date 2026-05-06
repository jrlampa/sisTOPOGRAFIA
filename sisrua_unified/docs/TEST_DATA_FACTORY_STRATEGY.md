# Estratégia Padronizada de Dados de Teste (Factories e Fixtures)

Objetivo: reduzir manutenção de cenários E2E e aumentar legibilidade, com dados de teste consistentes para fluxos críticos.

## Escopo

- E2E: usar factories para montagem de requests e normalização de contratos.
- Unitário/Integração backend: usar fixtures para dados canônicos e builders para variações de cenário.
- Sem alteração de interface: a estratégia atua apenas em testes e utilitários de teste.

## Estrutura padrão

- `e2e/fixtures/`: dados estáticos e contratos esperados.
- `e2e/factories/`: funções para montar payloads, headers, normalizações e fallback auth.
- `server/tests/fixtures/`: fixtures estáticos do domínio backend.
- Builders locais só quando o cenário for altamente específico; caso contrário, mover para factory compartilhada.

## Convenções

- Nome de fixture: `*fixtures.ts` com objetos imutáveis e tipados.
- Nome de factory: `*factory.ts` com funções puras e sem efeitos colaterais.
- Evitar JSON inline grande em specs.
- Fallback de autenticação de E2E deve ficar em factory compartilhada, não duplicado por teste.
- Para snapshots de contrato, sempre normalizar payload antes de comparar.

## Implementação atual (institucionalizada)

- Fixture crítica compartilhada:
  - `e2e/fixtures/critical-flow-fixtures.ts`
- Factory crítica compartilhada:
  - `e2e/factories/critical-flow-factory.ts`
- Adoção inicial em cenários críticos:
  - `e2e/release-smoke.spec.ts`
  - `e2e/constants-observability.spec.ts`

## Checklist para novos testes

- O cenário usa fixture compartilhada quando houver contrato recorrente.
- O cenário usa factory para auth/token fallback e normalização de resposta.
- O teste não duplica lógica de URL base e headers operacionais.
- O teste prioriza leitura do fluxo de negócio (arranjo curto, assertivas claras).
