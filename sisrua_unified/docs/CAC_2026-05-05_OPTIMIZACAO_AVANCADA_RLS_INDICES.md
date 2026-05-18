# CAC – 2026-05-05 – Otimização Avançada de Performance e Hardening RLS

## Contexto

Após auditoria técnica baseada no skill `supabase-postgres-best-practices`, identificamos oportunidades de melhoria em duas frentes críticas:
1. **Performance de RLS**: Chamadas recorrentes a funções de contexto (`current_tenant_id`) sem caching.
2. **Eficiência de Índices Multi-Tenant**: Uso de índices de coluna única em cenários que exigem filtros compostos e ordenação temporal.

## Gap Identificado

| Recurso                         | Estado anterior     | Impacto/Melhoria                       |
|---------------------------------|---------------------|----------------------------------------|
| Políticas RLS                   | Chamada direta      | ~5-10x mais rápido com subquery caching |
| Índices de Jobs/Export          | BRIN ou Tenant-only | Suporte a `ORDER BY created_at DESC`   |
| Join de Topologia Canônica      | Índices separados   | Join O(1) com índice composto (tenant, id)|
| Redundância de Índices          | Vários single-col   | Remoção de índices cobertos por compostos|

## Solução Implementada (062_advanced_perf_rls_hardening.sql)

### 1. Hardening de RLS (security-rls-performance)

Envelopamos as chamadas `public.current_tenant_id()` em subqueries `(SELECT ...)`. Isso instrui o Postgres a avaliar a função uma única vez por query, em vez de uma vez por linha, melhorando drasticamente a performance em tabelas grandes.

**Exemplo de Mudança:**
```sql
-- Antes
USING (tenant_id = public.current_tenant_id())
-- Depois (Otimizado)
USING (tenant_id = (SELECT public.current_tenant_id()))
```

### 2. Índices Compostos Multi-Tenant (query-composite-indexes)

Para alinhar com o isolamento RLS (que sempre injeta `tenant_id` na query), criamos índices compostos que combinam o ID do tenant com as colunas de filtro e ordenação mais comuns.

| Tabela                | Novo Índice                             | Uso Principal                         |
|-----------------------|-----------------------------------------|---------------------------------------|
| `jobs`                | `idx_jobs_tenant_created_at_btree`      | Dashboards (Recent Jobs)              |
| `bt_export_history`   | `idx_bt_export_history_tenant_crea...` | Listagem BT por Tenant                |
| `canonical_poles`     | `idx_canonical_poles_tenant_id_logical` | Joins de integridade e lookup BIM     |
| `canonical_edges`     | `idx_canonical_edges_tenant_from_to`   | Travessia de grafo de rede            |

### 3. Migração para BTREE em Séries Temporais (Otimização de Sort)

Embora o BRIN seja eficiente para storage, ele não suporta `ORDER BY`. Adicionamos índices BTREE específicos para as rotas de API que exigem ordenação por `created_at DESC` (paginação de histórico).

### 4. Cleanup de Índices Redundantes

Removemos os índices de coluna única `tenant_id` nas tabelas afetadas, pois o Postgres utiliza o prefixo do índice composto para realizar filtros apenas por tenant quando necessário. Isso reduz o overhead de escrita e o tamanho do banco.

## Invariantes e Segurança

- **Idempotência**: A migration usa `DROP POLICY IF EXISTS` e `CREATE INDEX IF NOT EXISTS`.
- **Transacional**: Executado dentro de um bloco `BEGIN/COMMIT`.
- **Compatibilidade**: Mantém o isolamento total de dados exigido pelo Roadmap #32.

## Recomendação de Monitoramento

Após a aplicação, sugere-se monitorar a `pg_stat_statements` para verificar a redução no tempo médio de execução das queries nas tabelas `jobs` e `bt_export_history`.
