# SLO Definitions — sisTOPOGRAFIA (sisRUA Unified)

> **Roadmap Item 17 [T1] — SRE/Operação 24x7 com SLOs**
>
> Documento vivo. Toda alteração deve passar por revisão do Tech Lead e ser comunicada
> ao cliente via canal de transparência operacional antes de entrar em vigor.

**Versão:** 1.0.0
**Data de emissão:** 2026-04-14
**Revisão programada:** 2026-07-14 (trimestral)
**Proprietário:** Equipe SRE / Tech Lead

---

## Sumário

1. [Glossário e Premissas](#1-glossário-e-premissas)
2. [SLO 1 — Geração DXF](#2-slo-1--geração-dxf)
3. [SLO 2 — Cálculo BT / Paridade CQT](#3-slo-2--cálculo-bt--paridade-cqt)
4. [SLO 3 — Disponibilidade da API](#4-slo-3--disponibilidade-da-api)
5. [SLO 4 — APIs Externas (IBGE / INDE / OSM / TOPODATA)](#5-slo-4--apis-externas-ibge--inde--osm--topodata)
6. [Cálculo de Error Budget (janela 30 dias)](#6-cálculo-de-error-budget-janela-30-dias)
7. [Burn Rate Alerts](#7-burn-rate-alerts)
8. [Nomes de Métricas Prometheus](#8-nomes-de-métricas-prometheus)
9. [Revisão e Exclusões](#9-revisão-e-exclusões)

---

## 1. Glossário e Premissas

| Termo | Definição |
|---|---|
| **SLI** (Service Level Indicator) | Medida quantitativa de um aspecto do comportamento do serviço (ex.: taxa de sucesso, latência p95). |
| **SLO** (Service Level Objective) | Objetivo acordado para um SLI em uma janela de tempo determinada. |
| **SLA** (Service Level Agreement) | Contrato externo baseado em SLOs; penalidades em `SLA_CONTRATOS.md`. |
| **Error Budget** | Margem tolerável de falhas = `1 − SLO target`. Consumido por erros reais. |
| **Burn Rate** | Taxa na qual o error budget está sendo consumido. BR = 1 significa consumo exatamente no ritmo do budget. |
| **Janela de avaliação** | 30 dias corridos (rolling window). |
| **Bom evento** | Requisição ou cálculo que satisfaz o critério de sucesso do SLI. |
| **Mau evento** | Requisição ou cálculo que viola o critério. |
| **p95 / p99** | Percentil 95 / 99 da distribuição de latências no período. |

### Prefixo de métricas Prometheus

O serviço usa o prefixo configurável `METRICS_PREFIX` (padrão: `sisrua`). Todas as
métricas citadas neste documento assumem o prefixo `sisrua_`. Ajuste se o ambiente
usar um prefixo diferente.

```
METRICS_PREFIX=sisrua   # valor padrão em produção
```

---

## 2. SLO 1 — Geração DXF

### Descrição do Fluxo

O usuário submete uma requisição de geração topográfica (coordenadas + polígono).
O backend cria uma tarefa no Google Cloud Tasks, o worker Python executa o motor
geoespacial (OSMnx + ezdxf + TOPODATA), e o arquivo `.dxf` resultante fica disponível
para download.

### SLIs Definidos

| # | SLI | Descrição |
|---|-----|-----------|
| DXF-SLI-01 | Taxa de sucesso | `(requisições_dxf_bem_sucedidas / total_requisições_dxf)` na janela de 30 dias. |
| DXF-SLI-02 | Latência p95 end-to-end | Percentil 95 do tempo entre criação da tarefa e disponibilidade do arquivo. |

### SLOs

| SLO | Target | Janela |
|-----|--------|--------|
| **DXF-SLO-01** Taxa de sucesso | **≥ 99,5 %** | 30 dias rolling |
| **DXF-SLO-02** Latência p95 | **< 120 s** | 30 dias rolling |

### Critério de Bom Evento

- **DXF-SLI-01 — bom:** HTTP 200 com arquivo `.dxf` válido (tamanho > 0 bytes,
  conteúdo inicia com `0\nSECTION`). Qualquer erro HTTP 4xx/5xx ou timeout de worker
  é mau evento.
- **DXF-SLI-02 — bom:** Tempo total ≤ 120 s medido do instante de criação da Cloud
  Task até o instante de gravação do arquivo em disco (campo `completed_at` do job).

### Exclusões (não contam como mau evento)

- Janelas de manutenção programadas (domingo 02:00–04:00 BRT).
- Falhas originadas exclusivamente por APIs externas com circuit breaker aberto
  (ver SLO 4), desde que o fallback tenha sido acionado e o erro retornado ao cliente
  com código `503` e cabeçalho `X-Fallback: true`.
- Requisições de IPs em lista de bloqueio (rate limit).

---

## 3. SLO 2 — Cálculo BT / Paridade CQT

### Descrição do Fluxo

O usuário submete parâmetros elétricos (distância, carga, cabos, trafos, disjuntores).
O servidor executa a planilha de cálculo BT, gera o sumário CQT e compara com os
valores de referência do workbook CQT Simplificado para verificar paridade.

### SLIs Definidos

| # | SLI | Descrição |
|---|-----|-----------|
| BT-SLI-01 | Corretude CQT | `(cálculos_com_paridade_aprovada / total_cálculos_bt)` na janela de 30 dias. |
| BT-SLI-02 | Latência p95 | Percentil 95 do tempo de execução do cálculo BT completo. |

### SLOs

| SLO | Target | Janela |
|-----|--------|--------|
| **BT-SLO-01** Corretude CQT | **≥ 99,9 %** | 30 dias rolling |
| **BT-SLO-02** Latência p95 | **< 5 s** | 30 dias rolling |

### Critério de Bom Evento

- **BT-SLI-01 — bom:** O campo `parityPassed` do payload de resposta é `true` e
  nenhum dos campos `dmdi`, `p31`, `p32`, `k10QtMttr` apresenta desvio acima de
  0,1 % em relação ao valor de referência do workbook.
- **BT-SLI-02 — bom:** Tempo de processamento ≤ 5 s medido pelo middleware de
  `requestMetrics` (campo `duration_ms` no log).

### Nota sobre Paridade CQT

O workbook de referência oficial é `CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx`.
O arquivo `docs/CQT_PARITY_EXPECTED_OVERRIDES.json` documenta as divergências
intencionais aprovadas que NÃO contam como falha de paridade.

---

## 4. SLO 3 — Disponibilidade da API

### Descrição do Fluxo

Qualquer cliente (frontend, integração, monitoramento externo) fazendo requisição
ao endpoint `/health` do servidor Express. Este endpoint verifica conectividade com
dependências internas e retorna `{ status: "online" }` com HTTP 200.

### SLIs Definidos

| # | SLI | Descrição |
|---|-----|-----------|
| API-SLI-01 | Uptime | `(minutos_com_health_200 / total_minutos_monitorados)` na janela de 30 dias. |
| API-SLI-02 | Latência p95 geral | Percentil 95 de todas as requisições HTTP (exceto `/metrics`). |

### SLOs

| SLO | Target | Janela |
|-----|--------|--------|
| **API-SLO-01** Uptime | **≥ 99,5 %** | 30 dias rolling |
| **API-SLO-02** Latência p95 geral | **< 2 s** | 30 dias rolling |

### Método de Coleta

- Probe externo (ex.: UptimeRobot, Grafana Synthetic Monitoring) fazendo GET
  `https://<CLOUD_RUN_BASE_URL>/health` a cada **60 s**.
- Resultado considerado disponível se: HTTP 200 recebido em ≤ 10 s.
- Janela de indisponibilidade: ≥ 2 probes consecutivas com falha.

### Exclusões

- Janelas de manutenção programadas (domingo 02:00–04:00 BRT).
- Cold starts de Cloud Run com duração < 30 s (primeira requisição após escalonamento
  de zero instâncias).

---

## 5. SLO 4 — APIs Externas (IBGE / INDE / OSM / TOPODATA)

As APIs externas não são controladas pelo sistema, portanto não possuem SLO de
disponibilidade próprio. Em vez disso, definimos **alertas de degradação** e
**circuit breaker** para proteger a experiência do usuário.

### APIs Monitoradas

| API | Endpoint base | Dado fornecido |
|-----|--------------|---------------|
| IBGE Malhas | `https://servicodados.ibge.gov.br/api/v3/` | Malhas territoriais, geocoding reverso |
| INDE WFS/WMS | `https://geoservicos.inde.gov.br/` | Dados geoespaciais oficiais |
| OSM (Nominatim) | `https://nominatim.openstreetmap.org/` | Geocoding, busca de endereços |
| OSM (Overpass) | `https://overpass-api.de/api/` | Dados de feições OSM |
| TOPODATA (INPE) | `http://www.dsr.inpe.br/topodata/` | Elevação 30 m (MDE) |

### Limiares de Alerta

| Condição | Ação |
|----------|------|
| Timeout > **10 s** em qualquer requisição | Alerta nível Warning no Prometheus Alertmanager |
| **3 falhas consecutivas** na mesma API | Circuit breaker abre; fallback ativado |
| Circuit breaker aberto por **> 5 min** | Alerta nível Critical; página o on-call |

### Política de Fallback

| API com falha | Fallback |
|---------------|---------|
| IBGE | Cache local de malhas (TTL 24 h); se expirado, retorna dados parciais com aviso |
| INDE | Fallback para OSM para feições equivalentes |
| OSM Nominatim | Fallback para IBGE geocoding reverso |
| OSM Overpass | Cache local TTL 1 h; se expirado, erro 503 com mensagem explícita |
| TOPODATA | Fallback para `open-elevation` ou valor de elevação nulo com flag `elevation_source: "unavailable"` |

### Timeouts Configurados

```bash
# Tempo máximo de espera por API externa (ms)
IBGE_TIMEOUT_MS=10000
INDE_TIMEOUT_MS=10000
OSM_TIMEOUT_MS=10000
TOPODATA_TIMEOUT_MS=15000   # maior por ser download de GeoTIFF
```

---

## 6. Cálculo de Error Budget (janela 30 dias)

### Fórmula Geral

```
Minutos na janela        = 30 × 24 × 60 = 43.200 min
Error budget (minutos)   = 43.200 × (1 − SLO_target)
Budget consumido (min)   = minutos de indisponibilidade/erro observados
Budget restante (%)      = ((budget_total − budget_consumido) / budget_total) × 100
```

### Tabela de Error Budget por SLO

| SLO | Target | Budget total (30d) | Alertar quando restante < |
|-----|--------|--------------------|--------------------------|
| DXF-SLO-01 (taxa sucesso) | 99,5 % | 216 min de falhas | 50 % (≤ 108 min restantes) |
| DXF-SLO-02 (p95 < 120 s) | 99,5 % | 216 min fora do p95 | 50 % |
| BT-SLO-01 (corretude 99,9 %) | 99,9 % | 43,2 min de erros | 50 % (≤ 21,6 min) |
| BT-SLO-02 (p95 < 5 s) | 99,5 % | 216 min | 50 % |
| API-SLO-01 (uptime 99,5 %) | 99,5 % | 216 min offline | 50 % |

> **Política de congelamento de releases:** Quando o error budget de qualquer SLO
> cair abaixo de **10 %** na janela corrente, nenhuma release não-emergencial pode
> ser realizada até o budget se recuperar acima de 20 %.

---

## 7. Burn Rate Alerts

Os alertas de burn rate detectam consumo acelerado do error budget **antes** que o
SLO seja violado. São expressões PromQL a serem configuradas no Alertmanager.

### Regras de Burn Rate (Prometheus Alerting Rules)

```yaml
# arquivo: alerts/slo_burn_rate.yml
groups:
  - name: sisrua.slo.burn_rate
    rules:

      # ── DXF Availability ────────────────────────────────────────────────────
      - alert: SLO_DXF_BurnRate_Fast
        expr: |
          (
            1 - (
              rate(sisrua_sli_requests_total{flow="dxf_generation",outcome="success"}[1h])
              /
              rate(sisrua_sli_requests_total{flow="dxf_generation"}[1h])
            )
          ) > (14.4 * 0.005)
        for: 2m
        labels:
          severity: critical
          slo: dxf_availability
        annotations:
          summary: "DXF burn rate alto (janela 1h) — budget pode esgotar em < 2 dias"
          runbook: "https://docs.sisrua/sre/RUNBOOKS#queue-dxf-backlog"

      - alert: SLO_DXF_BurnRate_Slow
        expr: |
          (
            1 - (
              rate(sisrua_sli_requests_total{flow="dxf_generation",outcome="success"}[6h])
              /
              rate(sisrua_sli_requests_total{flow="dxf_generation"}[6h])
            )
          ) > (6 * 0.005)
        for: 15m
        labels:
          severity: warning
          slo: dxf_availability
        annotations:
          summary: "DXF burn rate elevado (janela 6h)"

      # ── API Availability ─────────────────────────────────────────────────────
      - alert: SLO_API_Uptime_BurnRate_Fast
        expr: |
          sisrua_slo_error_budget_remaining_pct{slo_name="dxf_availability"} < 10
        for: 5m
        labels:
          severity: critical
          slo: api_uptime
        annotations:
          summary: "Error budget API uptime < 10 % — congelamento de releases ativado"

      # ── BT Correctness ───────────────────────────────────────────────────────
      - alert: SLO_BT_Correctness_Any_Failure
        expr: |
          increase(sisrua_sli_requests_total{flow="bt_calculation",outcome="error"}[5m]) > 0
        for: 0m
        labels:
          severity: warning
          slo: bt_correctness
        annotations:
          summary: "Falha de paridade CQT detectada — investigar imediatamente"
          runbook: "https://docs.sisrua/sre/RUNBOOKS#worker-python-oom"

      # ── DXF Latency p95 ──────────────────────────────────────────────────────
      - alert: SLO_DXF_Latency_P95_Breach
        expr: |
          histogram_quantile(0.95,
            rate(sisrua_dxf_generation_duration_seconds_bucket[10m])
          ) > 120
        for: 5m
        labels:
          severity: warning
          slo: dxf_latency_p95
        annotations:
          summary: "Latência p95 de geração DXF excedeu 120s"
          runbook: "https://docs.sisrua/sre/RUNBOOKS#queue-dxf-backlog"

      # ── External API Timeout ─────────────────────────────────────────────────
      - alert: ExternalAPI_Timeout_Warning
        expr: |
          increase(sisrua_external_api_timeout_total[5m]) > 0
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Timeout em API externa detectado"

      - alert: ExternalAPI_CircuitBreaker_Open
        expr: |
          sisrua_external_api_circuit_breaker_open == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker aberto para API externa {{ $labels.api }}"
          runbook: "https://docs.sisrua/sre/RUNBOOKS#api-connection-loss"
```

---

## 8. Nomes de Métricas Prometheus

Todas as métricas usam o prefixo `sisrua_` (configurável via `METRICS_PREFIX`).

### Métricas de SLO/SLI — já implementadas

| Nome da métrica | Tipo | Labels | Descrição |
|-----------------|------|--------|-----------|
| `sisrua_slo_compliance` | Gauge | `slo_name` | 1 = dentro do objetivo, 0 = violado |
| `sisrua_slo_error_budget_remaining_pct` | Gauge | `slo_name` | Budget restante 0–100 % |
| `sisrua_sli_requests_total` | Counter | `flow`, `outcome` | Requisições SLI por fluxo e resultado |
| `sisrua_dxf_generation_duration_seconds` | Histogram | — | Latência end-to-end de geração DXF |
| `sisrua_dxf_requests_total` | Counter | `result` | Resultados DXF: `cache_hit`, `generated`, `failed` |
| `sisrua_job_queue_wait_seconds` | Histogram | — | Tempo de espera na fila |
| `sisrua_dxf_queue_pending_tasks` | Gauge | — | Tarefas DXF pendentes |
| `sisrua_dxf_queue_processing_tasks` | Gauge | — | Tarefas DXF em processamento |
| `sisrua_http_requests_total` | Counter | `method`, `route`, `status_code` | Total de requisições HTTP |
| `sisrua_http_request_duration_seconds` | Histogram | `method`, `route` | Latência HTTP |

### Métricas a implementar (backlog SRE)

| Nome da métrica | Tipo | Labels | Descrição |
|-----------------|------|--------|-----------|
| `sisrua_external_api_timeout_total` | Counter | `api` | Timeouts por API externa |
| `sisrua_external_api_circuit_breaker_open` | Gauge | `api` | 1 = CB aberto, 0 = fechado |
| `sisrua_external_api_request_duration_seconds` | Histogram | `api` | Latência de chamadas externas |
| `sisrua_bt_calculation_duration_seconds` | Histogram | — | Latência do cálculo BT |
| `sisrua_bt_parity_result_total` | Counter | `result` | Paridade CQT: `passed`, `failed` |
| `sisrua_python_worker_memory_bytes` | Gauge | `worker_id` | Uso de memória do worker Python |

### Labels padrão para `slo_name`

```
dxf_generation_p95    → DXF-SLO-02
dxf_availability      → DXF-SLO-01
bt_correctness        → BT-SLO-01
bt_latency_p95        → BT-SLO-02
api_uptime            → API-SLO-01
api_p99               → API-SLO-02
job_queue_wait_p99    → (interno, não contratual)
```

---

## 9. Revisão e Exclusões

### Eventos excluídos do cômputo de SLO

1. **Manutenção programada** — todo domingo 02:00–04:00 BRT (2 h/semana).
   Comunicação prévia obrigatória via e-mail/status page com ≥ 48 h de antecedência.
2. **Força maior** — quedas de energia em data centers, incidentes na infraestrutura
   Google Cloud com RCA público, desastres naturais.
3. **Abusos do cliente** — requisições acima dos limites de rate limit documentados.
4. **Versão beta / canary** — funcionalidades explicitamente marcadas como beta não
   têm SLO contratual até promoção para GA.

### Processo de revisão de SLO

- Revisão trimestral obrigatória pelo Tech Lead + representante do cliente.
- Qualquer redução de target exige aprovação formal e comunicação com 30 dias
  de antecedência.
- Toda elevação de target deve ser validada com dados históricos de pelo menos
  90 dias antes de ser incorporada ao contrato.

---

*Documento gerado automaticamente a partir da análise do código-fonte em 2026-04-14.*
*Manter em sincronia com `server/services/metricsService.ts` (constante `SLO_TARGETS`).*
