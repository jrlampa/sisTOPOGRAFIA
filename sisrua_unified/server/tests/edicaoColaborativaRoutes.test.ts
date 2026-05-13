/**
 * Testes T2-56 — Edição Colaborativa em Tempo Real
 */

import request from 'supertest';
import app from '../app.js';
import { EdicaoColaborativaService } from '../services/edicaoColaborativaService.js';

const BASE = '/api/edicao-colaborativa';
const asWriter = (req: ReturnType<typeof request>) => req.set('x-user-id', 'collab-writer');

beforeEach(() => EdicaoColaborativaService._reset());

describe('POST /sessoes', () => {
  it('rejeita escrita sem identidade autenticada', async () => {
    const res = await request(app).post(`${BASE}/sessoes`).send({
      tenantId: 't1',
      projetoId: 'proj-1',
      nomeProjeto: 'Projeto Rua das Flores',
      responsavel: 'Engenheiro Chefe',
    });
    expect(res.status).toBe(401);
  });

  it('cria sessão com status aberta', async () => {
    const res = await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 't1',
      projetoId: 'proj-1',
      nomeProjeto: 'Projeto Rua das Flores',
      responsavel: 'Engenheiro Chefe',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('sc-1');
    expect(res.body.status).toBe('aberta');
    expect(res.body.versaoAtual).toBe(0);
    expect(res.body.participantes).toHaveLength(0);
  });

  it('rejeita sem tenantId', async () => {
    const res = await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      projetoId: 'proj-1',
      nomeProjeto: 'Projeto',
      responsavel: 'Eng',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /sessoes', () => {
  it('lista vazia', async () => {
    const res = await request(app).get(`${BASE}/sessoes`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('filtra por tenantId', async () => {
    await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 'tA',
      projetoId: 'p1',
      nomeProjeto: 'Projeto Alpha',
      responsavel: 'Eng Alpha',
    });
    await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 'tB',
      projetoId: 'p2',
      nomeProjeto: 'Projeto Beta',
      responsavel: 'Eng Beta',
    });
    const res = await request(app).get(`${BASE}/sessoes?tenantId=tA`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tenantId).toBe('tA');
  });
});

describe('GET /sessoes/:id', () => {
  it('retorna 404 para ID inexistente', async () => {
    const res = await request(app).get(`${BASE}/sessoes/sc-999`);
    expect(res.status).toBe(404);
  });

  it('retorna sessão existente', async () => {
    await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 't1',
      projetoId: 'p1',
      nomeProjeto: 'Sessão Encontrada',
      responsavel: 'Responsavel',
    });
    const res = await request(app).get(`${BASE}/sessoes/sc-1`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sc-1');
  });
});

describe('POST /sessoes/:id/participantes', () => {
  beforeEach(async () => {
    await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 't1',
      projetoId: 'p1',
      nomeProjeto: 'Sessão Participantes',
      responsavel: 'Responsavel',
    });
  });

  it('adiciona participante editor', async () => {
    const res = await request(app)
      .post(`${BASE}/sessoes/sc-1/participantes`)
      .set('x-user-id', 'collab-writer')
      .send({ usuarioId: 'u1', nomeUsuario: 'João da Silva', papel: 'editor' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('pp-1');
    expect(res.body.papel).toBe('editor');
    expect(res.body.status).toBe('ativo');
  });

  it('recusa participante em sessão bloqueada', async () => {
    await asWriter(request(app).post(`${BASE}/sessoes/sc-1/bloquear`));
    const res = await request(app)
      .post(`${BASE}/sessoes/sc-1/participantes`)
      .set('x-user-id', 'collab-writer')
      .send({ usuarioId: 'u2', nomeUsuario: 'Maria Souza', papel: 'revisor' });
    expect(res.status).toBe(422);
  });
});

describe('POST /sessoes/:id/operacoes', () => {
  let participanteId: string;
  let observadorId: string;

  beforeEach(async () => {
    await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 't1',
      projetoId: 'p1',
      nomeProjeto: 'Sessão Ops',
      responsavel: 'Responsavel',
    });
    const p = await asWriter(
      request(app)
        .post(`${BASE}/sessoes/sc-1/participantes`)
        .send({ usuarioId: 'u1', nomeUsuario: 'Editor Principal', papel: 'editor' })
    );
    participanteId = p.body.id;
    const obs = await asWriter(
      request(app)
        .post(`${BASE}/sessoes/sc-1/participantes`)
        .send({ usuarioId: 'u2', nomeUsuario: 'Observador', papel: 'observador' })
    );
    observadorId = obs.body.id;
  });

  it('registra operação sem conflito (primeira operação)', async () => {
    const res = await request(app)
      .post(`${BASE}/sessoes/sc-1/operacoes`)
      .set('x-user-id', 'collab-writer')
      .send({
        participanteId,
        tipoOperacao: 'adicionar_ponto',
        payload: { x: 100, y: 200 },
        versaoBase: 0,
      });
    expect(res.status).toBe(201);
    expect(res.body.conflito).toBe(false);
    expect(res.body.versaoResultante).toBe(1);
  });

  it('detecta conflito quando versaoBase < versaoAtual', async () => {
    await request(app)
      .post(`${BASE}/sessoes/sc-1/operacoes`)
      .set('x-user-id', 'collab-writer')
      .send({ participanteId, tipoOperacao: 'adicionar_ponto', payload: {}, versaoBase: 0 });
    const res = await request(app)
      .post(`${BASE}/sessoes/sc-1/operacoes`)
      .set('x-user-id', 'collab-writer')
      .send({ participanteId, tipoOperacao: 'mover_ponto', payload: {}, versaoBase: 0 });
    expect(res.status).toBe(201);
    expect(res.body.conflito).toBe(true);
  });

  it('bloqueia operação de observador', async () => {
    const res = await request(app)
      .post(`${BASE}/sessoes/sc-1/operacoes`)
      .set('x-user-id', 'collab-writer')
      .send({ participanteId: observadorId, tipoOperacao: 'comentar', payload: {}, versaoBase: 0 });
    expect(res.status).toBe(422);
  });
});

describe('POST /sessoes/:id/bloquear', () => {
  it('bloqueia sessão', async () => {
    await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 't1',
      projetoId: 'p1',
      nomeProjeto: 'Sessão Bloquear',
      responsavel: 'Responsavel',
    });
    const res = await asWriter(request(app).post(`${BASE}/sessoes/sc-1/bloquear`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('bloqueada');
  });
});

describe('POST /sessoes/:id/encerrar', () => {
  it('encerra sessão e marca participantes como inativos', async () => {
    await asWriter(request(app).post(`${BASE}/sessoes`)).send({
      tenantId: 't1',
      projetoId: 'p1',
      nomeProjeto: 'Sessão Encerrar',
      responsavel: 'Responsavel',
    });
    await asWriter(
      request(app)
        .post(`${BASE}/sessoes/sc-1/participantes`)
        .send({ usuarioId: 'u1', nomeUsuario: 'Participante Ativo', papel: 'editor' })
    );
    const res = await asWriter(request(app).post(`${BASE}/sessoes/sc-1/encerrar`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('encerrada');
    expect(res.body.participantes[0].status).toBe('inativo');
    expect(res.body.participantes[0].saidaEm).toBeDefined();
  });
});

describe('GET /papeis', () => {
  it('lista papéis disponíveis', async () => {
    const res = await request(app).get(`${BASE}/papeis`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('editor');
    expect(res.body).toContain('revisor');
    expect(res.body).toContain('observador');
  });
});
