import { getJobDossier } from "./server/services/jobDossierService.js";

async function run() {
  const taskId = "a4f0c2ca-7ab4-49ac-9447-5ba30d46b594";
  console.log(`--- VERIFICANDO STATUS: ${taskId} ---`);
  try {
    const dossier = await getJobDossier(taskId);
    console.log(`Status: ${dossier.status}`);
    if (dossier.status === "failed") {
       console.log(`Erro: ${dossier.error}`);
    } else {
       console.log("Sucesso!");
    }
    process.exit(0);
  } catch (err) {
    console.error("Erro:", err);
    process.exit(1);
  }
}

run();
