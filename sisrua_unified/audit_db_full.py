#!/usr/bin/env python3
"""
audit_db_full.py — Auditoria robusta e completa do banco de dados SisRUA.

Cobertura:
  1. Conectividade e metadados do servidor
  2. Migrations: aplicadas vs esperadas (001-045)
  3. Tabelas: existência, rowcounts, soft-delete coverage, RLS status
  4. Grants: anon/authenticated por tabela (detecta excessos)
  5. RLS: policies por tabela, tabelas com RLS ON e zero policies (deny-all)
  6. Índices críticos: presença e bloat estimado
  7. Constraints: PKs, UKs, FKs — tabelas sem PK
  8. Triggers: presença de updated_at por tabela com updated_at col
  9. Funções críticas: set_updated_at, current_tenant_id, verify_backup_integrity
 10. Views de compliance: existência e acessibilidade
 11. Particionamento: parent + child tables, RLS nas child
 12. dxf_tasks: contagem por status, failed sem artifact_sha256
 13. jobs: contagem por status, jobs presos
 14. audit_logs: volume, cobertura de tabelas
 15. Resumo executivo de achados críticos, avisos e OK
"""

import os
import re
import sys
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse, unquote

# Force UTF-8 stdout on Windows to avoid UnicodeEncodeError with emoji characters
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ──────────────────────────────────────────────────────────────────────────────
# Bootstrap — .env loading
# ──────────────────────────────────────────────────────────────────────────────

def _load_env() -> None:
    for candidate in [Path(".env"), Path("sisrua_unified/.env"), Path("../.env")]:
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
            return

def _sanitize_db_url(url: str | None) -> str | None:
    if not url:
        return url
    return re.sub(r"%(?![0-9A-Fa-f]{2})", "%25", url)

_load_env()

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("[FATAL] psycopg2 não instalado. Execute: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = _sanitize_db_url(os.getenv("DATABASE_URL"))
if not DATABASE_URL:
    print("[FATAL] DATABASE_URL não encontrado no ambiente ou em .env")
    sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────────
# DB connection
# ──────────────────────────────────────────────────────────────────────────────

def _connect():
    try:
        parsed = urlparse(DATABASE_URL)
        return psycopg2.connect(
            database=parsed.path.lstrip("/"),
            user=parsed.username,
            password=unquote(parsed.password) if parsed.password else None,
            host=parsed.hostname,
            port=parsed.port or 5432,
            sslmode="require",
            connect_timeout=10,
        )
    except Exception as e:
        print(f"[FATAL] Falha ao conectar ao banco: {e}")
        sys.exit(1)

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

FINDINGS: list[dict] = []   # {level: "CRIT"|"WARN"|"OK"|"INFO", area, message}

def _record(level: str, area: str, message: str) -> None:
    FINDINGS.append({"level": level, "area": area, "message": message})
    prefix = {"CRIT": "❌ CRÍTICO", "WARN": "⚠️  AVISO  ", "OK": "✅ OK     ", "INFO": "ℹ️  INFO   "}.get(level, level)
    print(f"  {prefix} [{area}] {message}")

def _section(title: str) -> None:
    print(f"\n{'=' * 72}")
    print(f"  {title}")
    print("=" * 72)

def _q(cur, sql: str, params=None):
    cur.execute(sql, params)
    return cur.fetchall()

# ──────────────────────────────────────────────────────────────────────────────
# EXPECTED migrations (001-045 filesystem)
# ──────────────────────────────────────────────────────────────────────────────

def _expected_migrations() -> list[str]:
    migrations_dir = Path("migrations")
    if not migrations_dir.exists():
        migrations_dir = Path("sisrua_unified/migrations")
    if not migrations_dir.exists():
        return []
    return sorted(p.name for p in migrations_dir.glob("*.sql"))

# ──────────────────────────────────────────────────────────────────────────────
# Audit sections
# ──────────────────────────────────────────────────────────────────────────────

def audit_connectivity(cur) -> None:
    _section("1. CONECTIVIDADE E METADADOS DO SERVIDOR")
    rows = _q(cur, "SELECT current_database(), version(), NOW() AS server_time, current_user")
    r = rows[0]
    print(f"  Database : {r['current_database']}")
    print(f"  Version  : {r['version'][:60]}")
    print(f"  Timestamp: {r['server_time']}")
    print(f"  User     : {r['current_user']}")
    _record("OK", "Conectividade", f"Conectado como {r['current_user']} em {r['current_database']}")


def audit_migrations(cur) -> None:
    _section("2. MIGRATIONS: ESPERADAS VS APLICADAS")
    expected = _expected_migrations()

    # Check if _migrations table exists
    rows = _q(cur, "SELECT COUNT(*) AS cnt FROM pg_tables WHERE tablename = '_migrations' AND schemaname = 'public'")
    if rows[0]["cnt"] == 0:
        _record("CRIT", "Migrations", "Tabela _migrations NÃO EXISTE no banco — nenhuma migration foi rastreada.")
        return

    applied = {r["filename"] for r in _q(cur, "SELECT filename FROM public._migrations ORDER BY applied_at")}
    print(f"  Arquivos no filesystem : {len(expected)}")
    print(f"  Aplicadas no banco     : {len(applied)}")

    expected_set = set(expected)
    missing = sorted(expected_set - applied)
    orphan  = sorted(applied - expected_set)

    if missing:
        _record("CRIT", "Migrations", f"{len(missing)} migration(s) NÃO APLICADAS: {', '.join(missing)}")
        for m in missing:
            print(f"    ⛔ FALTANDO: {m}")
    else:
        _record("OK", "Migrations", "Todas as migrations do filesystem estão aplicadas no banco.")

    if orphan:
        _record("WARN", "Migrations", f"{len(orphan)} migration(s) no banco SEM arquivo no filesystem: {', '.join(orphan)}")

    # Detail last 5 applied
    rows = _q(cur, "SELECT filename, applied_at FROM public._migrations ORDER BY applied_at DESC LIMIT 5")
    print("\n  Últimas 5 aplicadas:")
    for r in rows:
        print(f"    {r['applied_at']}  {r['filename']}")


def audit_tables(cur) -> None:
    _section("3. TABELAS: EXISTÊNCIA, ROWCOUNTS E COBERTURA")

    CORE_TABLES = [
        "jobs", "dxf_tasks", "bt_export_history", "constants_catalog",
        "audit_logs", "user_roles", "tenants", "_migrations",
        "lgpd_consent_records", "lgpd_data_lifecycle",
        "tenant_service_profiles",
    ]

    rows = _q(cur, """
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    """)
    all_tables = {r["tablename"] for r in rows}
    print(f"  Total de tabelas em public: {len(all_tables)}")

    missing_core = []
    for t in CORE_TABLES:
        if t not in all_tables:
            missing_core.append(t)

    if missing_core:
        _record("CRIT", "Tabelas", f"Tabelas CRÍTICAS ausentes: {', '.join(missing_core)}")
    else:
        _record("OK", "Tabelas", "Todas as tabelas críticas existem.")

    # Row counts for core tables
    print("\n  Rowcounts (tabelas principais):")
    for t in sorted(CORE_TABLES):
        if t in all_tables:
            try:
                cnt = _q(cur, f"SELECT COUNT(*) AS cnt FROM public.{t}")[0]["cnt"]
                print(f"    {t:<45} {cnt:>8} linhas")
            except Exception as e:
                print(f"    {t:<45} ERRO: {e}")

    # Tabelas com deleted_at (soft-delete) — verifica uso
    rows_sd = _q(cur, """
        SELECT t.tablename
        FROM pg_tables t
        JOIN information_schema.columns c
          ON c.table_schema = 'public'
         AND c.table_name = t.tablename
         AND c.column_name = 'deleted_at'
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
    """)
    sd_tables = [r["tablename"] for r in rows_sd]
    _record("INFO", "Soft-Delete", f"{len(sd_tables)} tabela(s) com coluna deleted_at: {', '.join(sd_tables)}")


def audit_rls(cur) -> None:
    _section("4. RLS: STATUS E POLICIES POR TABELA")

    rows = _q(cur, """
        SELECT
            c.relname        AS tablename,
            c.relrowsecurity AS rls_enabled,
            COUNT(p.polname) AS policy_count
        FROM pg_class c
        LEFT JOIN pg_policy p ON p.polrelid = c.oid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        GROUP BY c.relname, c.relrowsecurity
        ORDER BY c.relname
    """)

    rls_on_no_policy = []
    rls_off = []
    rls_ok  = []
    for r in rows:
        if r["rls_enabled"] and r["policy_count"] == 0:
            rls_on_no_policy.append(r["tablename"])
        elif not r["rls_enabled"]:
            rls_off.append(r["tablename"])
        else:
            rls_ok.append(r["tablename"])

    # Critical tables that MUST have RLS
    MUST_RLS = ["jobs", "dxf_tasks", "bt_export_history", "audit_logs",
                "user_roles", "tenants", "lgpd_data_lifecycle",
                "lgpd_consent_records", "tenant_service_profiles"]

    critical_rls_missing = [t for t in MUST_RLS if t in rls_off]
    if critical_rls_missing:
        _record("CRIT", "RLS", f"Tabelas críticas SEM RLS habilitado: {', '.join(critical_rls_missing)}")
    else:
        _record("OK", "RLS", "Todas as tabelas críticas têm RLS habilitado.")

    if rls_on_no_policy:
        _record("WARN", "RLS", f"{len(rls_on_no_policy)} tabela(s) com RLS ON mas ZERO policies (deny-all acidental): {', '.join(rls_on_no_policy[:10])}")
    else:
        _record("OK", "RLS", "Nenhuma tabela com RLS ON e zero policies.")

    print(f"\n  Resumo RLS:")
    print(f"    RLS ON + policies : {len(rls_ok)}")
    print(f"    RLS ON + 0 policy : {len(rls_on_no_policy)}")
    print(f"    RLS OFF           : {len(rls_off)}")

    # Print tables with RLS ON and 0 policies
    if rls_on_no_policy:
        print(f"\n  Tabelas RLS ON / 0 policies (deny-all):")
        for t in rls_on_no_policy[:20]:
            print(f"    ⛔ {t}")
        if len(rls_on_no_policy) > 20:
            print(f"    ... +{len(rls_on_no_policy) - 20} tabelas")


def audit_grants(cur) -> None:
    _section("5. GRANTS: ANON / AUTHENTICATED (EXCESSOS)")

    rows = _q(cur, """
        SELECT grantee, table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND grantee IN ('anon', 'authenticated')
          AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
        ORDER BY table_name, grantee, privilege_type
    """)

    if rows:
        _record("CRIT", "Grants", f"{len(rows)} grant(s) DML excessivos para anon/authenticated detectados!")
        for r in rows[:20]:
            print(f"    ⛔ GRANT {r['privilege_type']} ON {r['table_name']} TO {r['grantee']}")
        if len(rows) > 20:
            print(f"    ... +{len(rows) - 20} grants adicionais")
    else:
        _record("OK", "Grants", "Nenhum grant DML excessivo para anon/authenticated.")

    # Also check SELECT grants for sensitive tables
    SENSITIVE_TABLES = ["audit_logs", "user_roles", "tenants",
                        "lgpd_consent_records", "lgpd_data_lifecycle"]
    rows_anon_select = _q(cur, """
        SELECT table_name, grantee
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND grantee = 'anon'
          AND privilege_type = 'SELECT'
          AND table_name = ANY(%s)
    """, (SENSITIVE_TABLES,))
    if rows_anon_select:
        for r in rows_anon_select:
            _record("WARN", "Grants", f"GRANT SELECT ON {r['table_name']} TO anon — tabela sensível exposta a anônimos.")
    else:
        _record("OK", "Grants", "Nenhuma tabela sensível com SELECT para anon.")


def audit_indexes(cur) -> None:
    _section("6. ÍNDICES CRÍTICOS")

    REQUIRED_INDEXES = [
        # (table, column_hint) — verificação por coluna presente no indexdef
        ("jobs",          "status"),
        ("jobs",          "updated_at"),
        ("dxf_tasks",     "status"),
        ("dxf_tasks",     "idempotency_key"),
        ("bt_export_history", "tenant_id"),
        ("audit_logs",    "table_name"),
        ("audit_logs",    "changed_at"),
        ("constants_catalog", "environment"),
        ("tenants",       "slug"),
    ]

    rows = _q(cur, """
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
    """)
    index_map: dict[str, list[str]] = {}
    for r in rows:
        index_map.setdefault(r["tablename"], []).append(r["indexdef"].lower())

    missing_indexes = []
    for table, col in REQUIRED_INDEXES:
        defs = index_map.get(table, [])
        found = any(col.lower() in d for d in defs)
        if not found:
            missing_indexes.append(f"{table}({col})")

    if missing_indexes:
        _record("WARN", "Índices", f"Índices potencialmente ausentes: {', '.join(missing_indexes)}")
    else:
        _record("OK", "Índices", "Todos os índices críticos identificados estão presentes.")

    total_indexes = sum(len(v) for v in index_map.values())
    print(f"\n  Total de índices em public: {total_indexes}")


def audit_constraints(cur) -> None:
    _section("7. CONSTRAINTS: PKs, UKs, FKs")

    # Tables without PK (excluding partitioned parents and _migrations)
    rows = _q(cur, """
        SELECT t.tablename
        FROM pg_tables t
        LEFT JOIN pg_constraint c
          ON c.conrelid = (quote_ident('public') || '.' || quote_ident(t.tablename))::regclass
         AND c.contype = 'p'
        WHERE t.schemaname = 'public'
          AND c.conname IS NULL
          AND t.tablename NOT LIKE '%_partitioned%'
        ORDER BY t.tablename
    """)
    no_pk_tables = [r["tablename"] for r in rows if r["tablename"] != "_migrations"]

    if no_pk_tables:
        _record("WARN", "Constraints", f"{len(no_pk_tables)} tabela(s) sem PK: {', '.join(no_pk_tables[:10])}")
    else:
        _record("OK", "Constraints", "Todas as tabelas têm Primary Key.")

    # FK count
    rows_fk = _q(cur, """
        SELECT COUNT(*) AS cnt
        FROM information_schema.referential_constraints
        WHERE constraint_schema = 'public'
    """)
    _record("INFO", "Constraints", f"Total de Foreign Keys: {rows_fk[0]['cnt']}")


def audit_triggers(cur) -> None:
    _section("8. TRIGGERS: updated_at")

    # Tables with updated_at col (excluding partition children, parent partitioned tables, and views — triggers are inherited/N.A.)
    rows_cols = _q(cur, """
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN pg_class cls ON cls.relname = c.table_name
        JOIN pg_namespace n ON n.oid = cls.relnamespace
        WHERE c.table_schema = 'public'
          AND c.column_name = 'updated_at'
          AND n.nspname = 'public'
          AND cls.relispartition = FALSE   -- exclude partition children
          AND cls.relkind = 'r'            -- only regular tables (not views 'v', partitioned parents 'p')
        ORDER BY c.table_name
    """)
    tables_with_uat = {r["table_name"] for r in rows_cols}

    # Tables with an update trigger
    rows_trg = _q(cur, """
        SELECT event_object_table AS tablename
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND event_manipulation = 'UPDATE'
        GROUP BY event_object_table
    """)
    tables_with_trigger = {r["tablename"] for r in rows_trg}

    missing = sorted(tables_with_uat - tables_with_trigger)
    if missing:
        _record("WARN", "Triggers", f"{len(missing)} tabela(s) com updated_at SEM trigger de atualização: {', '.join(missing[:10])}")
    else:
        _record("OK", "Triggers", "Todas as tabelas com updated_at têm trigger de atualização.")


def audit_functions(cur) -> None:
    _section("9. FUNÇÕES CRÍTICAS")

    REQUIRED_FUNCTIONS = [
        "set_updated_at",
        "current_tenant_id",
        "verify_backup_integrity",
        "set_tenant_service_profiles_updated_at",
    ]

    rows = _q(cur, """
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_type = 'FUNCTION'
        ORDER BY routine_name
    """)
    existing_fns = {r["routine_name"] for r in rows}

    for fn in REQUIRED_FUNCTIONS:
        if fn in existing_fns:
            _record("OK", "Funções", f"Função {fn}() existe.")
        else:
            _record("WARN", "Funções", f"Função {fn}() NÃO encontrada.")

    print(f"\n  Total de funções em public: {len(existing_fns)}")


def audit_views(cur) -> None:
    _section("10. VIEWS DE COMPLIANCE")

    rows = _q(cur, """
        SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname
    """)
    views = {r["viewname"] for r in rows}
    print(f"  Total de views em public: {len(views)}")

    EXPECTED_VIEWS = [
        "v_lgpd_retention_due",
        "v_audit_summary",
        "v_constants_catalog_latest",
    ]
    for v in EXPECTED_VIEWS:
        if v in views:
            _record("OK", "Views", f"View {v} existe.")
        else:
            _record("WARN", "Views", f"View {v} ausente.")


def audit_partitioning(cur) -> None:
    _section("11. PARTICIONAMENTO")

    rows = _q(cur, """
        SELECT c.relname AS tablename,
               c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relispartition = TRUE
        ORDER BY c.relname
    """)

    child_with_rls = [r["tablename"] for r in rows if r["rls_enabled"]]
    total_children = len(rows)

    print(f"  Total de tabelas child (partições): {total_children}")
    if child_with_rls:
        _record("WARN", "Particionamento", f"{len(child_with_rls)} child table(s) com RLS habilitado (redundante — policies vivem no parent): {', '.join(child_with_rls[:5])}")
    else:
        _record("OK", "Particionamento", "Nenhuma child table com RLS habilitado (correto).")

    # Check parent tables
    parent_rows = _q(cur, """
        SELECT c.relname AS tablename
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'p'
        ORDER BY c.relname
    """)
    if parent_rows:
        print(f"  Tabelas parent particionadas: {', '.join(r['tablename'] for r in parent_rows)}")
        _record("INFO", "Particionamento", f"{len(parent_rows)} tabela(s) parent particionadas encontradas.")


def audit_dxf_tasks(cur) -> None:
    _section("12. dxf_tasks: STATUS E SAÚDE")

    rows = _q(cur, """
        SELECT status, COUNT(*) AS cnt
        FROM public.dxf_tasks
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY status
    """)
    total = sum(r["cnt"] for r in rows)
    print(f"  Total dxf_tasks (não deletadas): {total}")
    for r in rows:
        print(f"    {r['status']:<15} {r['cnt']:>6} tasks")

    # Failed sem artifact
    rows_failed = _q(cur, """
        SELECT COUNT(*) AS cnt
        FROM public.dxf_tasks
        WHERE status = 'failed'
          AND deleted_at IS NULL
          AND artifact_sha256 IS NULL
    """)
    cnt_failed_no_artifact = rows_failed[0]["cnt"]

    if cnt_failed_no_artifact > 0:
        _record("WARN", "dxf_tasks", f"{cnt_failed_no_artifact} tasks failed sem artifact_sha256 (possíveis resíduos de testes)")
    else:
        _record("OK", "dxf_tasks", "Nenhuma task failed sem artifact_sha256.")

    # Failed com erro de parâmetros (soft-deletado vs vivo)
    rows_bad = _q(cur, """
        SELECT COUNT(*) AS cnt
        FROM public.dxf_tasks
        WHERE status = 'failed'
          AND deleted_at IS NULL
          AND (error LIKE 'Missing required parameters%' OR error LIKE 'Python script%failed with code 1%')
    """)
    cnt_bad = rows_bad[0]["cnt"]
    if cnt_bad > 0:
        _record("CRIT", "dxf_tasks", f"{cnt_bad} task(s) failed com erros de parâmetro AINDA ATIVAS (deveriam estar soft-deleted)")
    else:
        _record("OK", "dxf_tasks", "Nenhuma task failed com erros de parâmetro ativa.")

    # Stuck in processing
    rows_stuck = _q(cur, """
        SELECT COUNT(*) AS cnt
        FROM public.dxf_tasks
        WHERE status = 'processing'
          AND deleted_at IS NULL
          AND updated_at < NOW() - INTERVAL '2 hours'
    """)
    cnt_stuck = rows_stuck[0]["cnt"]
    if cnt_stuck > 0:
        _record("WARN", "dxf_tasks", f"{cnt_stuck} task(s) presas em 'processing' por mais de 2 horas.")
    else:
        _record("OK", "dxf_tasks", "Nenhuma task presa em processing.")


def audit_jobs(cur) -> None:
    _section("13. jobs: STATUS E SAÚDE")

    rows = _q(cur, """
        SELECT status, COUNT(*) AS cnt
        FROM public.jobs
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY status
    """)
    for r in rows:
        print(f"    {r['status']:<15} {r['cnt']:>6} jobs")

    # Stuck jobs
    rows_stuck = _q(cur, """
        SELECT COUNT(*) AS cnt
        FROM public.jobs
        WHERE status IN ('processing', 'queued')
          AND deleted_at IS NULL
          AND updated_at < NOW() - INTERVAL '6 hours'
    """)
    cnt_stuck = rows_stuck[0]["cnt"]
    if cnt_stuck > 0:
        _record("WARN", "jobs", f"{cnt_stuck} job(s) presos em processing/queued por mais de 6 horas.")
    else:
        _record("OK", "jobs", "Nenhum job preso em processing/queued.")


def audit_audit_logs(cur) -> None:
    _section("14. audit_logs: VOLUME E COBERTURA")

    # Check if deleted_at column exists on audit_logs
    has_deleted_at = _table_has_column(cur, "audit_logs", "deleted_at")
    where_clause = "WHERE deleted_at IS NULL" if has_deleted_at else ""

    rows_total = _q(cur, f"SELECT COUNT(*) AS cnt FROM public.audit_logs {where_clause}")
    cnt_total = rows_total[0]["cnt"]
    print(f"  Total de audit_logs ativos: {cnt_total}")

    rows_tables = _q(cur, f"""
        SELECT table_name, COUNT(*) AS cnt
        FROM public.audit_logs
        {where_clause}
        GROUP BY table_name
        ORDER BY cnt DESC
        LIMIT 10
    """)
    print("  Top 10 tabelas auditadas:")
    for r in rows_tables:
        print(f"    {r['table_name']:<40} {r['cnt']:>8} logs")

    if cnt_total == 0:
        _record("WARN", "audit_logs", "Nenhum audit_log encontrado — triggers de auditoria podem estar inativos.")
    else:
        _record("OK", "audit_logs", f"{cnt_total} logs de auditoria ativos.")


def audit_lgpd(cur) -> None:
    _section("15. LGPD: CONFORMIDADE")

    # Check lgpd_consent_records
    tables_to_check = ["lgpd_consent_records", "lgpd_data_lifecycle"]
    for t in tables_to_check:
        rows = _q(cur, "SELECT COUNT(*) AS cnt FROM pg_tables WHERE schemaname='public' AND tablename=%s", (t,))
        if rows[0]["cnt"] > 0:
            cnt_rows = _q(cur, f"SELECT COUNT(*) AS cnt FROM public.{t}")[0]["cnt"]
            _record("OK", "LGPD", f"Tabela {t} existe com {cnt_rows} registro(s).")
        else:
            _record("CRIT", "LGPD", f"Tabela {t} AUSENTE — conformidade LGPD comprometida.")

    # Check lgpd_data_lifecycle has seed data
    if _table_exists_check(cur, "lgpd_data_lifecycle"):
        has_del = _table_has_column(cur, "lgpd_data_lifecycle", "deleted_at")
        where = "WHERE deleted_at IS NULL" if has_del else ""
        rows_seed = _q(cur, f"SELECT COUNT(*) AS cnt FROM public.lgpd_data_lifecycle {where}")
    else:
        rows_seed = [{"cnt": 0}]
    if rows_seed[0]["cnt"] < 5:
        _record("WARN", "LGPD", "lgpd_data_lifecycle tem menos de 5 categorias — seed incompleto.")
    else:
        _record("OK", "LGPD", f"lgpd_data_lifecycle com {rows_seed[0]['cnt']} categoria(s) ativas.")


def _table_exists_check(cur, table: str) -> bool:
    rows = _q(cur, "SELECT COUNT(*) AS cnt FROM pg_tables WHERE schemaname='public' AND tablename=%s", (table,))
    return rows[0]["cnt"] > 0


def _table_has_column(cur, table: str, column: str) -> bool:
    rows = _q(cur, """
        SELECT COUNT(*) AS cnt FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s AND column_name=%s
    """, (table, column))
    return rows[0]["cnt"] > 0


# ──────────────────────────────────────────────────────────────────────────────
# Summary report
# ──────────────────────────────────────────────────────────────────────────────

def print_summary() -> None:
    _section("RESUMO EXECUTIVO")

    crits  = [f for f in FINDINGS if f["level"] == "CRIT"]
    warns  = [f for f in FINDINGS if f["level"] == "WARN"]
    oks    = [f for f in FINDINGS if f["level"] == "OK"]
    infos  = [f for f in FINDINGS if f["level"] == "INFO"]

    print(f"\n  ❌ CRÍTICO  : {len(crits)}")
    print(f"  ⚠️  AVISO    : {len(warns)}")
    print(f"  ✅ OK       : {len(oks)}")
    print(f"  ℹ️  INFO     : {len(infos)}")

    if crits:
        print("\n  ── ACHADOS CRÍTICOS (requerem ação imediata) ────────────────────────────")
        for f in crits:
            print(f"  [{f['area']}] {f['message']}")

    if warns:
        print("\n  ── AVISOS (recomendado corrigir) ─────────────────────────────────────────")
        for f in warns:
            print(f"  [{f['area']}] {f['message']}")

    verdict = "✅ BANCO SAUDÁVEL" if not crits else "❌ AÇÃO IMEDIATA NECESSÁRIA"
    print(f"\n  ════════════════════════════════════════════════════════════════════════")
    print(f"  VEREDICTO: {verdict}")
    print(f"  Auditoria concluída em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  ════════════════════════════════════════════════════════════════════════")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 72)
    print("  SisRUA — AUDITORIA ROBUSTA E COMPLETA DO BANCO DE DADOS")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        audit_connectivity(cur)
        audit_migrations(cur)
        audit_tables(cur)
        audit_rls(cur)
        audit_grants(cur)
        audit_indexes(cur)
        audit_constraints(cur)
        audit_triggers(cur)
        audit_functions(cur)
        audit_views(cur)
        audit_partitioning(cur)
        audit_dxf_tasks(cur)
        audit_jobs(cur)
        audit_audit_logs(cur)
        audit_lgpd(cur)
    finally:
        cur.close()
        conn.close()

    print_summary()

    # Exit code: 1 if critical findings
    crits = [f for f in FINDINGS if f["level"] == "CRIT"]
    sys.exit(1 if crits else 0)


if __name__ == "__main__":
    main()
