import postgres from "postgres";
import fs from "fs";
import { config } from "./server/config.js";

async function run() {
  console.log("--- EXECUTANDO MIGRAÇÃO 055 ---");
  if (!config.DATABASE_URL) {
    console.error("DATABASE_URL não configurado");
    process.exit(1);
  }

  const sql = postgres(config.DATABASE_URL);
  try {
    const migration = fs.readFileSync("./migrations/055_add_cancelled_status_to_tasks.sql", "utf-8");
    await sql.unsafe(migration);
    console.log("Migração 055 aplicada com sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("Erro na migração:", err);
    process.exit(1);
  }
}

run();
