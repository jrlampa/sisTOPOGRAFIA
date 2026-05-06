import { Router, Request, Response } from "express";
import { DbMaintenanceService } from "../services/dbMaintenanceService.js";
import { requireAdminToken } from "../middleware/authGuard.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * @swagger
 * /api/maintenance/sanitize-dxf:
 *   post:
 *     summary: Executa saneamento operacional nas tarefas de DXF com falha
 *     tags: [Maintenance]
 *     security:
 *       - adminToken: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 200
 *     responses:
 *       200:
 *         description: Saneamento concluído com sucesso
 */
router.post("/sanitize-dxf", requireAdminToken, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 200;
    const result = await DbMaintenanceService.sanitizeFailedDxfTasks(limit);
    
    res.json({
      success: true,
      message: "DXF task sanitation completed",
      data: result
    });
  } catch (error: any) {
    logger.error("Error in sanitize-dxf route", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/maintenance/vacuum-analyze:
 *   post:
 *     summary: Executa VACUUM ANALYZE em tabelas críticas
 *     tags: [Maintenance]
 *     security:
 *       - adminToken: []
 */
router.post("/vacuum-analyze", requireAdminToken, async (req: Request, res: Response) => {
  try {
    const result = await DbMaintenanceService.runVacuumAnalyze();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
