import { sanitizeAndReprocessFailedTasks } from "./server/services/jobDossierService.js";

async function run() {
  console.log("--- INICIANDO SANEAMENTO DE TAREFAS DXF ---");
  try {
    const result = await sanitizeAndReprocessFailedTasks();
    console.log("Resultado do Saneamento:");
    console.log(`Descartadas (Missing Input): ${result.discarded}`);
    console.log(`Re-enfileiradas (Runtime/Other): ${result.requeued}`);
    process.exit(0);
  } catch (err) {
    console.error("Erro no saneamento:", err);
    process.exit(1);
  }
}

run();
