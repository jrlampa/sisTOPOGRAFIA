import { Router, Request, Response } from "express";
import { getJob } from "../services/jobStatusService.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";

const router = Router();
const jobIdParamSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

// Job Status Endpoint
router.get("/:id", async (req: Request, res: Response) => {
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

    const job = getJob(validation.data.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
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
});

export default router;
