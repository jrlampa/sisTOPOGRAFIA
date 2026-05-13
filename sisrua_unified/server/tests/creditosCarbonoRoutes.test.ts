/**
 * creditosCarbonoRoutes.test.ts — Testes para Calculadora de Créditos de Carbono (T2-47).
 */

import request from 'supertest';
import app from '../app.js';
import { CreditosCarbonoService } from '../services/creditosCarbonoService.js';

beforeEach(() => {
  CreditosCarbonoService._reset();
});

const BASE = '/api/creditos-carbono';
const WRITER_HEADER = { 'x-user-id': 'carbon-writer' };

const CALCULO_BASE = {
  nome: 'Projeto Eficiência Norte',
  tenantId: 'tenant-cc-1',
};

const ACAO_BASE = {
  tipo: 'trocar_luminaria_convencional_led',
  quantidade: 100,
};

describe('GET /tipos-acao', () => {
  it('retorna lista de tipos de ação de redução', async () => {
    const res = await request(app).get(`${BASE}/tipos-acao`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('tipo');
    expect(res.body[0]).toHaveProperty('fatorTonCo2eqPorUnidade');
  });
});

describe('POST /calculos', () => {
  it('rejeita escrita sem identidade autenticada', async () => {
    const res = await request(app).post(`${BASE}/calculos`).send(CALCULO_BASE);
    expect(res.status).toBe(401);
  });

  it('cria cálculo com dados válidos', async () => {
    const res = await request(app).post(`${BASE}/calculos`).set(WRITER_HEADER).send(CALCULO_BASE);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'cc-1');
    expect(res.body).toHaveProperty('status', 'rascunho');
  });

  it('retorna 400 com nome muito curto', async () => {
    const res = await request(app)
      .post(`${BASE}/calculos`)
      .set(WRITER_HEADER)
      .send({ ...CALCULO_BASE, nome: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('GET /calculos', () => {
  it('retorna 400 sem tenantId', async () => {
    const res = await request(app).get(`${BASE}/calculos`);
    expect(res.status).toBe(400);
  });

  it('retorna lista de cálculos do tenant', async () => {
    await request(app).post(`${BASE}/calculos`).set(WRITER_HEADER).send(CALCULO_BASE);
    const res = await request(app).get(`${BASE}/calculos?tenantId=tenant-cc-1`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('GET /calculos/:id', () => {
  it('retorna 404 para cálculo inexistente', async () => {
    const res = await request(app).get(`${BASE}/calculos/cc-999`);
    expect(res.status).toBe(404);
  });
});

describe('POST /calculos/:id/acoes', () => {
  it('adiciona ação de redução válida', async () => {
    const criado = await request(app)
      .post(`${BASE}/calculos`)
      .set(WRITER_HEADER)
      .send(CALCULO_BASE);
    const res = await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/acoes`)
      .set(WRITER_HEADER)
      .send(ACAO_BASE);
    expect(res.status).toBe(201);
    expect(res.body.acoes.length).toBe(1);
    expect(res.body.acoes[0]).toHaveProperty('reducaoTonCo2eq');
    // 100 luminárias × 0.2 = 20 tCO2eq
    expect(res.body.acoes[0].reducaoTonCo2eq).toBeCloseTo(20.0, 2);
  });

  it('retorna 400 com tipo de ação inválido', async () => {
    const criado = await request(app)
      .post(`${BASE}/calculos`)
      .set(WRITER_HEADER)
      .send(CALCULO_BASE);
    const res = await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/acoes`)
      .set(WRITER_HEADER)
      .send({ ...ACAO_BASE, tipo: 'tipo_invalido' });
    expect(res.status).toBe(400);
  });

  it('retorna 404 para cálculo inexistente', async () => {
    const res = await request(app)
      .post(`${BASE}/calculos/cc-999/acoes`)
      .set(WRITER_HEADER)
      .send(ACAO_BASE);
    expect(res.status).toBe(404);
  });
});

describe('POST /calculos/:id/calcular', () => {
  it('retorna 422 sem ações cadastradas', async () => {
    const criado = await request(app)
      .post(`${BASE}/calculos`)
      .set(WRITER_HEADER)
      .send(CALCULO_BASE);
    const res = await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/calcular`)
      .set(WRITER_HEADER);
    expect(res.status).toBe(422);
  });

  it('calcula créditos de carbono corretamente', async () => {
    const criado = await request(app)
      .post(`${BASE}/calculos`)
      .set(WRITER_HEADER)
      .send(CALCULO_BASE);
    await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/acoes`)
      .set(WRITER_HEADER)
      .send({ tipo: 'trocar_luminaria_convencional_led', quantidade: 50 });
    await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/acoes`)
      .set(WRITER_HEADER)
      .send({ tipo: 'reducao_perdas_rede', quantidade: 100 }); // 100 MWh
    const res = await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/calcular`)
      .set(WRITER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'calculado');
    expect(res.body.resultado).toHaveProperty('totalReducaoTonCo2eq');
    expect(res.body.resultado).toHaveProperty('valorEstimadoBrl');
    expect(res.body.resultado).toHaveProperty('hashIntegridade');
    // 50 × 0.2 + 100 × 0.0728 = 10 + 7.28 = 17.28
    expect(res.body.resultado.totalReducaoTonCo2eq).toBeCloseTo(17.28, 1);
  });
});

describe('POST /calculos/:id/certificar', () => {
  it('retorna 422 para cálculo não calculado', async () => {
    const criado = await request(app)
      .post(`${BASE}/calculos`)
      .set(WRITER_HEADER)
      .send(CALCULO_BASE);
    const res = await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/certificar`)
      .set(WRITER_HEADER);
    expect(res.status).toBe(422);
  });

  it('emite certificado para cálculo calculado', async () => {
    const criado = await request(app)
      .post(`${BASE}/calculos`)
      .set(WRITER_HEADER)
      .send(CALCULO_BASE);
    await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/acoes`)
      .set(WRITER_HEADER)
      .send(ACAO_BASE);
    await request(app).post(`${BASE}/calculos/${criado.body.id}/calcular`).set(WRITER_HEADER);
    const res = await request(app)
      .post(`${BASE}/calculos/${criado.body.id}/certificar`)
      .set(WRITER_HEADER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'certificado');
    expect(res.body).toHaveProperty('certificadoUrl');
  });
});
