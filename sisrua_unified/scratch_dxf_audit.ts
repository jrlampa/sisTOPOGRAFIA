import { previewFailedTaskSanitation } from "./server/services/jobDossierService.js";

async function run() {
  console.log("--- INICIANDO AUDITORIA DE FALHAS DXF ---");
  try {
    const preview = await previewFailedTaskSanitation(200);
    console.log("Resumo da Auditoria:");
    console.log(`Analisados: ${preview.analyzed}`);
    console.log("Por Classificação:", JSON.stringify(preview.byClassification, null, 2));
    console.log("Por Origem (Source):", JSON.stringify(preview.bySource, null, 2));
    
    if (preview.entries.length > 0) {
      console.log("\nDetalhes das Falhas (Top 10):");
      preview.entries.slice(0, 10).forEach(e => {
        console.log(`- Task: ${e.taskId} | Class: ${e.classification} | Error: ${e.error?.substring(0, 100)}...`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Erro na auditoria:", err);
    process.exit(1);
  }
}

run();
