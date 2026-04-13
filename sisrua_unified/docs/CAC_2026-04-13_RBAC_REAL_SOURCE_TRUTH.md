# CAC - RBAC Real com Enforcement por Recurso/Operação

## Identificação

- Data: 2026-04-13
- Tipo: Segurança + Arquitetura (Backend)
- Escopo: Role-Based Access Control (RBAC) com fonte confiável
- Branch: dev

## Contexto

Middleware `permissionHandler.ts` existia com placeholder desde origem:

- Linha 16: `const userRole = userId ? 'admin' : 'guest'`
- Todas as usuárias com ID recebiam permissão 'admin' automaticamente
- Sem persistência, sem auditoria, sem enforcement real
- Violação de princípio de least privilege

## Causa Raiz

1. **Placeholder não conectado a fonte confiável**: Papel inferido do mero existência de header
2. **Zero persistência**: Sem tabela de user_roles no banco de dados
3. **Sem auditoria**: Nenhum log de mudanças de papel
4. **Sem cache**: Cada request refazia lógica (mesmo que simples)
5. **Fallback inseguro**: Erro de banco não identificado (tudo virava 'guest')

## Mudanças Aplicadas

### 1. Migração SQL (020_user_roles_rbac.sql)

**Estrutura:**

- Enum `user_role`: 4 papéis (admin, technician, viewer, guest)
- Tabela `user_roles` (PK: user_id)
  - L12-20: Campos com constraint + default
  - Índices para query performance (role, last_updated)
- Tabela `user_roles_audit` (compliance)
  - L31-38: Log completo de mudanças (old_role → new_role)
  - Índices para auditoria temporal

**Triggers Automáticos:**

- `update_user_roles_timestamp()` (L46-50): Atualiza `last_updated` automaticamente
- `audit_user_roles_changes()` (L54-67): Log automático em INSERT + UPDATE

**Views for Operations:**

- `v_user_roles_summary` (L83–92): Relatório de distribuição de papéis

### 2. RoleService (server/services/roleService.ts)

**Cache Strategy:**

```typescript
const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

- Reduz latência e carga de banco
- Invalidação automática após 5 min
- Invalidação manual em `setUserRole()`

**Funções Core:**

1. **`getUserRole(userId): Promise<UserRole>`** — Recuperar papel
   - Checar cache primeiro (L41-44)
   - Query banco se miss (L45-70)
   - Fallback: 'viewer' se não encontrado (L72)
   - Fallback: 'viewer' em erro de banco (L77) — **seguro por padrão**

2. **`setUserRole(userId, role, assignedBy, reason): Promise<boolean>`** — Atribuir papel
   - Validar entrada (L114-116)
   - INSERT/UPDATE na tabela (com CONFLICT handling)
   - Invalidar cache após mudança (L133)
   - Log de auditoria automático (trigger)

3. **`getUsersByRole(role): Promise<UserRoleRecord[]>`** — Listar por papel
   - Suporte a relatórios de operação

4. **`getRoleStatistics(): Promise<Record<UserRole, number>>`** — Distribuição
   - Métricas para monitoramento

### 3. PermissionHandler (server/middleware/permissionHandler.ts)

**Antes (Placeholder):**

```typescript
const userRole = userId ? "admin" : "guest"; // ❌ INSEGURO
```

**Depois (Real RBAC):**

```typescript
const userRole = await getUserRole(userId); // ✅ Fonte confiável
```

**Matriz de Permissões (Declarativa):**

```typescript
const permissionsMatrix: Record<UserRole, Permission[]> = {
  admin: ["read", "write", "delete", "admin", "export_dxf", "bt_calculate"],
  technician: ["read", "write", "export_dxf", "bt_calculate"],
  viewer: ["read"],
  guest: [],
};
```

**Enforcement Flow:**

1. Extrair userId de headers/locals (L48–49)
2. Chamar `getUserRole()` — recuperar de banco (com cache) (L51)
3. Resolver permissões via matriz (L56)
4. Validar permissão solicitada (L59–60)
5. Log de sucesso/falha com contexto completo (L62–66, L74–80)
6. Fallback seguro em erro: negar (L83–90)

**Error Handling:**

- Try-catch abrangente com logging
- Falha de permissão = erro 401 com detalhes (required vs. provided)
- Erro de banco = negar acesso + log crítico

## Evidência Técnica

- ✅ SQL: Migração sem syntax errors, triggers validados
- ✅ TypeScript: Sem erros em roleService + permissionHandler
- ✅ Tipos: Union `UserRole = 'admin' | 'technician' | 'viewer' | 'guest'`
- ✅ Cache: TTL configurável, invalidação explícita e automática
- ✅ Logging: Grant/deny com context (userId, role, permission, path, requestId)

## Critério de Aceite

1. ✅ **Fonte confiável**: Papel vem do banco de dados (not placeholder)
2. ✅ **Cache com fallback**: 5min TTL + invalidação; fallback 'viewer' on error
3. ✅ **Enforcement por recurso/operação**: Matriz granular (read/write/delete/admin/export_dxf/bt_calculate)
4. ✅ **Auditoria completa**: Tabela `user_roles_audit` com trigger automático
5. ✅ **Zero brecha**: Sem mais mapeamento inseguro userId → admin

## Residual Risks

1. **Migration não aplicada**: Se migration 020 não rodar, roleService falhará no banco
   - Mitigação: Aplicar migração em CI/deployment
2. **Cache desatualizado**: Mudanças de papel têm delay até TTL expira
   - Mitigação: Suportar invalidação manual (admin endpoint futuro)
3. **Sem suporte a permission revocation imediata**: Sem webhook/event
   - Mitigação: Implementar listener de banco (Supabase realtime) em fase 2

## Mitigação Imediata

1. **Deploy**: Executar migration 020 antes de ativar novo permissionHandler
2. **Falback**: Implementar health check que valida existência de user_roles
3. **Monitoring**: Dashboard de mudanças de papel via `user_roles_audit`

## Rollback

- Reverter migration 020 + revert permissionHandler.ts para placeholder
- Role cache permanecerá em-memory (sem estado persistente)
