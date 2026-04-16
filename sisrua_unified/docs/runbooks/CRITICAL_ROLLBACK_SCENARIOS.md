# Rollback Operacional por Cenario Critico

Este runbook consolida o rollback operacional para tres cenarios criticos:

- falha de contrato
- falha de auth
- snapshot inconsistente

Objetivo: reduzir MTTR com gatilho objetivo de acionamento e passos reproduziveis.

## Escopo

Aplica-se aos fluxos criticos do backend e gate de release.
Acionamento previsto para incidents P0/P1 com risco de regressao funcional, seguranca ou integridade operacional.

## Matriz de Gatilho

| Cenario                | Gatilho de Acionamento                                                                                                           | Severidade Inicial | Acao Imediata                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| Falha de contrato      | `test:e2e:release:smoke` falha no teste de contrato de health/snapshot OU regressao 4xx/5xx fora do contrato em endpoint critico | P1                 | Bloquear deploy e iniciar rollback de aplicacao                     |
| Falha de auth          | aumento de 401/403 indevido apos release, quebra de `WWW-Authenticate` esperado, ou falha em smoke auth                          | P0/P1              | Bloquear deploy, restaurar versao anterior e validar tokens/escopos |
| Snapshot inconsistente | falha em `ci:e2e:snapshot-slo`, ausencia indevida de snapshot acima do threshold, ou restore retornando inconsistencias          | P1                 | Bloquear release e executar rollback de snapshot/catalogo           |

## Pre-condicoes de Operacao

- Acesso ao repositorio e pipeline de release.
- Permissao para atualizar trafego no Cloud Run.
- Token administrativo para endpoints de operacao (`ADMIN_TOKEN`, `CONSTANTS_REFRESH_TOKEN` quando aplicavel).

## Procedimento A — Falha de Contrato

1. Confirmar gatilho

- Validar falha no artefato de CI (`e2e-report` e `release-smoke-report.json`).
- Confirmar endpoint/etapa com desvio de contrato.

2. Conter

- Interromper promocao para ambiente seguinte.
- Se ja houve promocao, redirecionar trafego para revisao anterior estavel.

3. Rollback de aplicacao (Cloud Run)

```bash
gcloud run services update-traffic <SERVICE_NAME> \
  --region southamerica-east1 \
  --to-revisions=<PREVIOUS_REVISION>=100
```

4. Verificar

- `GET /health` responde conforme contrato.
- `npm run test:e2e:release:smoke` verde no ambiente alvo.

5. Evidencias obrigatorias

- ID da revisao revertida e revisao restaurada.
- Trecho do relatorio de contrato que disparou gatilho.

## Procedimento B — Falha de Auth

1. Confirmar gatilho

- Crescimento de 401/403 indevido para chamadas validas.
- Ausencia/erro no header `WWW-Authenticate` esperado.

2. Conter

- Bloquear promocao/deploy.
- Reverter trafego para revisao anterior estavel.

3. Validacao de auth apos rollback

```bash
curl -i http://<HOST>/metrics
curl -i -H "Authorization: Bearer <METRICS_TOKEN>" http://<HOST>/metrics
```

4. Verificar

- Sem token: 401 com challenge Bearer correto.
- Com token valido: 200.

5. Evidencias obrigatorias

- Logs com `operation_id`/`projeto_id`/`ponto_id` quando disponiveis.
- Captura dos responses pre e pos rollback.

## Procedimento C — Snapshot Inconsistente

1. Confirmar gatilho

- `npm run ci:e2e:snapshot-slo` falhou por:
  - `materializationMsP95` acima do maximo
  - `snapshotAvailability` abaixo do minimo
  - `undueMissingSnapshotRate` acima do maximo

2. Conter

- Bloquear release imediatamente.
- Nao promover artefato enquanto o gate estiver vermelho.

3. Rollback de snapshot de catalogo

- Listar snapshots:

```bash
curl -H "x-constants-refresh-token: <CONSTANTS_REFRESH_TOKEN>" \
  "http://<HOST>/api/constants/snapshots?limit=20"
```

- Restaurar snapshot valido:

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "x-constants-refresh-token: <CONSTANTS_REFRESH_TOKEN>" \
  "http://<HOST>/api/constants/snapshots/<SNAPSHOT_ID>/restore"
```

4. Verificar

- Reexecutar `test:e2e:release:smoke`.
- Reexecutar `ci:e2e:snapshot-slo` e confirmar gate verde.

5. Evidencias obrigatorias

- `snapshot-slo-report.json` antes e depois.
- ID do snapshot restaurado.

## Checklist de Encerramento

- [ ] Gatilho identificado e classificado (contrato/auth/snapshot).
- [ ] Acao de contencao executada.
- [ ] Rollback executado e validado.
- [ ] Evidencias anexadas no incidente/PR.
- [ ] Causa raiz registrada para hardening futuro.

## Referencias

- `.github/workflows/release.yml`
- `.github/workflows/quality-gates.yml`
- `docs/API_E2E_CONTRATO_CRITICO_PROJETO_PONTO.md`
- `docs/NORMATIVE_VALIDATION_CHECKLIST.md`
