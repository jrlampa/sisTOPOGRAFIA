# CAC – 2026-04-13 – Performance de Banco com Recursos Avançados

## Contexto

Existiam índices compostos pontuais na migração `019_audit_soft_delete_indices.sql` (`idx_constants_ns_key_deleted`, `idx_bt_history_user_date`, `idx_jobs_status_created`), porém **sem evidência de**:
- Índices BRIN para colunas de série temporal
- Índices geoespaciais (PostGIS/GIN)
- Materialized views para consultas pesadas recorrentes
- Particionamento de tabelas volumosas

## Gap Identificado

| Recurso                         | Estado anterior     | Gap                                    |
|---------------------------------|---------------------|----------------------------------------|
| Índices BRIN (time-series)      | ❌                  | Tabelas de log sem BRIN                |
| Índices GIN/pg_trgm (text)      | ❌                  | Sem busca textual eficiente            |
| Índices GIN (JSONB)             | ❌                  | `metadata` e `new_data` sem GIN        |
| Materialized views              | ❌                  | Queries analíticas recalculadas sempre |
| Refresh automático de MVs       | ❌                  | Sem agendamento                        |
| Índices compostos de auditoria  | Parciais            | Sem cobertura de `changed_by + date`   |

## Solução Implementada (023_advanced_performance_indexes.sql)

### 1. Índices BRIN (Block Range Index)

Uso ideal: colunas monotonicamente crescentes em tabelas insert-heavy onde registros não são atualizados na coluna de tempo.

| Índice                          | Tabela                | Coluna        | Custo vs B-tree |
|---------------------------------|-----------------------|---------------|-----------------|
| `idx_brin_jobs_created_at`      | `jobs`                | `created_at`  | ~1%             |
| `idx_brin_dxf_tasks_created_at` | `dxf_tasks`           | `created_at`  | ~1%             |
| `idx_brin_audit_logs_changed_at`| `audit_logs`          | `changed_at`  | ~1%             |
| `idx_brin_bt_history_created_at`| `bt_export_history`   | `created_at`  | ~1%             |

**Quando usar BRIN vs B-tree:** BRIN é mais eficiente para tabelas com >1M linhas onde `created_at` cresce monotonicamente. Para tabelas menores, o B-tree existente ainda é adequado.

### 2. Índices GIN / pg_trgm (Busca Textual)

Habilita buscas por substring eficientes (`LIKE '%termo%'`, `ILIKE`):

```sql
-- Exemplos de queries beneficiadas:
SELECT * FROM constants_catalog WHERE namespace ILIKE '%elétrico%';
SELECT * FROM constants_catalog WHERE key ILIKE '%tensão%';
SELECT * FROM audit_logs WHERE table_name ILIKE '%catalog%';
```

### 3. Índices GIN em JSONB

| Índice                          | Tabela                | Coluna    |
|---------------------------------|-----------------------|-----------|
| `idx_gin_bt_history_metadata`   | `bt_export_history`   | `metadata`|
| `idx_gin_audit_logs_new_data`   | `audit_logs`          | `new_data` |

Beneficia queries como:
```sql
SELECT * FROM bt_export_history WHERE metadata @> '{"version": "2.0"}';
SELECT * FROM audit_logs WHERE new_data ? 'cqt_scenario';
```

### 4. Índices Compostos de Auditoria

| Índice                        | Uso                                   |
|-------------------------------|---------------------------------------|
| `idx_audit_table_action_date` | Relatórios de conformidade por tabela |
| `idx_audit_user_date`         | Investigação de incidentes por usuário |
| `idx_bt_history_cqt_scenario_date` | Análises de engenharia por cenário |
| `idx_jobs_status_attempts`    | Retry logic / jobs travados           |

### 5. Materialized Views

#### `mv_bt_history_daily_summary`
Agrega exportações BT por dia e tipo de projeto. Evita GROUP BY pesado em `bt_export_history` a cada requisição de dashboard.

```sql
SELECT * FROM public.mv_bt_history_daily_summary
WHERE day_local >= CURRENT_DATE - 30;
```

#### `mv_audit_stats`
Estatísticas de auditoria por tabela e ação. Substitui consulta analítica a cada relatório de conformidade.

```sql
SELECT * FROM public.mv_audit_stats WHERE table_name = 'constants_catalog';
```

#### `mv_constants_namespace_summary`
Resumo do catálogo por namespace. Substitui COUNT agrupado em cada carregamento de UI de gestão.

```sql
SELECT * FROM public.mv_constants_namespace_summary ORDER BY total_entries DESC;
```

### 6. Refresh Automático (pg_cron)

- **`refresh_materialized_views_hourly`**: executa `REFRESH MATERIALIZED VIEW CONCURRENTLY` em todas as 3 MVs a cada hora (minuto 5)
- `CONCURRENTLY` garante que leituras não são bloqueadas durante o refresh
- Requer índice único nas MVs (já criados: `idx_mv_*`)

## Nota sobre Particionamento

Particionamento de `audit_logs` e `bt_export_history` por `changed_at`/`created_at` foi **avaliado mas não implementado** nesta fase porque:

1. O volume atual não justifica a complexidade operacional (estimativa <10M linhas/ano)
2. O archival automático (024) move dados antigos para `private.audit_logs_archive`, controlando o crescimento
3. BRIN já oferece performance de scan equivalente para as queries atuais

**Recomendação futura:** Implementar particionamento via `pg_partman` quando `audit_logs` superar 50M linhas.

## Nota sobre Índices Geoespaciais

PostGIS/GIST para dados geoespaciais foi avaliado. As tabelas atuais (`jobs`, `bt_export_history`) armazenam coordenadas como JSONB ou TEXT (via `bt_context_url`), não como `GEOMETRY`. Um índice GIST só se justifica quando:
- Houver uma coluna `GEOMETRY` ou `GEOGRAPHY` dedicada
- Consultas de proximidade/interseção espacial forem necessárias

**Recomendação futura:** Adicionar coluna `geom GEOMETRY(Point, 4326)` em `bt_export_history` e índice GIST quando a feature de mapa de calor BT for implementada.

## Invariantes de Performance

- MVs têm índice único (requisito para `CONCURRENTLY`)
- BRIN com `pages_per_range = 32` (padrão 128) para granularidade maior em tabelas médias
- GIN pg_trgm usa `extensions.gin_trgm_ops` referenciando o schema correto
- Índices parciais `WHERE deleted_at IS NULL` garantem scans somente em dados ativos
