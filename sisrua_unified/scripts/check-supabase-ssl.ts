import postgres from 'postgres';

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('DATABASE_URL nao definido. Configure a variavel no .env e tente novamente.');
  }
  return value;
}

function forceSslModeRequire(databaseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL invalido. Use formato postgresql://usuario:senha@host:porta/database');
  }

  const sslmode = parsed.searchParams.get('sslmode');
  if (!sslmode || sslmode.toLowerCase() !== 'require') {
    parsed.searchParams.set('sslmode', 'require');
  }

  return parsed.toString();
}

function maskUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '<url-invalida>';
  }
}

async function main(): Promise<void> {
  const databaseUrl = forceSslModeRequire(requireDatabaseUrl());
  const sql = postgres(databaseUrl, {
    ssl: 'require',
    connect_timeout: 10,
    max: 1,
    idle_timeout: 5
  });

  try {
    const checkRows = await sql.unsafe("select current_database() as db, current_user as usr, now() as ts");
    const sslRows = await sql.unsafe('show ssl');

    const check = checkRows[0] as { db: string; usr: string; ts: string };
    const sslValue = String((sslRows[0] as { ssl: string }).ssl || '').toLowerCase();

    if (sslValue !== 'on') {
      throw new Error(`Conexao sem SSL efetivo (show ssl=${sslValue || 'desconhecido'})`);
    }

    const payload = {
      status: 'ok',
      ssl: sslValue,
      db: check.db,
      user: check.usr,
      timestamp: check.ts,
      target: maskUrl(databaseUrl)
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`supabase_ssl_check_failed: ${message}`);
  process.exit(1);
});
