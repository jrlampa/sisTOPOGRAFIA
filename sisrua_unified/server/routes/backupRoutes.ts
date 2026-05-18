import { Router, Request, Response } from 'express';
import { BackupService } from '../services/backupService.js';
import { requirePermission } from '../middleware/permissionHandler.js';
import { createError, asyncHandler } from '../errorHandler.js';
import { getDbClient } from '../repositories/dbClient.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const LegalHoldSchema = z.object({
  tableName: z.string(),
  recordId: z.string(),
  reason: z.string(),
  expiresAt: z.string().datetime().optional(),
});

// ─── Endpoints de Integridade & Drills ────────────────────────────────────────

/**
 * Dispara manualmente uma verificação de integridade de backup.
 * Padrão: Admin only.
 */
router.post('/verify-integrity', requirePermission('admin'), asyncHandler(async (req: Request, res: Response) => {
  const isHealthy = await BackupService.verifyIntegrity();
  return res.json({ 
    status: isHealthy ? 'healthy' : 'warning',
    checkedAt: new Date().toISOString()
  });
}));

/**
 * Executa um Restore Drill (P0).
 */
router.post('/drill', requirePermission('admin'), asyncHandler(async (req: Request, res: Response) => {
  const tableName = req.body.tableName;
  const result = await BackupService.runRestoreDrill(tableName);
  return res.json(result);
}));

/**
 * Lista histórico de drills.
 */
router.get('/drill/history', requirePermission('admin'), asyncHandler(async (req: Request, res: Response) => {
  const db = getDbClient(true);
  if (!db) throw createError.externalService('Banco de dados');
  
  const history = await db.unsafe(`SELECT * FROM backup.drill_history ORDER BY drill_at DESC LIMIT 50`);
  return res.json(history);
}));

// ─── Endpoints de Legal Hold (P0) ─────────────────────────────────────────────

/**
 * Cria um novo Legal Hold para um registro específico.
 */
router.post('/legal-hold', requirePermission('admin'), asyncHandler(async (req: Request, res: Response) => {
  const body = LegalHoldSchema.parse(req.body);
  const db = getDbClient(true);
  if (!db) throw createError.externalService('Banco de dados');

  const [hold] = await db.unsafe(`
    INSERT INTO backup.legal_holds (table_name, record_id, reason, expires_at, held_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [body.tableName, body.recordId, body.reason, body.expiresAt || null, (req as any).user?.id || 'admin']);

  logger.info('Legal Hold criado', { hold });
  return res.status(201).json(hold);
}));

/**
 * Remove/Desativa um Legal Hold.
 */
router.delete('/legal-hold/:id', requirePermission('admin'), asyncHandler(async (req: Request, res: Response) => {
  const db = getDbClient(true);
  if (!db) throw createError.externalService('Banco de dados');

  const [hold] = await db.unsafe(`
    UPDATE backup.legal_holds
    SET is_active = false, metadata = jsonb_set(COALESCE(metadata, '{}'), '{deactivated_at}', to_jsonb(now()::text))
    WHERE id = $1
    RETURNING *
  `, [req.params.id]);

  if (!hold) throw createError.notFound('Legal Hold');

  return res.json({ message: 'Legal Hold desativado com sucesso', hold });
}));

// ─── Endpoints de eDiscovery (P0) ─────────────────────────────────────────────

/**
 * Busca granular em backups (eDiscovery).
 */
router.get('/discovery/search', requirePermission('admin'), asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) throw createError.validation('Query string "q" é obrigatória');

  const db = getDbClient(true);
  if (!db) throw createError.externalService('Banco de dados');

  // Busca textual no JSONB content
  const results = await db.unsafe(`
    SELECT * 
    FROM backup.v_ediscovery_search
    WHERE content::text ILIKE $1
    ORDER BY captured_at DESC
    LIMIT 100
  `, [`%${query}%`]);

  return res.json(results);
}));

export default router;
