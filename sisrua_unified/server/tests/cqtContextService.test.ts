import { CQT_BASELINE_TARGETS } from "../constants/cqtBaselineTargets";
import { TRAFOS_Z_BASELINE } from "../constants/cqtLookupTables";
import { attachCqtSnapshotToBtContext } from "../services/cqtContextService";

describe("cqtContextService.attachCqtSnapshotToBtContext", () => {
  it("returns null when btContext is not an object", () => {
    expect(attachCqtSnapshotToBtContext(null)).toBeNull();
    expect(attachCqtSnapshotToBtContext("invalid")).toBeNull();
  });

  it("keeps original context when cqt inputs are missing", () => {
    const original = { projectType: "ramais" };
    const enriched = attachCqtSnapshotToBtContext(original);
    expect(enriched).toEqual(original);
  });

  it("attaches partial snapshot when only DMDI inputs are provided", () => {
    const btContext = {
      projectType: "ramais",
      cqtComputationInputs: {
        scenario: "proj1",
        dmdi: {
          clandestinoEnabled: true,
          aa24DemandBase: 200,
          sumClientsX: 70,
          ab35LookupDmdi: 2.84,
        },
      },
    };

    const enriched = attachCqtSnapshotToBtContext(btContext) as Record<
      string,
      any
    >;
    expect(enriched.cqtSnapshot).toBeDefined();
    expect(enriched.cqtSnapshot.scenario).toBe("proj1");
    expect(enriched.cqtSnapshot.dmdi).toEqual({
      dmdi: 2.84,
      source: "lookup-ab35",
    });
    expect(enriched.cqtSnapshot.geral).toBeUndefined();
    expect(enriched.cqtSnapshot.db).toBeUndefined();
  });

  it("attaches cqt snapshot when complete inputs are provided", () => {
    const btContext = {
      projectType: "ramais",
      cqtComputationInputs: {
        scenario: "atual",
        dmdi: {
          clandestinoEnabled: true,
          aa24DemandBase: 206.9999999999999,
          sumClientsX: 73,
          ab35LookupDmdi: CQT_BASELINE_TARGETS.ramal.ab35LookupDmdi,
        },
        geral: {
          pontoRamal: "RAMAL",
          qtMttr: CQT_BASELINE_TARGETS.db.k10QtMttr,
          esqCqtByPonto: {
            RAMAL: CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto,
          },
          dirCqtByPonto: {
            RAMAL: CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto,
          },
        },
        db: {
          trAtual: CQT_BASELINE_TARGETS.db.k6TrAtual,
          demAtual: CQT_BASELINE_TARGETS.db.k7DemAtual,
          qtMt:
            CQT_BASELINE_TARGETS.db.k10QtMttr - CQT_BASELINE_TARGETS.db.k8QtTr,
          trafosZ: TRAFOS_Z_BASELINE,
        },
      },
    };

    const enriched = attachCqtSnapshotToBtContext(btContext);
    expect(enriched).not.toBeNull();
    expect(enriched).toHaveProperty("cqtSnapshot");

    const snapshot = (enriched as Record<string, any>).cqtSnapshot;
    expect(snapshot.scenario).toBe("atual");
    expect(snapshot.dmdi.dmdi).toBeCloseTo(
      CQT_BASELINE_TARGETS.ramal.aa30Dmdi,
      12,
    );
    expect(snapshot.geral.p31CqtNoPonto).toBeCloseTo(
      CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto,
      12,
    );
    expect(snapshot.geral.p32CqtNoPonto).toBeCloseTo(
      CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto,
      12,
    );
    expect(snapshot.db.k8QtTr).toBeCloseTo(CQT_BASELINE_TARGETS.db.k8QtTr, 12);
    expect(snapshot.db.k10QtMttr).toBeCloseTo(
      CQT_BASELINE_TARGETS.db.k10QtMttr,
      12,
    );
    expect(typeof snapshot.generatedAt).toBe("string");
    expect(snapshot.parity).toBeDefined();
    expect(snapshot.parity.scenario).toBe("atual");
    expect(snapshot.parity.referenceStatus).toBe("complete");
    expect(snapshot.parity.failed).toBe(0);
  });

  it("uses scenario lookup fallback when db.trafosZ is omitted", () => {
    const btContext = {
      projectType: "ramais",
      cqtComputationInputs: {
        scenario: "proj2",
        db: {
          trAtual: 225,
          demAtual: 101.95599999999999,
          qtMt: 0.018299999999999997,
        },
      },
    };

    const enriched = attachCqtSnapshotToBtContext(btContext) as Record<
      string,
      any
    >;
    expect(enriched.cqtSnapshot).toBeDefined();
    expect(enriched.cqtSnapshot.scenario).toBe("proj2");
    expect(enriched.cqtSnapshot.db.k8QtTr).toBeCloseTo(
      CQT_BASELINE_TARGETS.db.k8QtTr,
      12,
    );
    expect(enriched.cqtSnapshot.db.k10QtMttr).toBeCloseTo(
      CQT_BASELINE_TARGETS.db.k10QtMttr,
      12,
    );
    expect(enriched.cqtSnapshot.parity).toBeDefined();
    expect(enriched.cqtSnapshot.parity.scenario).toBe("proj2");
    expect(enriched.cqtSnapshot.parity.referenceStatus).toBe("partial");
    expect(enriched.cqtSnapshot.parity.pending).toHaveLength(0);
    expect(enriched.cqtSnapshot.parity.skipped).toEqual([
      "GERAL PROJ2!P31",
      "GERAL PROJ2!P32",
    ]);
  });

  it("computes branch protection snapshot when branches input is provided", () => {
    const btContext = {
      projectType: "ramais",
      cqtComputationInputs: {
        scenario: "atual",
        qtPontoCalculationMethod: "power_factor",
        powerFactor: 0.92,
        branches: [
          {
            trechoId: "TR-001",
            fase: "TRI",
            acumuladaKva: 5,
            eta: 1,
            tensaoTrifasicaV: 127,
            conductorName: "70 Al - MX",
            lengthMeters: 20,
            temperatureC: 30,
          },
          {
            trechoId: "TR-002",
            fase: "MONO",
            acumuladaKva: 30,
            eta: 1,
            tensaoTrifasicaV: 127,
            conductorName: "16 Al_CONC_Tri",
            lengthMeters: 15,
            temperatureC: 35,
          },
        ],
      },
    };

    const enriched = attachCqtSnapshotToBtContext(btContext) as Record<
      string,
      any
    >;
    expect(enriched.cqtSnapshot.branches).toBeDefined();
    expect(enriched.cqtSnapshot.branches.items).toHaveLength(2);
    expect(enriched.cqtSnapshot.branches.okCount).toBe(0);
    expect(enriched.cqtSnapshot.branches.verificarCount).toBe(2);
    expect(enriched.cqtSnapshot.branches.items[0]).toHaveProperty("status");
    expect(enriched.cqtSnapshot.branches.items[0]).toHaveProperty(
      "correctedResistance",
    );
    expect(enriched.cqtSnapshot.branches.items[0]).toHaveProperty("qtPonto");
    expect(enriched.cqtSnapshot.qtPontoConfig).toEqual({
      calculationMethod: "power_factor",
      powerFactor: 0.92,
    });
    expect(
      enriched.cqtSnapshot.branches.items[0].qtPontoCalculationMethod,
    ).toBe("power_factor");
  });

  it("derives geral snapshot from branches and db when geral is not provided", () => {
    const btContext = {
      projectType: "ramais",
      cqtComputationInputs: {
        scenario: "atual",
        db: {
          trAtual: CQT_BASELINE_TARGETS.db.k6TrAtual,
          demAtual: CQT_BASELINE_TARGETS.db.k7DemAtual,
          qtMt:
            CQT_BASELINE_TARGETS.db.k10QtMttr - CQT_BASELINE_TARGETS.db.k8QtTr,
          trafosZ: TRAFOS_Z_BASELINE,
        },
        branches: [
          {
            trechoId: "ESQ-001",
            ponto: "RAMAL",
            lado: "ESQUERDO",
            fase: "TRI",
            acumuladaKva: 6,
            eta: 1,
            tensaoTrifasicaV: 127,
            conductorName: "70 Al - MX",
            lengthMeters: 20,
            temperatureC: 30,
          },
          {
            trechoId: "DIR-001",
            ponto: "RAMAL",
            lado: "DIREITO",
            fase: "TRI",
            acumuladaKva: 6,
            eta: 1,
            tensaoTrifasicaV: 127,
            conductorName: "70 Al - MX",
            lengthMeters: 25,
            temperatureC: 30,
          },
        ],
      },
    };

    const enriched = attachCqtSnapshotToBtContext(btContext) as Record<
      string,
      any
    >;
    expect(enriched.cqtSnapshot.geral).toBeDefined();
    expect(enriched.cqtSnapshot.geral.source).toBe("branches-derived");
    expect(enriched.cqtSnapshot.geral.p31CqtNoPonto).toBeGreaterThan(0);
    expect(enriched.cqtSnapshot.geral.p32CqtNoPonto).toBeGreaterThan(0);
  });
});
