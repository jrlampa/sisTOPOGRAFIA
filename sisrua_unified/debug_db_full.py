#!/usr/bin/env python3
"""
TECH LEAD FULL DB DEBUG - SisRUA
Auditoria completa: RLS, políticas, índices, FKs, funções, dados órfãos,
integridade, performance, segurança e conformidade LGPD.
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2
from psycopg2.extras import RealDictCursor

SEP = "=" * 80
SUB = "-" * 60

def load_env():
    env_file = Path("sisrua_unified/.env")
    if not env_file.exists():
        env_file = Path(".env")
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()
    else:
        print("WARN: .env não encontrado")

def connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL não encontrado")
    result = urlparse(database_url)
    password = unquote(result.password) if result.password else None
    return psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=password,
        host=result.hostname,
        port=result.port or 5432,
        sslmode="require"
    )

issues = []

def flag(level, msg):
    issues.append((level, msg))
    icon = "[CRITICAL]" if level == "CRITICAL" else "[WARN]" if level == "WARN" else "[INFO]"
    print(f"  {icon} {msg}")

def run():
    load_env()
    conn = connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    print(SEP)
    print("   TECH LEAD DEBUG - SISRUA DATABASE FULL AUDIT")
    print(SEP)

    # ══════════════════════════════════════════════════════════
    # A. SCHEMA COMPLETO - TODAS AS TABELAS
    # ══════════════════════════════════════════════════════════
    print("\n[A] INVENTÁRIO DE TABELAS (public schema)")
    print(SUB)
    cur.execute("""
        SELECT t.tablename, t.rowsecurity,
               pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) AS size_pretty,
               s.n_live_tup AS live_rows,
               s.n_dead_tup AS dead_rows,
               count(p.policyname) AS policy_count
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
        LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
        WHERE t.schemaname = 'public'
        GROUP BY t.tablename, t.rowsecurity, size_pretty, s.n_live_tup, s.n_dead_tup
        ORDER BY t.tablename
    """)
    tables = cur.fetchall()
    for row in tables:
        rls = "RLS=ON " if row["rowsecurity"] else "RLS=OFF"
        pol = row["policy_count"] or 0
        live = row["live_rows"] or 0
        dead = row["dead_rows"] or 0
        size = row["size_pretty"] or "?"
        pol_warn = " ⚠ SEM POLICY" if row["rowsecurity"] and pol == 0 else ""
        dead_warn = " ⚠ DEAD TUPLES ALTO" if dead and dead > 500 else ""
        print(f"  {row['tablename']:<42} {rls} | policies={pol:<2} | rows={live:<6} | dead={dead:<5} | {size}{pol_warn}{dead_warn}")
        if row["rowsecurity"] and pol == 0:
            flag("CRITICAL", f"Tabela '{row['tablename']}' tem RLS habilitado mas ZERO policies — bloqueio total!")
        if dead and dead > 500:
            flag("WARN", f"Tabela '{row['tablename']}' com {dead} dead tuples — rodar VACUUM ANALYZE")

    # ══════════════════════════════════════════════════════════
    # B. RLS POLICIES DETALHADAS
    # ══════════════════════════════════════════════════════════
    print("\n[B] RLS POLICIES DETALHADAS")
    print(SUB)
    cur.execute("""
        SELECT tablename, policyname, cmd, roles, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
    """)
    policies = cur.fetchall()
    if not policies:
        flag("CRITICAL", "Nenhuma RLS policy encontrada no schema public!")
    else:
        cur_table = None
        for row in policies:
            if row["tablename"] != cur_table:
                print(f"\n  Tabela: {row['tablename']}")
                cur_table = row["tablename"]
            roles_str = ",".join(row["roles"]) if row["roles"] else "public"
            print(f"    [{row['cmd']:<6}] {row['policyname']:<50} roles={roles_str}")

    # ══════════════════════════════════════════════════════════
    # C. COLUNAS FALTANTES CRÍTICAS (tenant_id, deleted_at)
    # ══════════════════════════════════════════════════════════
    print("\n[C] COLUNAS CRÍTICAS POR TABELA")
    print(SUB)
    critical_cols = {
        "jobs": ["tenant_id", "deleted_at"],
        "dxf_tasks": ["tenant_id", "deleted_at"],
        "bt_export_history": ["tenant_id"],
        "audit_logs": ["tenant_id"],
        "tenants": ["is_active", "settings"],
        "user_roles": ["tenant_id"],
    }
    for table, cols in critical_cols.items():
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
        """, (table,))
        existing = {r["column_name"] for r in cur.fetchall()}
        for col in cols:
            if col in existing:
                print(f"  OK  {table}.{col}")
            else:
                print(f"  ERR {table}.{col} — AUSENTE")
                flag("CRITICAL", f"Coluna '{col}' ausente em '{table}'")

    # ══════════════════════════════════════════════════════════
    # D. INTEGRIDADE REFERENCIAL - REGISTROS ÓRFÃOS
    # ══════════════════════════════════════════════════════════
    print("\n[D] INTEGRIDADE REFERENCIAL — ÓRFÃOS")
    print(SUB)
    orphan_checks = [
        ("jobs",             "tenant_id", "tenants",  "id"),
        ("dxf_tasks",        "tenant_id", "tenants",  "id"),
        ("bt_export_history","tenant_id", "tenants",  "id"),
        ("user_roles",       "tenant_id", "tenants",  "id"),
    ]
    for child, child_col, parent, parent_col in orphan_checks:
        try:
            cur.execute(f"""
                SELECT COUNT(*) AS cnt
                FROM public.{child} c
                WHERE c.{child_col} IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM public.{parent} p
                      WHERE p.{parent_col} = c.{child_col}
                  )
            """)
            cnt = cur.fetchone()["cnt"]
            if cnt > 0:
                flag("CRITICAL", f"{child}.{child_col} tem {cnt} registros ÓRFÃOS (sem tenant em '{parent}')")
            else:
                print(f"  OK  {child}.{child_col} -> {parent}.{parent_col} — zero órfãos")
        except Exception as e:
            print(f"  SKIP {child} — {e}")
            conn.rollback()

    # ══════════════════════════════════════════════════════════
    # E. ÍNDICES POR TABELA
    # ══════════════════════════════════════════════════════════
    print("\n[E] ÍNDICES — COBERTURA POR TABELA")
    print(SUB)
    cur.execute("""
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
    """)
    indexes = cur.fetchall()
    idx_by_table = {}
    for row in indexes:
        idx_by_table.setdefault(row["tablename"], []).append(row["indexname"])

    for table, idx_list in sorted(idx_by_table.items()):
        print(f"  {table:<42} {len(idx_list)} índices: {', '.join(idx_list[:4])}{'...' if len(idx_list) > 4 else ''}")

    # Tabelas sem índice além do PK
    # Partições time-series (sufixo _YYYY_MM) e *_partitioned são design normal → INFO
    import re as _re
    _part_pattern = _re.compile(r'_\d{4}_\d{2}$|_partitioned$|^_migrations$|^audit_logs_partitioned$')
    tables_no_extra_idx = [t for t in [row["tablename"] for row in tables] if len(idx_by_table.get(t, [])) <= 1]
    if tables_no_extra_idx:
        for t in tables_no_extra_idx:
            if _part_pattern.search(t):
                flag("INFO", f"Tabela '{t}' tem apenas PK sem índices adicionais (partição — normal)")
            else:
                flag("WARN", f"Tabela '{t}' tem apenas PK sem índices adicionais")

    # ══════════════════════════════════════════════════════════
    # F. FUNÇÕES NO SCHEMA PUBLIC E PRIVATE
    # ══════════════════════════════════════════════════════════
    print("\n[F] FUNÇÕES REGISTRADAS (public / private)")
    print(SUB)
    cur.execute("""
        SELECT n.nspname AS schema, p.proname AS name,
               pg_get_function_identity_arguments(p.oid) AS args,
               p.prosecdef AS security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('public', 'private')
        ORDER BY n.nspname, p.proname
    """)
    funcs = cur.fetchall()
    for f in funcs:
        secdef = " [SECURITY DEFINER]" if f["security_definer"] else ""
        args_short = (f["args"][:60] + "...") if len(f["args"]) > 60 else f["args"]
        print(f"  {f['schema']:<10}.{f['name']:<45} ({args_short}){secdef}")
        if f["security_definer"] and f["schema"] == "public":
            # Verificar se search_path está protegido em proconfig
            cur.execute("""
                SELECT proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND p.proname=%s LIMIT 1
            """, (f["name"],))
            cfg_row = cur.fetchone()
            has_sp = cfg_row and cfg_row["proconfig"] and any("search_path" in c for c in cfg_row["proconfig"])
            if has_sp:
                flag("INFO", f"Função SECURITY DEFINER em schema PUBLIC: {f['name']} — search_path OK")
            else:
                flag("WARN", f"Função SECURITY DEFINER em schema PUBLIC: {f['name']} — search_path NÃO definido!")

    # ══════════════════════════════════════════════════════════
    # G. GRANTS EXCESSIVOS (anon/authenticated em tabelas críticas)
    # ══════════════════════════════════════════════════════════
    print("\n[G] GRANTS — ROLES anon/authenticated")
    print(SUB)
    cur.execute("""
        SELECT grantee, table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND grantee IN ('anon', 'authenticated')
        ORDER BY grantee, table_name, privilege_type
    """)
    grants = cur.fetchall()
    if not grants:
        print("  OK — Nenhum grant direto para anon/authenticated detectado")
    else:
        for row in grants:
            print(f"  {row['grantee']:<20} -> {row['table_name']:<35} [{row['privilege_type']}]")
            if row["grantee"] == "anon" and row["privilege_type"] in ("INSERT", "UPDATE", "DELETE"):
                flag("CRITICAL", f"anon tem {row['privilege_type']} em '{row['table_name']}' — risco de segurança!")
            elif row["grantee"] == "anon" and row["privilege_type"] == "SELECT":
                # Verificar se a tabela tem RLS habilitado (mitiga o risco)
                cur.execute("SELECT relrowsecurity FROM pg_class WHERE relname=%s AND relnamespace='public'::regnamespace", (row["table_name"],))
                rls_row = cur.fetchone()
                if rls_row and rls_row["relrowsecurity"]:
                    flag("INFO", f"anon tem SELECT em '{row['table_name']}' — RLS habilitado (protegido)")
                else:
                    flag("WARN", f"anon tem SELECT em '{row['table_name']}' — sem RLS, todos os dados expostos!")

    # ══════════════════════════════════════════════════════════
    # H. TABELAS DE CONFORMIDADE LGPD
    # ══════════════════════════════════════════════════════════
    print("\n[H] LGPD — CONFORMIDADE")
    print(SUB)
    lgpd_tables = [
        "lgpd_processing_activities",
        "lgpd_consent_records",
        "lgpd_rights_requests",
        "lgpd_security_incidents",
        "lgpd_data_lifecycle",
    ]
    for t in lgpd_tables:
        try:
            cur.execute(f"SELECT COUNT(*) AS cnt FROM public.{t}")
            cnt = cur.fetchone()["cnt"]
            print(f"  OK  {t:<45} {cnt} registros")
        except Exception:
            print(f"  ERR {t:<45} TABELA AUSENTE")
            flag("WARN", f"Tabela LGPD '{t}' não encontrada — conformidade incompleta")
            conn.rollback()

    # ══════════════════════════════════════════════════════════
    # I. JOBS / DXF_TASKS STATUS BREAKDOWN
    # ══════════════════════════════════════════════════════════
    print("\n[I] STATUS BREAKDOWN — jobs e dxf_tasks")
    print(SUB)
    for table in ("jobs", "dxf_tasks"):
        try:
            cur.execute(f"SELECT status, COUNT(*) AS cnt FROM public.{table} GROUP BY status ORDER BY cnt DESC")
            rows = cur.fetchall()
            print(f"\n  {table}:")
            for r in rows:
                print(f"    {r['status']:<20} -> {r['cnt']}")
            failed = [r for r in rows if r["status"] in ("failed", "error")]
            if failed:
                total_failed = sum(r["cnt"] for r in failed)
                flag("WARN", f"{table} tem {total_failed} registros em status de falha")
        except Exception as e:
            print(f"  ERR {table} — {e}")
            conn.rollback()

    # ══════════════════════════════════════════════════════════
    # J. AUDIT LOGS — ÚLTIMAS ENTRADAS
    # ══════════════════════════════════════════════════════════
    print("\n[J] AUDIT_LOGS — ÚLTIMAS 10 ENTRADAS")
    print(SUB)
    try:
        cur.execute("""
            SELECT id, action, table_name, changed_by, changed_at
            FROM public.audit_logs
            ORDER BY changed_at DESC
            LIMIT 10
        """)
        for row in cur.fetchall():
            print(f"  {str(row['changed_at'])[:19]} | {row['action']:<10} | {row['table_name']:<30} | user={row['changed_by']}")
    except Exception as e:
        print(f"  ERR audit_logs — {e}")
        flag("WARN", f"Não foi possível ler audit_logs: {e}")
        conn.rollback()

    # ══════════════════════════════════════════════════════════
    # K. PERFORMANCE — TAMANHO E BLOAT
    # ══════════════════════════════════════════════════════════
    print("\n[K] PERFORMANCE — TAMANHO DE TABELAS E BLOAT")
    print(SUB)
    cur.execute("""
        SELECT
            relname AS table_name,
            pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
            pg_size_pretty(pg_relation_size(relid)) AS table_size,
            pg_size_pretty(pg_indexes_size(relid)) AS index_size,
            n_live_tup AS live_rows,
            n_dead_tup AS dead_rows,
            CASE WHEN n_live_tup > 0 THEN round(n_dead_tup * 100.0 / (n_live_tup + n_dead_tup), 1) ELSE 0 END AS dead_pct
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 20
    """)
    for row in cur.fetchall():
        dead_warn = " << AUTOVACUUM PENDENTE" if row["dead_pct"] and float(row["dead_pct"]) > 10 else ""
        print(f"  {row['table_name']:<42} total={row['total_size']:<8} idx={row['index_size']:<8} live={row['live_rows']:<6} dead={row['dead_rows']:<5} ({row['dead_pct']}%){dead_warn}")

    # ══════════════════════════════════════════════════════════
    # L. ENUMS DEFINIDOS
    # ══════════════════════════════════════════════════════════
    print("\n[L] ENUMS")
    print(SUB)
    cur.execute("""
        SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname
    """)
    for row in cur.fetchall():
        print(f"  {row['typname']:<40} {row['labels']}")

    # ══════════════════════════════════════════════════════════
    # M. JOBS PG_CRON
    # ══════════════════════════════════════════════════════════
    print("\n[M] PG_CRON JOBS")
    print(SUB)
    try:
        cur.execute("SELECT jobid, schedule, command, nodename, active FROM cron.job ORDER BY jobid")
        for row in cur.fetchall():
            active_str = "ACTIVE" if row["active"] else "INACTIVE"
            print(f"  [{active_str}] id={row['jobid']:<4} {row['schedule']:<20} {row['command'][:60]}")
            if not row["active"]:
                flag("WARN", f"Job pg_cron id={row['jobid']} está INATIVO")
    except Exception as e:
        print(f"  ERR pg_cron — {e}")
        conn.rollback()

    # ══════════════════════════════════════════════════════════
    # N. TENANT DATA INTEGRITY
    # ══════════════════════════════════════════════════════════
    print("\n[N] TENANT INTEGRITY")
    print(SUB)
    cur.execute("SELECT id, slug, name, plan, is_active FROM public.tenants ORDER BY created_at")
    tenants = cur.fetchall()
    for t in tenants:
        print(f"  {t['slug']:<20} | {t['name']:<30} | plan={t['plan']:<12} | active={t['is_active']}")
        # Check if tenant is used in other tables
        for table in ("jobs", "dxf_tasks", "bt_export_history", "user_roles"):
            try:
                cur.execute(f"SELECT COUNT(*) AS cnt FROM public.{table} WHERE tenant_id = %s", (t["id"],))
                cnt = cur.fetchone()["cnt"]
                if cnt > 0:
                    print(f"    -> {table}: {cnt} registros")
            except Exception:
                conn.rollback()

    cur.close()
    conn.close()

    # ══════════════════════════════════════════════════════════
    # SUMÁRIO FINAL
    # ══════════════════════════════════════════════════════════
    print("\n" + SEP)
    print("   SUMÁRIO DE ISSUES ENCONTRADOS")
    print(SEP)
    criticals = [(l, m) for l, m in issues if l == "CRITICAL"]
    warns = [(l, m) for l, m in issues if l == "WARN"]
    infos = [(l, m) for l, m in issues if l == "INFO"]

    if criticals:
        print(f"\n  CRÍTICOS ({len(criticals)}):")
        for _, m in criticals:
            print(f"    [!] {m}")
    if warns:
        print(f"\n  AVISOS ({len(warns)}):")
        for _, m in warns:
            print(f"    [~] {m}")
    if infos:
        print(f"\n  INFO ({len(infos)}):")
        for _, m in infos:
            print(f"    [i] {m}")

    if not issues:
        print("\n  TUDO LIMPO! Nenhum problema detectado.")

    score = max(0, 100 - len(criticals) * 20 - len(warns) * 5)
    print(f"\n  DB HEALTH SCORE: {score}/100")
    print(SEP)

if __name__ == "__main__":
    run()
