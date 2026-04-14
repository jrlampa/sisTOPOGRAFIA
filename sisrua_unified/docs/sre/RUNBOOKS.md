# Runbooks SRE — sisTOPOGRAFIA (sisRUA Unified)

> **Roadmap Itens 90 + 112 [T1] — SRE Runbooks formais**
>
> Este documento contém os procedimentos operacionais para diagnóstico, remediação e
> escalação dos incidentes mais comuns na operação do sisTOPOGRAFIA. Deve ser seguido
> por qualquer membro da equipe on-call durante um incidente ativo.

**Versão:** 1.0.0
**Data de emissão:** 2026-04-14
**Proprietário:** Equipe SRE
**Canal de escalação:** ver seção de cada runbook

---

## Índice de Runbooks

| #                                                                  | Incidente                                                      | Severidade padrão |
| ------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------- |
| [RB-01](#rb-01--perda-de-conexão-com-apis-externas)                | Perda de conexão com APIs externas (IBGE, INDE, OSM, TOPODATA) | P2                |
| [RB-02](#rb-02--worker-python-oom-out-of-memory)                   | Worker Python OOM                                              | P1                |
| [RB-03](#rb-03--backlog-na-fila-dxf)                               | Backlog na fila DXF                                            | P2                |
| [RB-04](#rb-04--esgotamento-do-pool-de-conexões-ao-banco-de-dados) | Esgotamento do pool de conexões ao banco de dados              | P1                |
| [RB-05](#rb-05--spike-de-cold-start-no-cloud-run)                  | Spike de cold start no Cloud Run                               | P2                |

### Definição de Severidade

| Nível  | Impacto                                                  | Tempo alvo de resposta | Tempo alvo de resolução |
| ------ | -------------------------------------------------------- | ---------------------- | ----------------------- |
| **P1** | Serviço completamente indisponível ou corrupção de dados | 15 min                 | 1 h                     |
| **P2** | Degradação significativa afetando > 20 % dos usuários    | 30 min                 | 4 h                     |
| **P3** | Degradação parcial ou alertas de tendência               | 2 h                    | 24 h                    |
| **P4** | Incidentes não urgentes, melhorias preventivas           | Próxima sprint         | —                       |

---

## RB-01 — Perda de Conexão com APIs Externas

**APIs afetadas:** IBGE (`servicodados.ibge.gov.br`), INDE (`geoservicos.inde.gov.br`),
OSM Nominatim (`nominatim.openstreetmap.org`), OSM Overpass (`overpass-api.de`),
TOPODATA/INPE (`www.dsr.inpe.br/topodata`)

---

### Sintomas

- Respostas de endpoints como `/api/ibge/*`, `/api/inde/*`, `/api/osm/*` retornando
  HTTP 503 com payload `{ "error": "... service temporarily unavailable" }`.
- Alerta `ExternalAPI_CircuitBreaker_Open` disparado no Alertmanager.
- Logs com mensagens `TOPODATA elevation fetch failed` ou `OSMnx request timeout`.
- Geração DXF falhando com erro `OSM data unavailable` ou `elevation: null`.
- Aumento em `sisrua_external_api_timeout_total{api="<nome>"}`.

---

### Diagnóstico

**Passo 1 — Verificar conectividade direta a partir do Cloud Run**

```bash
# Acesse o console Cloud Run → instância → "Console" ou use gcloud CLI
gcloud run services describe sisrua-app \
  --region southamerica-east1 \
  --format "value(status.url)"

# Teste de conectividade manual (rode dentro de um container de diagnóstico)
curl -v --max-time 10 "https://servicodados.ibge.gov.br/api/v3/localidades/estados"
curl -v --max-time 10 "https://nominatim.openstreetmap.org/status"
curl -v --max-time 10 "https://overpass-api.de/api/status"
curl -v --max-time 15 "http://www.dsr.inpe.br/topodata/cgi-bin/inpe.cgi?service=wcs"
```

**Passo 2 — Verificar estado do circuit breaker via métricas**

```promql
# PromQL — quais APIs estão com circuit breaker aberto?
sisrua_external_api_circuit_breaker_open == 1

# Latência das últimas chamadas por API
histogram_quantile(0.95,
  rate(sisrua_external_api_request_duration_seconds_bucket[10m])
) by (api)

# Taxa de timeouts acumulados
rate(sisrua_external_api_timeout_total[5m]) by (api)
```

**Passo 3 — Verificar logs do servidor**

```bash
# Cloud Run logs (últimos 30 min)
gcloud logging read \
  'resource.type="cloud_run_revision" AND
   resource.labels.service_name="sisrua-app" AND
   textPayload=~"(timeout|circuit|unavailable|TOPODATA|OSMnx)" AND
   timestamp >= "2026-04-14T00:00:00Z"' \
  --limit 200 \
  --format "value(timestamp, textPayload)"

# Ou via Grafana/Loki se configurado:
{job="sisrua-app"} |= "external_api" | json | level="error"
```

**Passo 4 — Verificar status público das APIs**

| API             | Status page / verificação                                 |
| --------------- | --------------------------------------------------------- |
| IBGE            | Sem status page oficial — testar manualmente              |
| OSM Nominatim   | https://nominatim.openstreetmap.org/status (retorna JSON) |
| OSM Overpass    | https://overpass-api.de/api/status (retorna texto)        |
| INPE TOPODATA   | Sem status page — testar manualmente via WCS              |
| GCP / Cloud Run | https://status.cloud.google.com                           |

---

### Ação de Remediação

**Cenário A — API externa com falha transitória (< 15 min)**

1. O circuit breaker já deve ter ativado o fallback automaticamente.
2. Confirmar que os clientes recebem `503` com `X-Fallback: true` ou dados parciais
   com flag de aviso (ex.: `elevation_source: "unavailable"`).
3. Aguardar recuperação natural; o circuit breaker testa a API após 5 min.
4. Monitorar `sisrua_external_api_circuit_breaker_open` para confirmar fechamento.

**Cenário B — API externa indisponível por período prolongado (> 30 min)**

```bash
# Forçar warm-up do cache de dados IBGE (se expirado)
curl -X POST "https://<CLOUD_RUN_BASE_URL>/api/ibge/cache/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Se TOPODATA indisponível, ativar fallback para open-elevation:
# Edite a variável de ambiente no Cloud Run
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars ELEVATION_FALLBACK=open-elevation
```

**Cenário C — Bloqueio de rede / firewall (Cloud Run não acessa internet pública)**

1. Verificar configuração de VPC Connector e regras de egresso no GCP.
2. Se a organização usa proxy corporativo, verificar `HTTPS_PROXY` nas variáveis
   de ambiente do Cloud Run.
3. Verificar se domínios externos estão na lista de allowlist da política de rede
   (consultar `ENTERPRISE_ONBOARDING.md` para lista completa).

---

### Escalação

| Situação                                                     | Escalar para                  |
| ------------------------------------------------------------ | ----------------------------- |
| Circuit breaker aberto > 1 h sem recuperação                 | Tech Lead + SRE on-call       |
| Dados incorretos entregues ao usuário (sem flag de fallback) | P1 imediato — DPO + Tech Lead |
| APIs IBGE/INDE indisponíveis com impacto em contrato         | Jurídico + Account Manager    |

**Contatos on-call:** ver arquivo `contacts/oncall_rotation.md` (não versionado por segurança).

---

### Template RCA

```markdown
## RCA — Perda de conexão: <nome da API>

**Data/Hora do incidente:** YYYY-MM-DD HH:MM BRT
**Duração total:** X horas Y minutos
**Severidade:** P1 / P2
**Impacto:** N usuários afetados; N requisições DXF falharam

### Linha do tempo

- HH:MM — Primeiro alerta disparado
- HH:MM — On-call notificado
- HH:MM — Fallback confirmado ativo
- HH:MM — API recuperada / mitigação aplicada
- HH:MM — Incidente encerrado

### Causa raiz

[Descrever]

### Contribuintes

[Descrever fatores secundários]

### Ações corretivas

- [ ] Ação 1 — Responsável — Prazo
- [ ] Ação 2 — Responsável — Prazo

### Lições aprendidas

[Descrever]
```

---

## RB-02 — Worker Python OOM (Out of Memory)

**Serviço afetado:** Motor Python (`py_engine/`) executado como subprocess pelo
servidor Node.js via `pythonBridge.ts`.

---

### Sintomas

- Logs com `Killed` ou `MemoryError` no stderr do processo Python.
- Alerta Cloud Run: `Container memory utilization` > 90 % de 1024 Mi.
- Job DXF com status `failed` e `error: "Python process exited with code 137"`.
- `sisrua_dxf_requests_total{result="failed"}` aumentando.
- `sisrua_python_worker_memory_bytes` acima de 900 Mi.
- Falhas em lotes: múltiplos jobs consecutivos falhando simultaneamente.

---

### Diagnóstico

**Passo 1 — Confirmar OOM e identificar carga**

```bash
# Verificar código de saída do processo Python
gcloud logging read \
  'resource.type="cloud_run_revision" AND
   resource.labels.service_name="sisrua-app" AND
   textPayload=~"(exit code 137|MemoryError|Killed|OOM)"' \
  --limit 50 \
  --format "value(timestamp, textPayload)"

# Métricas de memória Cloud Run (Console GCP → Cloud Run → Métricas → Memory)
# Ou PromQL:
sisrua_python_worker_memory_bytes
process_resident_memory_bytes{job="sisrua-app"}
```

**Passo 2 — Identificar a requisição causadora**

```bash
# Buscar job ID que causou o OOM (correlacionar com timestamp)
gcloud logging read \
  'resource.type="cloud_run_revision" AND
   textPayload=~"job_id|dxf_request|lat.*lon"' \
  --freshness 1h \
  --limit 100 \
  --format "value(timestamp, jsonPayload.job_id, jsonPayload.lat, jsonPayload.lon, jsonPayload.radius)"
```

**Passo 3 — Reproduzir localmente com psutil**

```bash
# Rodar o motor Python com monitoramento de memória
cd py_engine
python -c "
import psutil, os, subprocess, time

proc = subprocess.Popen(
    ['python', 'main.py', '--lat', '<LAT>', '--lon', '<LON>', '--radius', '<RADIUS>'],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
while proc.poll() is None:
    try:
        p = psutil.Process(proc.pid)
        print(f'RSS: {p.memory_info().rss / 1024**2:.1f} MB')
    except psutil.NoSuchProcess:
        break
    time.sleep(1)
print('Exit code:', proc.returncode)
"
```

---

### Reinício

```bash
# Cloud Run escala instâncias automaticamente — uma instância OOM é substituída
# em ~30s sem intervenção manual.

# Se o problema é recorrente com os jobs atualmente na fila, limpar a fila:
gcloud tasks queues purge sisrua-queue \
  --location southamerica-east1

# Reiniciar o serviço forçando nova revisão (zero-downtime rolling restart):
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars RESTART_MARKER=$(date +%s)
  # (variável inócua; força Cloud Run a criar nova revisão)
```

---

### Prevenção

**Ações imediatas:**

1. Verificar se o job causador tem raio de busca (`radius`) acima do limite seguro.
   Limite recomendado: `MAX_FETCH_RADIUS_METERS=5000` (definido em `constants.py`).
2. Validar se o limite de memória do Cloud Run está configurado:
   ```bash
   gcloud run services describe sisrua-app \
     --region southamerica-east1 \
     --format "value(spec.template.spec.containers[0].resources.limits.memory)"
   # Deve retornar: 1Gi ou 2Gi se aumentado
   ```
3. Aumentar memória se cargas grandes forem legítimas:
   ```bash
   gcloud run services update sisrua-app \
     --region southamerica-east1 \
     --memory 2Gi
   ```

**Ações preventivas (médio prazo):**

- Implementar o guard de memória via `psutil` no `main.py` (Roadmap Item 99):
  ```python
  # py_engine/main.py — adicionar no início do processamento pesado
  import psutil
  MAX_MEMORY_MB = 800
  mem = psutil.Process().memory_info().rss / 1024**2
  if mem > MAX_MEMORY_MB:
      raise MemoryError(f"Limite de memória preventivo atingido: {mem:.0f} MB")
  ```
- Implementar timeout hard de 5 min para qualquer subprocess Python
  (`PYTHON_PROCESS_TIMEOUT_MS=300000` já configurado — verificar se aplicado).
- Adicionar alerta em `sisrua_python_worker_memory_bytes > 850e6` (Gauge).

---

### Escalação

| Situação                                              | Escalar para                   |
| ----------------------------------------------------- | ------------------------------ |
| OOM recorrente (> 3x em 1h) com mesmo raio/coordenada | Dev Sênior — revisar algoritmo |
| Instâncias Cloud Run não recuperando após OOM         | SRE + GCP Support              |
| Suspeita de vazamento de memória em nova versão       | Rollback + Dev Sênior          |

---

### Template RCA

```markdown
## RCA — Worker Python OOM

**Data/Hora:** YYYY-MM-DD HH:MM BRT
**Duração:** X min
**Job IDs afetados:** [lista]
**Parâmetros da requisição causadora:** lat=X, lon=Y, radius=Z

### Causa raiz

[ex: requisição com raio 15.000 m gerou GeoDataFrame de 850 MB antes de clip]

### Memória pico observada

X Mi de 1024 Mi disponíveis

### Ações corretivas

- [ ] Adicionar validação de radius máximo — Dev — Sprint N
- [ ] Aumentar memória para 2 Gi — SRE — Imediato
```

---

## RB-03 — Backlog na Fila DXF

**Serviço afetado:** Google Cloud Tasks (fila `sisrua-queue`) + workers DXF no Cloud Run.

---

### Sintomas

- `sisrua_dxf_queue_pending_tasks` > 20 tarefas (normal: ≤ 5).
- Usuários reportando espera > 5 min para receber DXF (SLO: p95 < 120 s).
- Alerta `SLO_DXF_Latency_P95_Breach` disparado.
- `sisrua_job_queue_wait_seconds` com p95 > 120 s.
- Cloud Run mostrando alta utilização de CPU e memória.

---

### Diagnóstico

**Passo 1 — Dimensionar o backlog atual**

```bash
# Tamanho atual da fila Cloud Tasks
gcloud tasks queues describe sisrua-queue \
  --location southamerica-east1

# PromQL — tarefas pendentes e em processamento
sisrua_dxf_queue_pending_tasks
sisrua_dxf_queue_processing_tasks
sisrua_dxf_queue_worker_busy

# Número de instâncias Cloud Run ativas
gcloud run services describe sisrua-app \
  --region southamerica-east1 \
  --format "value(status.observedGeneration,status.traffic)"
```

**Passo 2 — Identificar causa do atraso**

```promql
# Taxa de geração DXF por minuto (throughput)
rate(sisrua_dxf_requests_total{result="generated"}[5m]) * 60

# Taxa de falhas (workers travados?)
rate(sisrua_dxf_requests_total{result="failed"}[5m]) * 60

# Latência de geração (não inclui espera)
histogram_quantile(0.95,
  rate(sisrua_dxf_generation_duration_seconds_bucket[10m])
)
```

**Passo 3 — Verificar se é gargalo de CPU, memória ou I/O externo**

```bash
# CPU e memória do Cloud Run (Console GCP → Cloud Run → Métricas)
# Ou PromQL Node.js:
rate(process_cpu_seconds_total[1m])
process_resident_memory_bytes

# Verificar se OSM/TOPODATA estão lentos (causa externa do backlog)
histogram_quantile(0.95,
  rate(sisrua_external_api_request_duration_seconds_bucket[10m])
) by (api)
```

---

### Escalonamento (Scaling)

```bash
# Aumentar número máximo de instâncias Cloud Run temporariamente:
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --max-instances 20
  # (padrão é 10 — usar com cautela: custo proporcional)

# Aumentar concorrência de workers DXF dentro de cada instância:
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars DXF_WORKER_CONCURRENCY=4
  # (padrão: 2; máximo recomendado com 1Gi RAM: 3; com 2Gi: 4)

# Verificar se a fila Cloud Tasks está com throttling configurado:
gcloud tasks queues update sisrua-queue \
  --location southamerica-east1 \
  --max-dispatches-per-second 50  # aumentar se necessário
```

**Se o backlog se deve a jobs travados (hanging workers):**

```bash
# Limpar jobs com status "processing" há mais de 10 min (provável travamento):
# Via API interna de administração:
curl -X POST "https://<CLOUD_RUN_BASE_URL>/api/jobs/cleanup-stale" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_age_seconds": 600}'
```

**Se backlog muito grande e não há SLA em risco:**

```bash
# Pausar recebimento de novas tarefas temporariamente:
gcloud tasks queues pause sisrua-queue \
  --location southamerica-east1

# Processar backlog; depois reativar:
gcloud tasks queues resume sisrua-queue \
  --location southamerica-east1
```

---

### Escalação

| Situação                                       | Escalar para                        |
| ---------------------------------------------- | ----------------------------------- |
| Backlog > 100 tarefas                          | SRE Lead + Tech Lead                |
| p95 latência > 600 s (10 min)                  | P1 — notificar clientes afetados    |
| Fila crescendo sem redução mesmo após scale-up | Dev Sênior — possível bug no worker |

---

### Template RCA

```markdown
## RCA — Backlog Fila DXF

**Data/Hora início:** YYYY-MM-DD HH:MM BRT
**Pico de tarefas na fila:** N tarefas
**Duração:** X min
**SLO impactado:** DXF-SLO-02 (p95 latência)

### Causa raiz

[ex: aumento súbito de 50 requisições simultâneas de um único cliente (rate limit insuficiente)]

### Ações corretivas

- [ ] Ajustar rate limit por cliente — Dev — Sprint N
- [ ] Configurar alerta de backlog > 10 tarefas — SRE — Esta sprint
```

---

## RB-04 — Esgotamento do Pool de Conexões ao Banco de Dados

**Serviço afetado:** Supabase/PostgreSQL (usado para jobs persistence, constantes CQT
e RBAC quando `DATABASE_URL` e `USE_SUPABASE_JOBS=true` estão configurados).

---

### Sintomas

- Erros HTTP 500 em endpoints que dependem de banco: `/api/bt/*`, `/api/jobs/*`.
- Logs com `too many connections` ou `connection pool exhausted` ou
  `FATAL: remaining connection slots are reserved`.
- `sisrua_http_requests_total{status_code="500"}` aumentando.
- Tempo de resposta elevado (pool aguardando conexão disponível antes de timeout).
- Alerta Supabase: `Database connection count approaching limit`.

---

### Diagnóstico

**Passo 1 — Verificar conexões ativas no banco**

```sql
-- Executar via Supabase SQL Editor ou psql
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  wait_event_type,
  wait_event,
  query_start,
  now() - query_start AS duration,
  left(query, 80) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start DESC NULLS LAST;

-- Contagem por estado
SELECT state, count(*) FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;

-- Limite máximo configurado
SHOW max_connections;
```

**Passo 2 — Identificar conexões travadas ou longas**

```sql
-- Queries rodando há mais de 30 segundos
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '30 seconds'
ORDER BY duration DESC;

-- Locks bloqueantes
SELECT blocking_locks.pid AS blocking_pid,
       blocked_locks.pid  AS blocked_pid,
       blocked_activity.query AS blocked_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
 AND blocking_locks.pid != blocked_locks.pid
 AND blocking_locks.granted;
```

**Passo 3 — Verificar configuração do pool no servidor**

```bash
# Variável de pool (Supabase usa pgBouncer por padrão no plano Pro)
echo $DATABASE_URL  # deve incluir ?pgbouncer=true&connection_limit=5

# Parâmetros de pool da aplicação (server/config.ts)
grep -E "pool|DATABASE" server/config.ts
```

---

### Mitigação

**Imediata — encerrar conexões ociosas/travadas:**

```sql
-- Encerrar queries ativas há mais de 2 minutos (NÃO usar em produção sem revisão)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'active'
  AND now() - query_start > interval '2 minutes'
  AND pid <> pg_backend_pid();

-- Encerrar conexões idle há mais de 5 minutos
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'idle'
  AND now() - state_change > interval '5 minutes'
  AND pid <> pg_backend_pid();
```

**Curto prazo — reduzir abertura de conexões da aplicação:**

```bash
# Reduzir connection_limit na DATABASE_URL:
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=3"
```

**Curto prazo — ativar modo sem banco temporariamente:**

```bash
# Desativar persistência de jobs em banco (usar in-memory fallback):
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars USE_SUPABASE_JOBS=false
# ATENÇÃO: jobs ativos no banco serão invisíveis até reativar
```

**Médio prazo — ajustar pool:**

- Habilitar pgBouncer no painel Supabase (plano Pro).
- Configurar `statement_timeout = 30s` e `idle_in_transaction_session_timeout = 60s`
  no banco para prevenir conexões travadas.
- Revisar código de acesso ao banco para garantir `finally { client.release() }`.

---

### Escalação

| Situação                                    | Escalar para                       |
| ------------------------------------------- | ---------------------------------- |
| Banco inacessível > 10 min                  | P1 — SRE + DBA + Supabase Support  |
| Corrupção de dados detectada                | P1 — Tech Lead + DPO imediatamente |
| Custo de conexões impactando plano Supabase | Tech Lead + decisão de upgrade     |

---

### Template RCA

```markdown
## RCA — Pool de Conexões Esgotado

**Data/Hora:** YYYY-MM-DD HH:MM BRT
**Conexões ativas no pico:** N / MAX
**Duração de impacto:** X min

### Causa raiz

[ex: leak de conexão no handler de jobs — `client.release()` não chamado em path de erro]

### Ações corretivas

- [ ] Corrigir leak de conexão — Dev — Hotfix imediato
- [ ] Adicionar alerta `pg_stat_activity > 80% max_connections` — SRE
- [ ] Ativar idle_in_transaction_session_timeout=60s — DBA
```

---

## RB-05 — Spike de Cold Start no Cloud Run

**Serviço afetado:** Cloud Run (escalonamento automático de zero instâncias).

---

### Sintomas

- Primeiras requisições após período de inatividade (> 15 min sem tráfego) demoram
  > 10 s para responder (SLO: p95 < 2 s).
- Alerta `SLO_API_Uptime_BurnRate_Fast` disparado após escalonamento.
- Logs Cloud Run mostrando `Container startup latency` elevado.
- `sisrua_http_request_duration_seconds` com spike pontual no p99.
- Usuários reportando "timeout" ou "erro" na primeira requisição do dia.

---

### Diagnóstico

**Passo 1 — Confirmar que é cold start (e não outro problema)**

```bash
# Verificar latência de startup no Cloud Run Console:
# GCP → Cloud Run → sisrua-app → Métricas → "Container startup latency"
# Ou via Cloud Monitoring:
gcloud monitoring metrics list \
  --filter="metric.type=run.googleapis.com/container/startup_latencies"

# Verificar se há instâncias mínimas configuradas:
gcloud run services describe sisrua-app \
  --region southamerica-east1 \
  --format "value(spec.template.metadata.annotations)"
# Procurar: autoscaling.knative.dev/minScale
```

**Passo 2 — Medir tempo de inicialização atual**

```bash
# Forçar scale-to-zero e medir cold start (ambiente de staging):
gcloud run services update sisrua-staging \
  --region southamerica-east1 \
  --min-instances 0

# Aguardar 2 min (scale down), depois medir:
time curl -s "https://<STAGING_URL>/health" | jq .

# Registrar no histórico:
# Cold start esperado com Docker multi-stage + venv Python: 8–15 s
# Cold start com min-instances=1: ~200 ms (warm)
```

**Passo 3 — Verificar tamanho da imagem Docker**

```bash
# Tamanho da imagem implantada
gcloud artifacts docker images list \
  southamerica-east1-docker.pkg.dev/$GCP_PROJECT/sisrua/sisrua-app \
  --include-tags \
  --format "table(tags, createTime, updateTime)"

# Pull e inspecionar:
docker image inspect sisrua-app:latest --format '{{.Size}}' | numfmt --to=iec
```

---

### Resolução

**Imediata — configurar instância mínima (warm instance):**

```bash
# Manter pelo menos 1 instância aquecida (elimina cold start para tráfego normal)
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --min-instances 1
# ATENÇÃO: custo de ~$15–30/mês por instância idle (1 vCPU / 1Gi)
# Justificar com base no SLO e impacto em cliente enterprise
```

**Médio prazo — otimizar tempo de startup:**

1. Verificar se o processo de importação de módulos Python está lento:
   ```bash
   # Medir tempo de import no container
   docker run --rm sisrua-app:latest python -c "
   import time; t=time.time()
   import osmnx, geopandas, ezdxf, numpy, scipy
   print(f'Import time: {time.time()-t:.2f}s')
   "
   ```
2. Garantir que o `venv` Python está na imagem final (não recriado no startup).
   Verificar `Dockerfile` — stage `production` deve copiar `/opt/venv` do stage `builder`.
3. Reduzir o `start_period` do health check se o startup real for < 15 s:
   ```yaml
   # docker-compose.yml
   healthcheck:
     start_period: 20s # reduzir de 40s para 20s se justificado
   ```

**Longo prazo — startup probe dedicado no Cloud Run:**

```bash
# Cloud Run suporta startup probe desde 2024
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --startup-cpu-boost  # dobra CPU durante startup — reduz cold start ~40%
```

---

### Escalação

| Situação                                | Escalar para                              |
| --------------------------------------- | ----------------------------------------- |
| Cold start > 30 s consistentemente      | Dev Sênior — revisar Dockerfile e imports |
| min-instances=1 não resolveu o problema | SRE + revisar startup probe               |
| Custo de min-instances inviável         | Tech Lead + decisão de arquitetura        |

---

### Template RCA

```markdown
## RCA — Cold Start Spike

**Data/Hora:** YYYY-MM-DD HH:MM BRT
**Latência de cold start observada:** X s (esperado: < 15 s)
**Usuários impactados:** N (requisições com timeout)

### Causa raiz

[ex: nova dependência Python adicionada aumentou tempo de import de 8s para 25s]

### Ações corretivas

- [ ] Lazy import de osmnx (somente quando necessário) — Dev — Sprint N
- [ ] Configurar --startup-cpu-boost no Cloud Run — SRE — Imediato
- [ ] Adicionar alerta container_startup_latency > 20s — SRE
```

---

## Apêndice A — Comandos Rápidos de Diagnóstico

```bash
# Status geral do serviço
gcloud run services describe sisrua-app --region southamerica-east1

# Logs em tempo real
gcloud run services logs tail sisrua-app --region southamerica-east1

# Métricas Prometheus (requer METRICS_TOKEN se configurado)
curl -H "Authorization: Bearer $METRICS_TOKEN" \
  "https://<CLOUD_RUN_BASE_URL>/metrics"

# Health check rápido
curl -s "https://<CLOUD_RUN_BASE_URL>/health" | jq .

# Estado da fila Cloud Tasks
gcloud tasks queues describe sisrua-queue --location southamerica-east1

# Listar tarefas na fila
gcloud tasks list --queue sisrua-queue --location southamerica-east1 --limit 20
```

## Apêndice B — Canais de Comunicação de Incidente

| Canal                           | Uso                                                 |
| ------------------------------- | --------------------------------------------------- |
| `#incidentes-sre` (Slack/Teams) | Comunicação interna durante incidente               |
| `#status-clientes`              | Atualizações para clientes enterprise               |
| `status.<dominio>`              | Status page pública (Statuspage.io ou similar)      |
| E-mail DPO                      | Notificações LGPD (ver `INCIDENT_PLAYBOOK_LGPD.md`) |

---

_Runbooks mantidos pela equipe SRE. Revisar após cada incidente P1/P2._
_Última atualização: 2026-04-14_
