import { Router, Request, Response } from 'express';
import { config } from '../config.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'online',
    jobsPersistence: config.useSupabaseJobs ? 'supabase-postgres' : 'memory',
    firestore: config.useFirestore ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString()
  });
});

export default router;
