import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { unsafeMock, getDbClientMock } = vi.hoisted(() => ({
  unsafeMock: vi.fn(),
  getDbClientMock: vi.fn(),
}));

vi.mock('../repositories/dbClient.js', () => ({
  getDbClient: getDbClientMock,
}));

import catalogRoutes from '../routes/catalogRoutes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/catalog', catalogRoutes);
  return app;
}

describe('Catalog Routes Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbClientMock.mockReturnValue({ unsafe: unsafeMock });
  });

  it('GET /api/catalog/conductors deve retornar 503 sem conexão DB', async () => {
    getDbClientMock.mockReturnValue(null);

    const app = createApp();
    const res = await request(app).get('/api/catalog/conductors');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/Database unavailable/i);
  });

  it('GET /api/catalog/conductors deve retornar itens ativos com source supabase', async () => {
    unsafeMock.mockResolvedValue([
      {
        id: 2,
        conductor_id: '70 Al - MX',
        display_name: '70 mm² Alumínio Meia Dura',
        material: 'Al',
        category: 'BT',
        section_mm2: '70.00',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/catalog/conductors?category=BT&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('supabase');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].conductor_id).toBe('70 Al - MX');
    expect(unsafeMock).toHaveBeenCalledTimes(1);
    const [query, params] = unsafeMock.mock.calls[0];
    expect(String(query)).toContain('FROM public.conductor_catalog');
    expect(params).toEqual(['BT', 5]);
  });

  it('GET /api/catalog/conductors/lookup deve retornar 400 sem name', async () => {
    const app = createApp();
    const res = await request(app).get('/api/catalog/conductors/lookup');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('GET /api/catalog/conductors/lookup deve retornar item encontrado', async () => {
    unsafeMock.mockResolvedValue([
      {
        id: 2,
        conductor_id: '70 Al - MX',
        display_name: '70 mm² Alumínio Meia Dura',
        category: 'BT',
        number_of_strands: '7',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/catalog/conductors/lookup?name=70%20Al%20-%20MX');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('supabase');
    expect(res.body.item.conductor_id).toBe('70 Al - MX');
    expect(res.body.item.category).toBe('BT');
    expect(res.body.item.number_of_strands).toBe('7');
    const [query, params] = unsafeMock.mock.calls[0];
    expect(String(query)).toContain('FROM public.find_conductor_by_name($1)');
    expect(String(query)).toContain('JOIN public.conductor_catalog c');
    expect(params).toEqual(['70 Al - MX']);
  });

  it('GET /api/catalog/poles deve retornar lista de postes ativos', async () => {
    unsafeMock.mockResolvedValue([
      {
        id: 1,
        pole_id: '8.5m-150daN-CC',
        display_name: '8,5 m / 150 daN - Concreto Circular',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/catalog/poles');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('supabase');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].pole_id).toBe('8.5m-150daN-CC');
  });

  it('GET /api/catalog/poles/lookup deve retornar item encontrado', async () => {
    unsafeMock.mockResolvedValue([
      {
        id: 1,
        pole_id: '8.5m-150daN-CC',
        display_name: '8,5 m / 150 daN - Concreto Circular',
        pole_type: 'circular',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/catalog/poles/lookup?name=8.5m-150daN-CC');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('supabase');
    expect(res.body.item.pole_id).toBe('8.5m-150daN-CC');
    expect(res.body.item.pole_type).toBe('circular');
    const [query, params] = unsafeMock.mock.calls[0];
    expect(String(query)).toContain('FROM public.find_pole_by_name($1)');
    expect(String(query)).toContain('JOIN public.pole_catalog p');
    expect(params).toEqual(['8.5m-150daN-CC']);
  });
});
