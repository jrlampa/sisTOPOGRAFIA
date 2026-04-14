# Manutenção Formalizada do Banco de Dados

## Objetivo

Formalizar a evidência de que a manutenção recorrente do banco vai além da limpeza de jobs introduzida na migration 017, cobrindo análise sistemática de desempenho, limpeza preventiva, atualização de cache e governança operacional.

## Base de Implementação

- Migration 017: cleanup agendado de jobs terminais antigos com retenção padrão de 14 dias.
- Migration 022 e 026-033: backup, verificação de integridade e restore readiness.
- Migration 023: materialized views e índices voltados a performance.
- Migration 024: maintenance log, archival de audit logs, health report e cronograma de manutenção.
- Migration 034: particionamento time-series para tabelas operacionais.

## Escopo Formalizado

### 1. Análise sistemática de desempenho

- Função: `private.db_health_report()`.
- Agendamento: `0 7 * * *`.
- Métricas coletadas: - `cache_hit_ratio_pct` - `dead_tuples_critical_tables` - `blocked_locks` - `database_size` - `audit_log_total_rows`
- Governança: cada execução registra status em `private.maintenance_log`.

### 2. Limpeza preventiva e manutenção recorrente

- Cleanup de jobs antigos: `cleanup_old_jobs_daily`.
- VACUUM ANALYZE diário: `vacuum_analyze_jobs_daily`.
- VACUUM ANALYZE semanal: `vacuum_analyze_audit_weekly`.
- Archival de audit logs: `archive_old_audit_logs_nightly`.
- Cleanup do próprio histórico de manutenção: `cleanup_maintenance_log_monthly`.

### 3. Atualização de cache operacional

- Refresh horário de materialized views: `refresh_materialized_views_hourly`.
- Views envolvidas: - `public.mv_bt_history_daily_summary` - `public.mv_audit_stats` - `public.mv_constants_namespace_summary`

### 4. Integridade e backup

- Backup diário: `backup_critical_tables_daily`.
- Backup semanal: `backup_critical_tables_weekly`.
- Verificação diária: `verify_backup_integrity_daily`.
- Cleanup de backups expirados: `cleanup_expired_backups_weekly`.

### 5. Governança operacional

- Tabela de auditoria: `private.maintenance_log`.
- Campos centrais: - `job_name` - `started_at` - `finished_at` - `status` - `details` - `error_msg`
- Visão operacional: `private.v_maintenance_schedule`.
- Cold storage de auditoria: `private.audit_logs_archive`.

## Cronograma Consolidado

| Job                                 | Cron UTC     | Finalidade                                                |
| ----------------------------------- | ------------ | --------------------------------------------------------- |
| `backup_critical_tables_weekly`     | `0 1 * * 0`  | Backup semanal                                            |
| `backup_critical_tables_daily`      | `0 2 * * *`  | Backup diário                                             |
| `vacuum_analyze_audit_weekly`       | `30 2 * * 0` | VACUUM ANALYZE de tabelas pesadas                         |
| `vacuum_analyze_jobs_daily`         | `10 3 * * *` | VACUUM ANALYZE de jobs e dxf_tasks                        |
| `cleanup_old_jobs_daily`            | `20 3 * * *` | Limpeza de jobs terminais antigos com retenção de 14 dias |
| `archive_old_audit_logs_nightly`    | `30 3 * * *` | Archival de audit logs > 90 dias                          |
| `cleanup_expired_backups_weekly`    | `0 4 * * 5`  | Remoção de backups expirados                              |
| `cleanup_maintenance_log_monthly`   | `0 5 1 * *`  | Retenção do maintenance_log                               |
| `verify_backup_integrity_daily`     | `0 6 * * *`  | Health check de backup                                    |
| `db_health_report_daily`            | `0 7 * * *`  | Relatório sistemático de saúde                            |
| `refresh_materialized_views_hourly` | `5 * * * *`  | Refresh de materialized views                             |

## Evidência Verificada

Verificação executada em 2026-04-13 via `verify_maintenance_formalized.py`:

- 11 de 11 jobs ativos em `cron.job`.
- `private.db_health_report()` retornando: - `cache_hit_ratio_pct = 99.97` - `dead_tuples_critical_tables = 54` - `blocked_locks = 0` - `database_size = 23 MB` - `audit_log_total_rows = 1`
- `private.maintenance_log` presente e registrando execuções.
- 3 materialized views presentes.
- 16 índices BRIN, 2 GIN e 3 TRGM encontrados.
- 4 tabelas particionadas com 48 partições prospectivas.

Observação:

- `private.verify_backup_integrity()` retornou `WARNING` para `constants_catalog_backup_nonempty` no ambiente atual, sem invalidar a existência da rotina de backup e verificação.

## Consultas Operacionais

```sql
SELECT *
FROM private.v_maintenance_schedule;

SELECT *
FROM private.db_health_report();

SELECT *
FROM private.verify_backup_integrity();

SELECT job_name, status, started_at, finished_at, error_msg, details
FROM private.maintenance_log
WHERE started_at > now() - interval '7 days'
ORDER BY started_at DESC;
```

## Conclusão

A evidência atual confirma que a manutenção recorrente do banco está formalizada além do cleanup de jobs da migration 017. O repositório possui rotina agendada para saúde do banco, manutenção preventiva, atualização de cache, backup e governança com trilha operacional auditável.
