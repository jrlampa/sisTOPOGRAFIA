/**
 * capacityPlanningService.test.ts — Testes unitários do serviço de capacidade (Item 126 [T1]).
 */
import {
  registrarSnapshot,
  listarHistorico,
  calcularMeta,
  statusCapacidade,
  _resetCapacity,
  CapacitySnapshot,
} from "../services/capacityPlanningService.js";

function makeSnapshot(overrides: Partial<CapacitySnapshot> = {}): CapacitySnapshot {
  return {
    timestamp: new Date(),
    jobsConcurrentes: 5,
    latenciaMediaMs: 100,
    memoriaUsadaMb: 512,
    cpuPct: 30,
    saturationScore: 0.3,
    ...overrides,
  };
}

beforeEach(() => _resetCapacity());

describe("registrarSnapshot", () => {
  it("adiciona snapshot ao histórico", () => {
    registrarSnapshot(makeSnapshot());
    expect(listarHistorico()).toHaveLength(1);
  });

  it("adiciona múltiplos snapshots", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 1 }));
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 2 }));
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 3 }));
    expect(listarHistorico()).toHaveLength(3);
  });

  it("retorna cópia do histórico (imutável)", () => {
    registrarSnapshot(makeSnapshot());
    const h1 = listarHistorico();
    const h2 = listarHistorico();
    expect(h1).not.toBe(h2);
  });

  it("limita histórico a 1000 entradas", () => {
    for (let i = 0; i < 1005; i++) {
      registrarSnapshot(makeSnapshot({ jobsConcurrentes: i }));
    }
    expect(listarHistorico()).toHaveLength(1000);
  });

  it("remove o mais antigo ao exceder 1000", () => {
    for (let i = 0; i < 1001; i++) {
      registrarSnapshot(makeSnapshot({ jobsConcurrentes: i }));
    }
    const hist = listarHistorico();
    expect(hist[0].jobsConcurrentes).toBe(1);
    expect(hist[999].jobsConcurrentes).toBe(1000);
  });
});

describe("listarHistorico", () => {
  it("retorna lista vazia inicialmente", () => {
    expect(listarHistorico()).toEqual([]);
  });

  it("retorna todos os snapshots em ordem de inserção", () => {
    const s1 = makeSnapshot({ jobsConcurrentes: 10 });
    const s2 = makeSnapshot({ jobsConcurrentes: 20 });
    registrarSnapshot(s1);
    registrarSnapshot(s2);
    const hist = listarHistorico();
    expect(hist[0].jobsConcurrentes).toBe(10);
    expect(hist[1].jobsConcurrentes).toBe(20);
  });
});

describe("calcularMeta", () => {
  it("retorna meta sem alerta quando histórico vazio", () => {
    const meta = calcularMeta(100, 500);
    expect(meta.maxJobsConcurrentes).toBe(100);
    expect(meta.latenciaAlvoMs).toBe(500);
    expect(meta.alertaAtivo).toBe(false);
    expect(meta.margemSeguranca).toBe(1.0);
  });

  it("ativa alerta quando jobs concurrentes > 80% do máximo", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 85, latenciaMediaMs: 100 }));
    const meta = calcularMeta(100, 500);
    expect(meta.alertaAtivo).toBe(true);
  });

  it("ativa alerta quando latência > 90% do alvo", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 5, latenciaMediaMs: 460 }));
    const meta = calcularMeta(100, 500);
    expect(meta.alertaAtivo).toBe(true);
  });

  it("não ativa alerta quando dentro dos limites", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 50, latenciaMediaMs: 200 }));
    const meta = calcularMeta(100, 500);
    expect(meta.alertaAtivo).toBe(false);
  });

  it("calcula margemSeguranca corretamente", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 25 }));
    const meta = calcularMeta(100, 500);
    expect(meta.margemSeguranca).toBeCloseTo(0.75);
  });

  it("margemSeguranca é 1.0 quando jobsConcurrentes=0", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 0 }));
    const meta = calcularMeta(100, 500);
    expect(meta.margemSeguranca).toBe(1.0);
  });

  it("margemSeguranca mínima é 0 (não negativa)", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 150 }));
    const meta = calcularMeta(100, 500);
    expect(meta.margemSeguranca).toBe(0);
  });

  it("usa apenas o último snapshot para cálculo", () => {
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 5, latenciaMediaMs: 100 }));
    registrarSnapshot(makeSnapshot({ jobsConcurrentes: 90, latenciaMediaMs: 100 }));
    const meta = calcularMeta(100, 500);
    expect(meta.alertaAtivo).toBe(true);
    expect(meta.margemSeguranca).toBeCloseTo(0.1);
  });
});

describe("statusCapacidade", () => {
  it("retorna estado inicial vazio", () => {
    const status = statusCapacidade();
    expect(status.snapshots).toBe(0);
    expect(status.ultima).toBeNull();
    expect(status.meta).toBeNull();
  });

  it("retorna contagem e última snapshot após registro", () => {
    const s = makeSnapshot({ jobsConcurrentes: 42 });
    registrarSnapshot(s);
    const status = statusCapacidade();
    expect(status.snapshots).toBe(1);
    expect(status.ultima?.jobsConcurrentes).toBe(42);
  });

  it("retorna meta após calcularMeta", () => {
    calcularMeta(200, 1000);
    const status = statusCapacidade();
    expect(status.meta?.maxJobsConcurrentes).toBe(200);
    expect(status.meta?.latenciaAlvoMs).toBe(1000);
  });

  it("snapshots aumenta a cada registro", () => {
    registrarSnapshot(makeSnapshot());
    registrarSnapshot(makeSnapshot());
    expect(statusCapacidade().snapshots).toBe(2);
  });
});

describe("_resetCapacity", () => {
  it("limpa histórico e meta", () => {
    registrarSnapshot(makeSnapshot());
    calcularMeta(100, 500);
    _resetCapacity();
    const status = statusCapacidade();
    expect(status.snapshots).toBe(0);
    expect(status.ultima).toBeNull();
    expect(status.meta).toBeNull();
  });
});
