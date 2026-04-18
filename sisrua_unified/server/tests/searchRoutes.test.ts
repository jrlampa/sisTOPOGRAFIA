import express from 'express';
import request from 'supertest';

const resolveLocationMock = jest.fn();

jest.mock('../services/geocodingService', () => ({
  GeocodingService: {
    resolveLocation: resolveLocationMock,
  },
}));

describe('searchRoutes error sanitization', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns generic 500 without leaking internal error details', async () => {
    resolveLocationMock.mockRejectedValueOnce(new Error('DB host 10.0.0.5 failed'));

    const { default: searchRoutes } = await import('../routes/searchRoutes');
    const app = express();
    app.use(express.json());
    app.use('/api/search', searchRoutes);

    const response = await request(app)
      .post('/api/search')
      .send({ query: 'Rua das Flores 10' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Search service temporarily unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('10.0.0.5');
    expect(JSON.stringify(response.body)).not.toContain('DB host');
  });
});

describe("searchRoutes — cobertura adicional", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("400 quando corpo inválido (sem query)", async () => {
    const { default: searchRoutes } = await import("../routes/searchRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/search", searchRoutes);
    const res = await request(app).post("/api/search").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("200 quando localizacao encontrada", async () => {
    resolveLocationMock.mockResolvedValue({ lat: -23.5, lng: -46.6, name: "Sao Paulo" });
    const { default: searchRoutes } = await import("../routes/searchRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/search", searchRoutes);
    const res = await request(app).post("/api/search").send({ query: "Sao Paulo" });
    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(-23.5);
  });

  it("404 quando localizacao nao encontrada (null)", async () => {
    resolveLocationMock.mockResolvedValue(null);
    const { default: searchRoutes } = await import("../routes/searchRoutes");
    const app = express();
    app.use(express.json());
    app.use("/api/search", searchRoutes);
    const res = await request(app).post("/api/search").send({ query: "lugar inexistente xyz" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Location not found");
  });
});


describe('searchRoutes - extra', () => { afterEach(() => { jest.resetModules(); jest.clearAllMocks(); }); it('400 sem query', async () => { const {default: r} = await import('../routes/searchRoutes'); const a=require('express')(); a.use(require('express').json()); a.use('/s',r); const res=await require('supertest')(a).post('/s').send({}); expect(res.status).toBe(400); }); it('200 found', async () => { resolveLocationMock.mockResolvedValue({lat:-23.5,lng:-46.6,name:'SP'}); const {default: r} = await import('../routes/searchRoutes'); const a=require('express')(); a.use(require('express').json()); a.use('/s',r); const res=await require('supertest')(a).post('/s').send({query:'SP'}); expect(res.status).toBe(200); }); it('404 not found', async () => { resolveLocationMock.mockResolvedValue(null); const {default: r} = await import('../routes/searchRoutes'); const a=require('express')(); a.use(require('express').json()); a.use('/s',r); const res=await require('supertest')(a).post('/s').send({query:'xyz'}); expect(res.status).toBe(404); }); });
