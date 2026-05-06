#!/usr/bin/env python3
"""Auditoria live do banco – diagnóstico operacional completo.

Domínios verificados:
  A) Locks e waits ativos
  B) Queries lentas (pg_stat_statements)
  C) Saúde de índices (seq-scan vs idx-scan, índices não utilizados)
  D) Bloat estimado de tabelas e índices
  E) Conexões e pool
  F) Tabelas sem RLS habilitado (schema public)
  G) Grants excessivos remanescentes (anon/authenticated DML)
  H) Integridade do tracking de migrations (_migrations vs arquivos .sql)

Saída: relatório Markdown + JSON em artifacts/audit-live-<timestamp>.{md,json}
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "migrations"
ARTIFACTS_DIR = ROOT / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

NOW = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


# ─── helpers ──────────────────────────────────────────────────────────────────

def load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def risk(level: str) -> str:
    return {"HIGH": "🔴 ALTO", "MEDIUM": "🟡 MÉDIO", "LOW": "🟢 BAIXO", "OK": "✅ OK"}.get(level, level)


# ─── checks ───────────────────────────────────────────────────────────────────

def check_locks(cur) -> dict:
    cur.execute("""
        SELECT
            pid,
            now() - query_start AS duration,
            state,
            wait_event_type,
            wait_event,
            left(query, 120) AS query_snippet
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query_start IS NOT NULL
          AND now() - query_start > interval '5 seconds'
        ORDER BY duration DESC
        LIMIT 20
    """)
    rows = cur.fetchall()

    cur.execute("""
        SELECT count(*) AS cnt FROM pg_locks WHERE NOT granted
    """)
    blocked = cur.fetchone()["cnt"]

    findings = []
    for r in rows:
        dur_s = r["duration"].total_seconds() if r["duration"] else 0
        findings.append({
            "pid": r["pid"],
            "duration_s": round(dur_s, 1),
            "state": r["state"],
            "wait_event": f"{r['wait_event_type']}/{r['wait_event']}",
            "query": r["query_snippet"],
        })

    level = "OK"
    if blocked > 0:
        level = "HIGH"
    elif any(f["duration_s"] > 30 for f in findings):
        level = "MEDIUM"
    elif findings:
        level = "LOW"

    return {"domain": "Locks / Waits ativos", "level": level,
            "blocked_count": blocked, "long_running": findings}


def check_slow_queries(cur) -> dict:
    # pg_stat_statements may not be installed – graceful fallback
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) AS has_ext
    """)
    has_ext = cur.fetchone()["has_ext"]

    if not has_ext:
        return {"domain": "Queries lentas (pg_stat_statements)", "level": "LOW",
                "note": "Extensão pg_stat_statements não instalada. Instalar para visibilidade completa."}

    cur.execute("""
        SELECT
            round(total_exec_time::numeric, 2)   AS total_ms,
            calls,
            round(mean_exec_time::numeric, 2)    AS mean_ms,
            round(stddev_exec_time::numeric, 2)  AS stddev_ms,
            rows,
            left(query, 140)                     AS query_snippet
        FROM pg_stat_statements
        WHERE calls > 5
        ORDER BY mean_exec_time DESC
        LIMIT 15
    """)
    rows = cur.fetchall()
    findings = [dict(r) for r in rows]

    level = "OK"
    if any(r["mean_ms"] > 2000 for r in findings):
        level = "HIGH"
    elif any(r["mean_ms"] > 500 for r in findings):
        level = "MEDIUM"
    elif findings:
        level = "LOW"

    return {"domain": "Queries lentas (pg_stat_statements)", "level": level, "top_queries": findings}


def check_index_health(cur) -> dict:
    # Unused indexes (never scanned, not PK/unique)
    cur.execute("""
        SELECT
            schemaname,
            relname        AS table_name,
            indexrelname   AS index_name,
            idx_scan,
            pg_size_pretty(pg_relation_size(indexrelid)) AS size
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
          AND schemaname = 'public'
          AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            WHERE c.conindid = indexrelid
          )
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
    """)
    unused = [dict(r) for r in cur.fetchall()]

    # Tables with heavy seq-scan but no or low idx-scan
    cur.execute("""
        SELECT
            schemaname,
            relname          AS table_name,
            seq_scan,
            idx_scan,
            n_live_tup,
            pg_size_pretty(pg_total_relation_size(relid)) AS total_size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND seq_scan > 100
          AND (idx_scan = 0 OR seq_scan > idx_scan * 5)
          AND n_live_tup > 500
        ORDER BY seq_scan DESC
        LIMIT 15
    """)
    seq_heavy = [dict(r) for r in cur.fetchall()]

    level = "OK"
    if seq_heavy:
        level = "HIGH" if any(r["n_live_tup"] > 10000 for r in seq_heavy) else "MEDIUM"
    elif unused:
        level = "LOW"

    return {"domain": "Saúde de índices", "level": level,
            "unused_indexes": unused, "seq_scan_heavy_tables": seq_heavy}


def check_bloat(cur) -> dict:
    cur.execute("""
        SELECT
            schemaname,
            relname                                                                AS tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname))      AS total_size,
            pg_size_pretty(pg_relation_size(schemaname||'.'||relname))            AS table_size,
            n_dead_tup,
            n_live_tup,
            CASE WHEN n_live_tup > 0
                 THEN round(100.0 * n_dead_tup / GREATEST(n_live_tup, 1), 1)
                 ELSE 0 END AS dead_pct,
            last_autovacuum,
            last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND n_dead_tup > 100
        ORDER BY dead_pct DESC, n_dead_tup DESC
        LIMIT 20
    """)
    rows = cur.fetchall()
    findings = []
    for r in rows:
        d = dict(r)
        d["last_autovacuum"] = str(d["last_autovacuum"]) if d["last_autovacuum"] else "nunca"
        d["last_autoanalyze"] = str(d["last_autoanalyze"]) if d["last_autoanalyze"] else "nunca"
        findings.append(d)

    level = "OK"
    if any(r["dead_pct"] > 20 for r in findings):
        level = "HIGH"
    elif any(r["dead_pct"] > 5 for r in findings):
        level = "MEDIUM"
    elif findings:
        level = "LOW"

    return {"domain": "Bloat de tabelas (dead tuples)", "level": level, "tables": findings}


def check_connections(cur) -> dict:
    cur.execute("""
        SELECT
            max_conn,
            used,
            reserved_superuser,
            max_conn - used AS available
        FROM (
            SELECT
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
                COUNT(*) AS used,
                (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections') AS reserved_superuser
            FROM pg_stat_activity
        ) t
    """)
    r = cur.fetchone()
    pct = round(100.0 * r["used"] / r["max_conn"], 1) if r["max_conn"] else 0

    cur.execute("""
        SELECT state, count(*) AS cnt
        FROM pg_stat_activity
        GROUP BY state
        ORDER BY cnt DESC
    """)
    by_state = {row["state"] or "null": row["cnt"] for row in cur.fetchall()}

    level = "OK"
    if pct > 80:
        level = "HIGH"
    elif pct > 60:
        level = "MEDIUM"

    idle_in_tx = by_state.get("idle in transaction", 0)
    if idle_in_tx > 5:
        level = "HIGH" if level != "HIGH" else level

    return {"domain": "Conexões e pool", "level": level,
            "max_connections": r["max_conn"], "used": r["used"],
            "pct_used": pct, "by_state": by_state,
            "idle_in_transaction": idle_in_tx}


def check_rls(cur) -> dict:
    cur.execute("""
        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY c.relname
    """)
    rows = cur.fetchall()
    no_rls = [r["table_name"] for r in rows if not r["rls_enabled"]]
    all_tables = [r["table_name"] for r in rows]

    SENSITIVE = {"jobs", "dxf_tasks", "bt_export_history", "audit_logs",
                 "constants_catalog", "user_roles", "tenants",
                 "canonical_edges", "canonical_poles", "dg_candidates"}
    critical_no_rls = [t for t in no_rls if t in SENSITIVE]

    level = "OK"
    if critical_no_rls:
        level = "HIGH"
    elif no_rls:
        level = "MEDIUM"

    return {"domain": "RLS – tabelas sem Row Level Security", "level": level,
            "total_tables": len(all_tables),
            "no_rls_count": len(no_rls),
            "no_rls_tables": no_rls,
            "critical_no_rls": critical_no_rls}


def check_grants(cur) -> dict:
    cur.execute("""
        SELECT table_name, grantee, privilege_type
        FROM information_schema.table_privileges
        WHERE table_schema = 'public'
          AND grantee IN ('anon', 'authenticated')
          AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
        ORDER BY table_name, grantee, privilege_type
    """)
    violations = [dict(r) for r in cur.fetchall()]
    level = "HIGH" if violations else "OK"
    return {"domain": "Grants excessivos (anon/authenticated DML)", "level": level,
            "violations": violations}


def check_migration_drift(cur) -> dict:
    cur.execute("SELECT to_regclass('public._migrations') AS tbl")
    if cur.fetchone()["tbl"] is None:
        return {"domain": "Drift de migrations", "level": "HIGH",
                "note": "Tabela public._migrations não existe."}

    cur.execute("SELECT filename FROM public._migrations ORDER BY filename")
    applied = {r["filename"] for r in cur.fetchall()}
    local = {p.name for p in MIGRATIONS_DIR.glob("*.sql")}

    pending = sorted(local - applied)
    orphan = sorted(applied - local)

    level = "OK"
    if pending:
        level = "HIGH"
    elif orphan:
        level = "MEDIUM"

    return {"domain": "Drift de migrations", "level": level,
            "local_count": len(local), "applied_count": len(applied),
            "pending": pending, "orphan_applied": orphan}


# ─── main ─────────────────────────────────────────────────────────────────────

CHECKS = [
    check_locks,
    check_slow_queries,
    check_index_health,
    check_bloat,
    check_connections,
    check_rls,
    check_grants,
    check_migration_drift,
]


def render_markdown(results: list[dict], ts: str) -> str:
    lines = [
        f"# Auditoria Live do Banco – {ts}",
        "",
        "## Sumário executivo",
        "",
        "| Domínio | Risco |",
        "|---------|-------|",
    ]
    for r in results:
        lines.append(f"| {r['domain']} | {risk(r['level'])} |")

    lines += ["", "---", ""]

    for r in results:
        lines.append(f"## {r['domain']}")
        lines.append(f"**Risco:** {risk(r['level'])}")
        lines.append("")

        domain = r["domain"]

        if "Locks" in domain:
            lines.append(f"- Queries bloqueadas (sem grant): **{r.get('blocked_count', 0)}**")
            longs = r.get("long_running", [])
            if longs:
                lines.append(f"- Queries ativas > 5 s: **{len(longs)}**")
                lines.append("")
                lines.append("| PID | Duração (s) | Estado | Wait | Trecho |")
                lines.append("|-----|-------------|--------|------|--------|")
                for f in longs[:10]:
                    lines.append(f"| {f['pid']} | {f['duration_s']} | {f['state']} | {f['wait_event']} | `{f['query'][:60]}` |")

        elif "pg_stat_statements" in domain:
            note = r.get("note")
            if note:
                lines.append(f"> ⚠️ {note}")
            else:
                tq = r.get("top_queries", [])
                if tq:
                    lines.append("| Total ms | Chamadas | Média ms | Trecho |")
                    lines.append("|----------|----------|----------|--------|")
                    for q in tq[:10]:
                        lines.append(f"| {q['total_ms']} | {q['calls']} | {q['mean_ms']} | `{str(q['query_snippet'])[:70]}` |")

        elif "índices" in domain.lower():
            unused = r.get("unused_indexes", [])
            seq = r.get("seq_scan_heavy_tables", [])
            if unused:
                lines.append(f"**Índices nunca utilizados ({len(unused)}):**")
                lines.append("")
                lines.append("| Tabela | Índice | Tamanho |")
                lines.append("|--------|--------|---------|")
                for i in unused[:10]:
                    lines.append(f"| {i['table_name']} | {i['index_name']} | {i['size']} |")
                lines.append("")
            if seq:
                lines.append(f"**Tabelas com excesso de seq-scan ({len(seq)}):**")
                lines.append("")
                lines.append("| Tabela | Seq Scan | Idx Scan | Linhas | Tamanho |")
                lines.append("|--------|----------|----------|--------|---------|")
                for t in seq[:10]:
                    lines.append(f"| {t['table_name']} | {t['seq_scan']} | {t['idx_scan']} | {t['n_live_tup']} | {t['total_size']} |")

        elif "Bloat" in domain:
            tables = r.get("tables", [])
            if tables:
                lines.append("| Tabela | Dead % | Dead Tuples | Último Autovacuum |")
                lines.append("|--------|--------|-------------|-------------------|")
                for t in tables[:10]:
                    lines.append(f"| {t['tablename']} | {t['dead_pct']}% | {t['n_dead_tup']} | {t['last_autovacuum']} |")

        elif "Conexões" in domain:
            lines.append(f"- Conexões usadas: **{r['used']} / {r['max_connections']}** ({r['pct_used']}%)")
            lines.append(f"- Idle in transaction: **{r['idle_in_transaction']}**")
            lines.append("")
            lines.append("| Estado | Contagem |")
            lines.append("|--------|----------|")
            for state, cnt in (r.get("by_state") or {}).items():
                lines.append(f"| {state} | {cnt} |")

        elif "RLS" in domain:
            lines.append(f"- Total de tabelas: **{r.get('total_tables', 0)}**")
            lines.append(f"- Sem RLS: **{r.get('no_rls_count', 0)}**")
            critical = r.get("critical_no_rls", [])
            if critical:
                lines.append(f"- **Críticas sem RLS:** {', '.join(critical)}")
            no_rls = r.get("no_rls_tables", [])
            if no_rls:
                lines.append("")
                lines.append("| Tabela |")
                lines.append("|--------|")
                for t in no_rls[:20]:
                    lines.append(f"| {t} |")

        elif "Grants" in domain:
            violations = r.get("violations", [])
            if violations:
                lines.append("| Tabela | Grantee | Privilégio |")
                lines.append("|--------|---------|------------|")
                for v in violations[:20]:
                    lines.append(f"| {v['table_name']} | {v['grantee']} | {v['privilege_type']} |")
            else:
                lines.append("> Nenhuma violação encontrada.")

        elif "Drift" in domain:
            note = r.get("note")
            if note:
                lines.append(f"> ⚠️ {note}")
            else:
                lines.append(f"- Local: **{r.get('local_count')}** | Aplicadas: **{r.get('applied_count')}**")
                pending = r.get("pending", [])
                orphan = r.get("orphan_applied", [])
                if pending:
                    lines.append(f"- **Pendentes:** {', '.join(pending)}")
                if orphan:
                    lines.append(f"- Registradas sem arquivo local: {', '.join(orphan)}")
                if not pending and not orphan:
                    lines.append("> Sem drift detectado.")

        lines.append("")

    return "\n".join(lines)


def main() -> int:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL não encontrado")
        return 1

    print("=== Auditoria Live do Banco ===")
    try:
        conn = psycopg2.connect(database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    except Exception as exc:
        print(f"❌ Falha na conexão: {exc}")
        return 1

    results = []
    conn.autocommit = False
    cur = conn.cursor()
    for check_fn in CHECKS:
        cur.execute("SAVEPOINT sp_check")
        try:
            result = check_fn(cur)
            cur.execute("RELEASE SAVEPOINT sp_check")
            results.append(result)
            icon = "✅" if result["level"] == "OK" else ("🔴" if result["level"] == "HIGH" else "🟡")
            print(f"  {icon} {result['domain']} → {result['level']}")
        except Exception as exc:
            cur.execute("ROLLBACK TO SAVEPOINT sp_check")
            cur.execute("RELEASE SAVEPOINT sp_check")
            results.append({"domain": check_fn.__name__, "level": "LOW",
                             "error": str(exc)})
            print(f"  ⚠️  {check_fn.__name__}: {exc}")
    conn.close()

    ts = NOW
    md_path = ARTIFACTS_DIR / f"audit-live-{ts}.md"
    json_path = ARTIFACTS_DIR / f"audit-live-{ts}.json"

    md_path.write_text(render_markdown(results, ts), encoding="utf-8")
    json_path.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")

    highs = [r for r in results if r["level"] == "HIGH"]
    meds  = [r for r in results if r["level"] == "MEDIUM"]

    print()
    print(f"Relatório salvo em: artifacts/audit-live-{ts}.md")
    print(f"  🔴 ALTO:  {len(highs)}")
    print(f"  🟡 MÉDIO: {len(meds)}")
    print(f"  ✅ OK/BAIXO: {len(results) - len(highs) - len(meds)}")

    return 1 if highs else 0


if __name__ == "__main__":
    sys.exit(main())
