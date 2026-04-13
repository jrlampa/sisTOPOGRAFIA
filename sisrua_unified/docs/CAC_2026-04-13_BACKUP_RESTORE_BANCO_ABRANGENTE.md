# CAC – 2026-04-13 – Estratégia de Backup e Restore do Banco de Dados

## Contexto

Existia restore de snapshots do catálogo (`constantsRoutes.ts:161`) e a tabela `constants_catalog_snapshots` para rollback de conteúdo do catálogo. Porém, não havia **estratégia abrangente de backup/restore do banco** cobrindo todas as tabelas críticas, política de retenção, verificação operacional e rotina de execução automatizada.

## Gap Identificado

| Aspecto                      | Estado anterior             | Gap                                    |
|------------------------------|-----------------------------|----------------------------------------|
| Snapshot de catálogo         | ✅ (006 + constantsRoutes)  | Cobre apenas `constants_catalog`       |
| Backup de `user_roles`       | ❌                          | Nenhum mecanismo                       |
| Backup de `bt_export_history`| ❌                          | Nenhum mecanismo                       |
| Política de retenção         | ❌                          | Não definida                           |
| Rotina automatizada          | ❌                          | Sem pg_cron para backup                |
| Verificação de integridade   | ❌                          | Sem função de healthcheck              |
| Restore controlado           | Parcial (catálogo apenas)   | Sem restore de outras tabelas          |

## Solução Implementada (022_database_backup_restore.sql)

### Arquitetura de Backup em Duas Camadas

```
Camada 1 (Infraestrutura) – Supabase PITR / pg_basebackup
  └─ Backup físico completo do cluster (responsabilidade da plataforma)

Camada 2 (Aplicação) – Esta migração
  └─ Snapshots lógicos granulares de tabelas críticas no schema `backup`
```

### Schema `backup`

| Objeto                              | Tipo              | Propósito                                      |
|-------------------------------------|-------------------|------------------------------------------------|
| `backup.backup_manifest`            | Tabela            | Inventário de todos os backups                 |
| `backup.constants_catalog_snapshot` | Tabela            | Cópia lógica do catálogo                       |
| `backup.user_roles_snapshot`        | Tabela            | Cópia lógica de papéis de usuário              |
| `backup.bt_export_history_snapshot` | Tabela            | Cópia lógica do histórico BT (últimos 90 dias) |

### Funções `private`

| Função                                        | Propósito                              |
|-----------------------------------------------|----------------------------------------|
| `private.backup_critical_tables(type, retain)` | Cria snapshots lógicos + manifesto     |
| `private.cleanup_expired_backups()`            | Remove backups expirados (CASCADE)     |
| `private.verify_backup_integrity()`            | Healthcheck dos backups existentes     |

### Política de Retenção

| Tipo     | Frequência       | Retenção  | Cron                 |
|----------|------------------|-----------|----------------------|
| Diário   | Diariamente 02:00 UTC | 30 dias | `0 2 * * *`        |
| Semanal  | Domingos 01:00 UTC    | 84 dias (12 semanas) | `0 1 * * 0` |
| Limpeza  | Sextas 04:00 UTC      | —        | `0 4 * * 5`        |
| Verificação | Diária 06:00 UTC  | —        | `0 6 * * *`        |

### Restore Manual (Procedimento Operacional)

```sql
-- 1. Identificar backup disponível
SELECT id, table_name, backup_type, row_count, backup_at, expires_at, status
FROM backup.backup_manifest
WHERE table_name = 'constants_catalog' AND status = 'ok'
ORDER BY backup_at DESC LIMIT 5;

-- 2. Restaurar (exemplo para constants_catalog)
-- a. Criar snapshot pré-restore para safety
SELECT * FROM private.backup_critical_tables('pre_restore', INTERVAL '7 days');

-- b. Restaurar a partir do backup selecionado
BEGIN;
  -- Soft-delete de registros atuais que não existem no backup
  UPDATE public.constants_catalog SET deleted_at = now()
  WHERE id NOT IN (
    SELECT id FROM backup.constants_catalog_snapshot WHERE _backup_id = '<backup_id>'
  ) AND deleted_at IS NULL;

  -- Upsert a partir do snapshot
  INSERT INTO public.constants_catalog (id, namespace, key, value, ...)
  SELECT id, namespace, key, value, ...
  FROM backup.constants_catalog_snapshot
  WHERE _backup_id = '<backup_id>'
  ON CONFLICT (id) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now();
COMMIT;

-- 3. Verificar integridade após restore
SELECT * FROM private.verify_backup_integrity();
```

### Verificação de Integridade (Automatizada)

`private.verify_backup_integrity()` retorna:
- `last_daily_backup`: alerta se o backup mais recente tem >25h
- `active_backup_count`: crítico se não há backups ativos
- `constants_catalog_backup_nonempty`: alerta se backup está vazio

## Invariantes de Segurança

- Schema `backup` e funções `private.*` são inacessíveis a `anon` e `authenticated`
- Snapshots têm `ON DELETE CASCADE` a partir do manifesto
- Backups expirados são marcados antes de removidos (janela de 7 dias extras de segurança)
- Função de restore só é executada via `service_role` com transação explícita

## Nota sobre Backup Físico (Infraestrutura)

Para o Supabase:
- **PITR (Point-in-Time Recovery)** está disponível no plano Pro+
- Ativar em: Project Settings → Database → Point in Time Recovery
- Complementa esta estratégia de backup lógico de aplicação
- Recomendado: PITR para desastre total + backup lógico para restore granular
