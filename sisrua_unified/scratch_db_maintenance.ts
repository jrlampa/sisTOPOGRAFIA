import { DbMaintenanceService } from "./server/services/dbMaintenanceService.js";
import { logger } from "./server/utils/logger.js";

async function run() {
  console.log("--- INICIANDO MANUTENÇÃO DE BANCO DE DADOS ---");
  try {
    const tables = ["audit_logs", "bt_export_history", "user_roles"];
    const result = await DbMaintenanceService.runVacuumAnalyze(tables);
    console.log("Resultado da Manutenção:", JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error("Erro fatal durante manutenção:", err);
    process.exit(1);
  }
}

run();
