# CAC – 2026-04-13 – Auditoria e Soft Delete em Tabelas de Negócio

## Contexto

A migração `019_audit_soft_delete_indices.sql` estabeleceu a infraestrutura de auditoria (`audit_logs`, `proc_audit_log()`) e soft delete, mas a aplicação estava **concentrada exclusivamente em `constants_catalog`**. As tabelas de negócio (`jobs`, `dxf_tasks`, `bt_export_history`, `user_roles`) não possuíam cobertura equivalente.

## Gap Identificado

| Tabela               | Soft delete | Trigger auditoria | Índice parcial (ativo) |
|----------------------|:-----------:|:-----------------:|:----------------------:|
| `constants_catalog`  | ✅ (019)    | ✅ (019)          | ✅ (019)               |
| `jobs`               | ❌          | ❌                | ❌                     |
| `dxf_tasks`          | ❌          | ❌                | ❌                     |
| `bt_export_history`  | ❌          | ❌                | ❌                     |
| `user_roles`         | ❌          | ❌ (audit table própria) | ❌             |

## Solução Implementada (021_audit_soft_delete_business_tables.sql)

### 1. Função `proc_audit_log_generic()`
- Versão aprimorada do `proc_audit_log()` original
- Aceita chaves primárias de qualquer tipo (TEXT, SERIAL, BIGSERIAL, UUID)
- `SECURITY DEFINER` com `search_path` explícito
- Acesso restrito a `service_role` e `postgres`

### 2. Cobertura aplicada a cada tabela

**`public.jobs`**
- `deleted_at TIMESTAMPTZ` adicionado
- Índices parciais `WHERE deleted_at IS NULL` para consultas ativas
- Trigger `trg_audit_jobs`

**`public.dxf_tasks`**
- `deleted_at TIMESTAMPTZ` adicionado
- Índice parcial para status + data
- Trigger `trg_audit_dxf_tasks`

**`public.bt_export_history`**
- `deleted_at TIMESTAMPTZ` adicionado
- Índices existentes substituídos por versões com filtro de soft delete
- Trigger `trg_audit_bt_export_history`

**`public.user_roles`**
- `deleted_at TIMESTAMPTZ` adicionado (complementa tabela `user_roles_audit` da 020)
- Índice parcial por `user_id`
- Trigger `trg_audit_user_roles` (dual-write: `audit_logs` + `user_roles_audit`)

### 3. Vista operacional
`public.v_soft_deleted_summary` – consolidada de itens soft-deleted por tabela, para monitoramento operacional.

## Padrão de Uso: Soft Delete

```sql
-- Deletar (soft)
UPDATE public.jobs SET deleted_at = now() WHERE id = $1;

-- Consultar apenas ativos (usa índice parcial)
SELECT * FROM public.jobs WHERE deleted_at IS NULL AND status = 'queued';

-- Restaurar
UPDATE public.jobs SET deleted_at = NULL WHERE id = $1;
```

## Invariantes de Segurança

- `proc_audit_log_generic()` é `SECURITY DEFINER` e não exposta a roles públicas
- Triggers de auditoria não podem ser desabilitados por `anon`/`authenticated`
- A view `v_soft_deleted_summary` é somente leitura para `service_role`

## Validação

- Migração idempotente: `IF NOT EXISTS`, `OR REPLACE`, `DROP TRIGGER IF EXISTS`
- Compatível com o `proc_audit_log()` original (019) que continua em `constants_catalog`
- Não quebra a lógica existente de `jobs` (soft delete é opt-in no backend)
