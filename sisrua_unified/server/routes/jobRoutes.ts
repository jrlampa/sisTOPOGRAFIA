import { Router, Request, Response } from "express";
import { getJobWithPersistence } from "../services/jobStatusService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";

import { requirePermission } from "../middleware/permissionHandler.js";

const router = Router();
const jobIdParamSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

// Job Status Endpoint
router.get(
  "/:id",
  requirePermission("read"),
  async (req: Request, res: Response) => {
    try {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");

      const validation = jobIdParamSchema.safeParse(req.params);
      if (!validation.success) {
        return res
          .status(400)
          .json({ error: "Invalid job id", details: validation.error.issues });
      }

      const userTenantId = res.locals.tenantId;
      const job = await getJobWithPersistence(validation.data.id, userTenantId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Security: IDOR protection — check if job belongs to the user's tenant
      if (job.tenantId !== userTenantId && res.locals.userRole !== "admin") {
        logger.warn(
          "Tentativa de IDOR detectada: acesso cross-tenant bloqueado",
          {
            userId: res.locals.userId,
            jobId: job.id,
            jobTenant: job.tenantId,
            userTenant: userTenantId,
          },
        );
        return res.status(404).json({ error: "Job not found" }); // Return 404 to avoid leaking job existence
      }

      return res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
      });
    } catch (err: any) {
      logger.error("Job status lookup failed", { error: err });
      return res.status(500).json({ error: "Failed to retrieve job status" });
    }
  },
);

export default router;
