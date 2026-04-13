# CAC – 2026-04-13 – Manutenção Recorrente Abrangente do Banco de Dados

## Contexto

Existia agendamento com `pg_cron` para limpeza de jobs terminais (`017_pg_cron_cleanup_old_jobs.sql`), mas não havia **rotina de manutenção operacional mais ampla**: VACUUM/ANALYZE programado, archival de logs, relatório de saúde do banco, reindexação preventiva e governança com log das próprias manutenções.

## Gap Identificado

| Atividade de Manutenção          | Estado anterior            | Gap                                    |
|----------------------------------|----------------------------|----------------------------------------|
| Limpeza de jobs antigos          | ✅ (017)                   | Cobre apenas `jobs`                    |
| VACUUM/ANALYZE programado        | ❌ (autovacuum padrão)      | Sem agendamento explícito              |
| Archival de audit_logs           | ❌                          | `audit_logs` cresce indefinidamente    |
| Relatório de saúde do banco      | ❌                          | Sem healthcheck operacional            |
| Cleanup de backups expirados     | ❌ (antes de 022)           | Sem retenção de snapshots              |
| Refresh de materialized views    | ❌ (antes de 023)           | Sem refresh programado                 |
| Log das manutenções executadas   | ❌                          | Sem governança de operações            |

## Solução Implementada (024_db_maintenance_schedule.sql)

### Objetos Criados

| Objeto                                   | Tipo     | Propósito                              |
|------------------------------------------|----------|----------------------------------------|
| `private.maintenance_log`                | Tabela   | Log de execução de todas as manutenções |
| `private.audit_logs_archive`             | Tabela   | Cold storage de audit_logs antigos     |
| `private.run_vacuum_analyze()`           | Função   | Logging de manutenção VACUUM           |
| `private.archive_old_audit_logs()`       | Função   | Archival em lotes de audit_logs        |
| `private.db_health_report()`             | Função   | Relatório de saúde operacional         |
| `private.cleanup_maintenance_log()`      | Função   | Purga de logs de manutenção antigos    |
| `private.v_maintenance_schedule`         | View     | Visão consolidada de todos os jobs cron |

### Cronograma Completo de Manutenção

```
UTC   Dom  Seg  Ter  Qua  Qui  Sex  Sab
01:00  W
02:00  V    B    B    B    B    B    B
02:30  V
03:10       J    J    J    J    J    J
03:20       J    J    J    J    J    J    (017 – limpeza jobs)
03:30       A    A    A    A    A    A
04:00                           E
05:00  M
06:00       I    I    I    I    I    I
07:00       H    H    H    H    H    H
05/:00 R    R    R    R    R    R    R    (a cada hora)
```

**Legenda:**
- `W` = VACUUM ANALYZE semanal (jobs + dxf_tasks + audit_logs + bt_export_history + constants_catalog)
- `B` = Backup diário das tabelas críticas
- `V` = VACUUM ANALYZE jobs + dxf_tasks
- `J` = Limpeza de jobs terminais (017)
- `A` = Archival de audit_logs >90 dias
- `E` = Cleanup de backups expirados (sexta)
- `M` = Cleanup de maintenance_log (dia 1 do mês)
- `I` = Verificação de integridade de backups
- `H` = Relatório de saúde do banco
- `R` = Refresh de materialized views (toda hora)

### Função: `private.archive_old_audit_logs()`

- Move audit_logs com `changed_at < now() - 90 days` para `private.audit_logs_archive`
- Lotes de 50.000 registros por execução (evita lock prolongado)
- `FOR UPDATE SKIP LOCKED` (concorrência segura)
- INSERT com `ON CONFLICT DO NOTHING` (idempotente)

### Função: `private.db_health_report()`

Verifica e classifica:

| Métrica                          | ok          | WARNING        | CRITICAL  |
|----------------------------------|-------------|----------------|-----------|
| `cache_hit_ratio_pct`            | ≥ 99%       | 95–99%         | < 95%     |
| `dead_tuples_critical_tables`    | < 10.000    | 10k–100k       | > 100k    |
| `blocked_locks`                  | 0           | 1–4            | ≥ 5       |
| `audit_log_total_rows`           | < 1M        | 1M–5M          | > 5M      |

### Vista: `private.v_maintenance_schedule`

Consolida todos os 11 jobs cron do sistema em uma view única:

```sql
SELECT jobname, schedule, active FROM private.v_maintenance_schedule;
```

| Job                               | Cron         |
|-----------------------------------|--------------|
| `cleanup_old_jobs_daily`          | `20 3 * * *` |
| `backup_critical_tables_daily`    | `0 2 * * *`  |
| `backup_critical_tables_weekly`   | `0 1 * * 0`  |
| `cleanup_expired_backups_weekly`  | `0 4 * * 5`  |
| `verify_backup_integrity_daily`   | `0 6 * * *`  |
| `refresh_materialized_views_hourly` | `5 * * * *` |
| `vacuum_analyze_jobs_daily`       | `10 3 * * *` |
| `vacuum_analyze_audit_weekly`     | `30 2 * * 0` |
| `archive_old_audit_logs_nightly`  | `30 3 * * *` |
| `db_health_report_daily`          | `0 7 * * *`  |
| `cleanup_maintenance_log_monthly` | `0 5 1 * *`  |

## Governança: Tabela `private.maintenance_log`

Toda função de manutenção:
1. Insere registro `status = 'running'` no início
2. Atualiza para `status = 'ok'` com detalhes ao final
3. Captura erro e marca `status = 'error'` em caso de falha

**Consulta de auditoria de manutenção:**
```sql
SELECT job_name, started_at, status, details, error_msg
FROM private.maintenance_log
WHERE started_at > now() - INTERVAL '7 days'
ORDER BY started_at DESC;
```

**Verificação de falhas recentes:**
```sql
SELECT * FROM private.maintenance_log
WHERE status = 'error' AND started_at > now() - INTERVAL '24 hours';
```

## Invariantes de Segurança

- Todo objeto em `private` inacessível a `anon` e `authenticated`
- Funções de manutenção têm `REVOKE ALL FROM PUBLIC` explícito
- Archival usa `SKIP LOCKED` para evitar contenção com operações de produção
- VACUUM direto é feito via statement SQL no pg_cron (não dentro de `EXECUTE` em plpgsql)

## Relação com Outras Migrações

```
017 ─── cleanup_old_jobs_daily (jobs terminais)
022 ─── backup_critical_tables_daily/weekly + cleanup_expired_backups + verify_backup_integrity
023 ─── refresh_materialized_views_hourly
024 ─── vacuum_analyze_* + archive_old_audit_logs + db_health_report + cleanup_maintenance_log
```

Todos os 11 jobs são visíveis em `private.v_maintenance_schedule`.
