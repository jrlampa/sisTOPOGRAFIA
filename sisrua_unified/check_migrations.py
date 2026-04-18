#!/usr/bin/env python3
"""Verificar quais migrations foram aplicadas.

Descobre automaticamente todos os arquivos *.sql em migrations/ e compara
com os registros em public._migrations. Reporta missing e pendentes.
"""

import os
import re
import sys
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

env_path = Path('.env')
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()


def _sanitize_database_url(raw_database_url: str | None) -> str | None:
    if not raw_database_url:
        return raw_database_url
    # Corrige '%' cru (não seguido de 2 hex) para evitar erro de parse em URLs.
    return re.sub(r'%(?![0-9A-Fa-f]{2})', '%25', raw_database_url)


database_url = _sanitize_database_url(os.getenv('DATABASE_URL'))
if not database_url:
    raise RuntimeError(
        'DATABASE_URL não definido. Configure no ambiente ou em .env'
    )

# ── Descobrir arquivos de migration no disco ──────────────────────────────────
migration_dir = Path('migrations')
all_files = sorted(f.name for f in migration_dir.glob('*.sql'))

# Detectar prefixos duplicados (ex: dois arquivos 002_*)
prefixes: dict[str, list[str]] = {}
for fname in all_files:
    prefix = fname.split('_')[0]
    prefixes.setdefault(prefix, []).append(fname)
duplicate_prefixes = {p: files for p, files in prefixes.items() if len(files) > 1}

conn = psycopg2.connect(database_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

# ── Migrations aplicadas no banco ─────────────────────────────────────────────
print("=" * 80)
print("MIGRATIONS JÁ APLICADAS (banco)")
print("=" * 80)
cur.execute(
    "SELECT filename, applied_at FROM public._migrations ORDER BY filename"
)
migrations = cur.fetchall()
applied = {m['filename'] for m in migrations}
for m in migrations:
    print(f"  {m['filename']:<55} {m['applied_at']}")

# ── Status completo: todos os arquivos vs banco ───────────────────────────────
print(f"\n{'=' * 80}")
print(f"STATUS COMPLETO: {len(all_files)} arquivo(s) em migrations/")
print("=" * 80)

pending = [f for f in all_files if f not in applied]
applied_local = [f for f in all_files if f in applied]
extra_in_db = applied - set(all_files)

print(f"\n  ✅ Aplicadas:    {len(applied_local)}/{len(all_files)}")
if pending:
    print(f"  ⏳ Pendentes:    {len(pending)}")
    for f in pending:
        print(f"       • {f}")
else:
    print(f"  ✅ Nenhuma migration pendente — banco está atualizado!")

if extra_in_db:
    print(f"\n  ⚠️  Registradas no banco mas sem arquivo local ({len(extra_in_db)}):")
    for f in sorted(extra_in_db):
        print(f"       • {f}")

# ── Detectar prefixos duplicados ─────────────────────────────────────────────
if duplicate_prefixes:
    print(f"\n{'=' * 80}")
    print("⚠️  PREFIXOS DUPLICADOS DETECTADOS")
    print("=" * 80)
    for prefix, files in sorted(duplicate_prefixes.items()):
        print(f"  Prefixo '{prefix}_': {', '.join(files)}")
    print("  → Use números sequenciais únicos (ex: 002a / 002b) para evitar ambiguidade de ordem.")

# ── Resumo final ─────────────────────────────────────────────────────────────
print(f"\n{'=' * 80}")
if pending or extra_in_db or duplicate_prefixes:
    print("RESULTADO: ⚠️  Atenção requerida (ver itens acima)")
    cur.close()
    conn.close()
    sys.exit(1)
else:
    print("RESULTADO: ✅ Banco de dados alinhado com todas as migrations locais")
    cur.close()
    conn.close()
    sys.exit(0)
