import { crypto } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { logger } from "../server/utils/logger.js";

/**
 * rotate-secrets.js — Automação de Rotação de Chaves (Roadmap Item 115).
 * 
 * Gera novas chaves aleatórias para ADMIN_TOKEN e METRICS_TOKEN
 * e atualiza o arquivo .env (preservando outros valores).
 */

const ENV_PATH = "sisrua_unified/.env";

function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

async function rotate() {
  console.log("🔐 Iniciando rotação automática de segredos...");

  if (!existsSync(ENV_PATH)) {
    console.error(`❌ Arquivo ${ENV_PATH} não encontrado.`);
    process.exit(1);
  }

  let envContent = readFileSync(ENV_PATH, "utf8");

  const newAdminToken = generateSecureToken();
  const newMetricsToken = generateSecureToken();

  // Regex para substituir preservando a chave
  envContent = envContent.replace(/^ADMIN_TOKEN=.*$/m, `ADMIN_TOKEN=${newAdminToken}`);
  envContent = envContent.replace(/^METRICS_TOKEN=.*$/m, `METRICS_TOKEN=${newMetricsToken}`);

  writeFileSync(ENV_PATH, envContent);

  console.log("✅ ADMIN_TOKEN rotacionado.");
  console.log("✅ METRICS_TOKEN rotacionado.");
  console.log("\n⚠️  IMPORTANTE: Reinicie os serviços para aplicar as novas chaves.");
  
  logger.info({
    message: "Tokens de segurança rotacionados via script automático",
    isSecurity: true
  });
}

rotate().catch(console.error);
