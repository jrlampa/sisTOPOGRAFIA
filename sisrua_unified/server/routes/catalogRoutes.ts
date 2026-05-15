import { Router, Request, Response } from 'express';
import { getDbClient } from '../repositories/dbClient.js';

const router = Router();

router.get('/conductors', async (req: Request, res: Response) => {
  const sql = getDbClient();
  if (!sql) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const category = typeof req.query.category === 'string' ? req.query.category : null;
  const material = typeof req.query.material === 'string' ? req.query.material : null;
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 200;

  const where: string[] = ['is_active = true'];
  const params: unknown[] = [];

  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (material) {
    params.push(material);
    where.push(`material = $${params.length}`);
  }

  params.push(limit);
  const query = `
    SELECT
      id,
      conductor_id,
      display_name,
      material,
      category,
      stranding_type,
      section_mm2,
      diameter_mm,
      resistance_ohm_per_km,
      reactance_mohm_per_km,
      weight_kg_per_km,
      tensile_strength_dan,
      max_temperature_celsius,
      aliases,
      is_active,
      created_at,
      updated_at
    FROM public.conductor_catalog
    WHERE ${where.join(' AND ')}
    ORDER BY category ASC, section_mm2 ASC NULLS LAST, conductor_id ASC
    LIMIT $${params.length}
  `;

  const rows = await sql.unsafe(query, params);
  return res.json({
    items: rows,
    total: rows.length,
    source: 'supabase',
  });
});

router.get('/conductors/lookup', async (req: Request, res: Response) => {
  const sql = getDbClient();
  if (!sql) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: "Query parameter 'name' is required" });
  }

  const rows = await sql.unsafe(
    `WITH lookup AS (
      SELECT id, conductor_id
      FROM public.find_conductor_by_name($1)
      LIMIT 1
    )
    SELECT
      c.id,
      c.conductor_id,
      c.display_name,
      c.material,
      c.category,
      c.stranding_type,
      c.section_mm2,
      c.diameter_mm,
      c.number_of_strands,
      c.resistance_ohm_per_km,
      c.reactance_mohm_per_km,
      c.conductivity_siemens,
      c.weight_kg_per_km,
      c.tensile_strength_dan,
      c.breaking_load_dan,
      c.elastic_modulus_pa,
      c.max_temperature_celsius,
      c.coefficient_temp_res_per_c,
      c.standard,
      c.norm_document,
      c.aliases,
      c.is_active,
      c.created_at,
      c.updated_at
    FROM lookup l
    JOIN public.conductor_catalog c
      ON c.id = l.id
    LIMIT 1`,
    [name]
  );

  return res.json({
    item: rows[0] ?? null,
    source: 'supabase',
  });
});

router.get('/poles', async (_req: Request, res: Response) => {
  const sql = getDbClient();
  if (!sql) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const rows = await sql.unsafe(
    `SELECT
      id,
      pole_id,
      display_name,
      material,
      pole_type,
      height_m,
      nominal_effort_dan,
      aliases,
      is_active,
      created_at,
      updated_at
    FROM public.pole_catalog
    WHERE is_active = true
    ORDER BY height_m ASC, nominal_effort_dan ASC`
  );

  return res.json({
    items: rows,
    total: rows.length,
    source: 'supabase',
  });
});

router.get('/poles/lookup', async (req: Request, res: Response) => {
  const sql = getDbClient();
  if (!sql) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: "Query parameter 'name' is required" });
  }

  const rows = await sql.unsafe(
    `WITH lookup AS (
      SELECT id
      FROM public.find_pole_by_name($1)
      LIMIT 1
    )
    SELECT
      p.id,
      p.pole_id,
      p.display_name,
      p.material,
      p.pole_type,
      p.height_m,
      p.nominal_effort_dan,
      p.aliases,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM lookup l
    JOIN public.pole_catalog p
      ON p.id = l.id
    LIMIT 1`,
    [name]
  );

  return res.json({
    item: rows[0] ?? null,
    source: 'supabase',
  });
});

export default router;
