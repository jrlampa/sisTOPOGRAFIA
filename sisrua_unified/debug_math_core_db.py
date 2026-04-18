#!/usr/bin/env python3
import os
from pathlib import Path
from urllib.parse import urlparse, unquote
import psycopg2
from psycopg2.extras import RealDictCursor


def load_env() -> None:
    env_file = Path(".env")
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()


def connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL nao definido")

    parsed = urlparse(database_url)
    password = unquote(parsed.password) if parsed.password else None
    return psycopg2.connect(
        database=parsed.path[1:],
        user=parsed.username,
        password=password,
        host=parsed.hostname,
        port=parsed.port or 5432,
        sslmode="require",
    )


def table_columns(cur, table: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    return [r["column_name"] for r in cur.fetchall()]


def main() -> None:
    load_env()
    conn = connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("=== MATH CORE DB CHECK ===")

    # 1) Inspect bt_export_history schema for math-related fields.
    cols = table_columns(cur, "bt_export_history")
    print("bt_export_history columns:")
    print(", ".join(cols))

    # 2) Try to detect rows with suspiciously zeroed metrics if columns exist.
    checks = [
        "total_length_km",
        "transformer_count",
        "max_demand_kva",
        "avg_voltage_drop_pct",
        "elevation_source",
        "elevation_min_m",
        "elevation_max_m",
    ]
    available = [c for c in checks if c in cols]
    if available:
        print("\navailable_math_fields=" + ", ".join(available))
        sel = ", ".join(available)
        cur.execute(f"SELECT {sel}, created_at FROM public.bt_export_history ORDER BY created_at DESC LIMIT 5")
        rows = cur.fetchall()
        if rows:
            print("recent bt_export_history rows:")
            for r in rows:
                print(dict(r))
        else:
            print("no bt_export_history rows")
    else:
        print("\nNo expected math fields found in bt_export_history")

    # 3) Validate constants catalog values related to CQT/BT if present.
    cur.execute(
        """
        SELECT namespace, key, value, environment, is_active
        FROM public.constants_catalog
        WHERE namespace ILIKE '%bt%'
           OR namespace ILIKE '%cqt%'
           OR key ILIKE '%fator%'
           OR key ILIKE '%demanda%'
           OR key ILIKE '%potencia%'
        ORDER BY namespace, key
        LIMIT 50
        """
    )
    rows = cur.fetchall()
    print("\nconstants candidates (bt/cqt):", len(rows))
    for r in rows:
        print(f"{r['namespace']}.{r['key']} env={r['environment']} active={r['is_active']} value={r['value']}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
