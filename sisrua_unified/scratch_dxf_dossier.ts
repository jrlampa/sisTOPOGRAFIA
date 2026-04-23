import { getJobDossier } from "./server/services/jobDossierService.js";

async function run() {
  const taskId = "a4f0c2ca-7ab4-49ac-9447-5ba30d46b594";
  console.log(`--- ANALISANDO TAREFA: ${taskId} ---`);
  try {
    const dossier = await getJobDossier(taskId);
    console.log(JSON.stringify(dossier, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  }
}

run();
