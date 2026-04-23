import { createDxfTask } from "./server/services/cloudTasksService.js";
// Import order matters to ensure config is loaded
import { logger } from "./server/utils/logger.js";

async function run() {
  console.log("--- INICIANDO WORKER DXF (MANUAL) ---");
  try {
    // We don't need to create a task, just calling createDxfTask once (even with invalid input)
    // will initialize the queue and start the worker if it hasn't started.
    // However, the worker is started inside initializeQueuePersistence which is private.
    // Let's use a dummy task to trigger it.
    
    // Actually, I'll just wait. The worker cycle runs every 2s once started.
    // But how to start it? I'll call getTaskStatus or something that initializes it.
    
    // I'll call createDxfTask with dummy data and catch the error.
    try {
      await createDxfTask({ lat: 0, lon: 0, radius: 0 } as any);
    } catch (e) {
      // expected error
    }
    
    console.log("Worker deve estar rodando agora. Aguardando 15s para processamento...");
    await new Promise(resolve => setTimeout(resolve, 15000));
    console.log("Fim do período de espera.");
    process.exit(0);
  } catch (err) {
    console.error("Erro no worker:", err);
    process.exit(1);
  }
}

run();
