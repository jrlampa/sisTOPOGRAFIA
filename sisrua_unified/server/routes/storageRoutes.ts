import { Router, Request, Response } from 'express';
import { config } from '../config.js';

const router = Router();

const isStorageHealthAuthorized = (req: Request): boolean => {
  if (config.NODE_ENV !== 'production') {
    return true;
  }

  const expected = config.CONSTANTS_REFRESH_TOKEN?.trim();
  if (!expected) {
    return false;
  }

  return req.get('x-constants-refresh-token') === expected;
};

router.get('/health', (_req: Request, res: Response) => {
  if (!isStorageHealthAuthorized(_req)) {
    return res.status(401).json({ error: 'Unauthorized storage health request' });
  }

  return res.json({
    status: 'online',
    jobsPersistence: config.useSupabaseJobs ? 'supabase-postgres' : 'memory',
    firestore: config.useFirestore ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString()
  });
});

export default router;
