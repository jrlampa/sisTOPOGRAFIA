/**
 * btDxfContext.test.ts — Vitest: teste da construção de contexto DXF.
 * Verifica normalização de dados para exportação de planta.
 */

import { describe, it, expect } from "vitest";
import { buildBtDxfContext } from "../../src/utils/btDxfContext";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { EMPTY_BT_TOPOLOGY } from "../../src/utils/btNormalization";
import type { BtTopology } from "../../src/types";

describe("btDxfContext", () => {
  it("deve construir o contexto básico de exportação", () => {
    const context = buildBtDxfContext({
      btTopology: EMPTY_BT_TOPOLOGY,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: true
    });

    expect(context.totalPoles).toBe(0);
    expect(context.btNetworkScenario).toBe("asis");
    expect(context.topology).toBeDefined();
  });

  it("deve incluir resultados DG se fornecidos", () => {
    const dgResults = { score: 90, selectedKva: 75 };
    const context = buildBtDxfContext({
      btTopology: EMPTY_BT_TOPOLOGY,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: true,
      dgResults
    });

    expect(context.dgResults).toEqual(dgResults);
  });

  it("sets topology to null when includeTopology is false", () => {
    const context = buildBtDxfContext({
      btTopology: EMPTY_BT_TOPOLOGY,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "proj1",
      includeTopology: false,
    });
    expect(context.topology).toBeNull();
  });

  it("uses provided accumulatedByPole instead of recalculating", () => {
    const accumulatedByPole = [
      {
        poleId: "P1",
        localClients: 2,
        accumulatedClients: 2,
        localTrechoDemandKva: 1.5,
        accumulatedDemandKva: 1.5,
      },
    ];
    const context = buildBtDxfContext({
      btTopology: EMPTY_BT_TOPOLOGY,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: true,
      accumulatedByPole,
    });
    expect(context.accumulatedByPole).toBe(accumulatedByPole);
  });

  it("computes counts and totals from topology data", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: -22, lng: -43, title: "P1", verified: true },
        { id: "P2", lat: -22.1, lng: -43.1, title: "P2" },
      ],
      transformers: [
        {
          id: "T1",
          poleId: "P1",
          lat: -22,
          lng: -43,
          title: "T1",
          verified: true,
          projectPowerKva: 75,
        } as any,
      ],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", conductorName: "4x25mm²", quantity: 1 }],
          lengthMeters: 50,
          verified: true,
        },
      ],
    };

    const context = buildBtDxfContext({
      btTopology: topology,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "proj2",
      includeTopology: true,
    });

    expect(context.totalPoles).toBe(2);
    expect(context.totalTransformers).toBe(1);
    expect(context.totalEdges).toBe(1);
    expect(context.verifiedPoles).toBe(1);
    expect(context.verifiedTransformers).toBe(1);
    expect(context.verifiedEdges).toBe(1);
    expect(context.topology!.poles).toHaveLength(2);
    expect(context.topology!.transformers).toHaveLength(1);
    expect(context.topology!.edges).toHaveLength(1);
  });

  it("handles clandestino project type for cqt inputs", () => {
    const settings = {
      ...INITIAL_APP_STATE.settings,
      projectType: "clandestino" as const,
      clandestinoAreaM2: 50,
    };
    const context = buildBtDxfContext({
      btTopology: EMPTY_BT_TOPOLOGY,
      settings,
      btNetworkScenario: "asis",
      includeTopology: false,
    });
    expect(context.projectType).toBe("clandestino");
    expect(context.cqtComputationInputs.dmdi.clandestinoEnabled).toBe(true);
  });

  it("handles edge with conductorName for CQT branches", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0.001, lng: 0.001, title: "P2" },
      ],
      transformers: [],
      edges: [
        {
          id: "ESQUERDO-E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", conductorName: "4x16mm²", quantity: 1 }],
          lengthMeters: 30,
        },
      ],
    };
    const context = buildBtDxfContext({
      btTopology: topology,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: false,
    });
    expect(context.cqtComputationInputs.branches).toHaveLength(1);
    expect(context.cqtComputationInputs.branches[0].lado).toBe("ESQUERDO");
  });

  it("filters out edges without conductorName from CQT branches", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0.001, lng: 0.001, title: "P2" },
      ],
      transformers: [],
      edges: [
        {
          id: "E-no-conductor",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [], // no conductors → should be filtered out
          lengthMeters: 30,
        },
      ],
    };
    const context = buildBtDxfContext({
      btTopology: topology,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: false,
    });
    expect(context.cqtComputationInputs.branches).toHaveLength(0);
  });
});

describe("btDxfContext – additional coverage", () => {
  it("returns 'DIREITO' for pole/edge labeled with DIR prefix", () => {
    // Edge ID with "DIREITO" label causes getSideLabel to return "DIREITO"
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0.001, lng: 0.001, title: "P2" },
      ],
      transformers: [],
      edges: [
        {
          id: "DIREITO-E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", conductorName: "4x16mm²", quantity: 1 }],
          lengthMeters: 20,
        },
      ],
    };
    const context = buildBtDxfContext({
      btTopology: topology,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: false,
    });
    // cqtComputationInputs.branches should contain the edge with lado=DIREITO
    expect(context.cqtComputationInputs.branches).toHaveLength(1);
    expect(context.cqtComputationInputs.branches[0].lado).toBe("DIREITO");
  });

  it("counts only clandestino ramais in clandestino totalClientsX", () => {
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          ramais: [
            { id: "r1", quantity: 3 }, // undefined ramalType → clandestino
            { id: "r2", quantity: 5, ramalType: "5 CC" }, // non-clandestino
          ],
        },
      ],
      transformers: [],
      edges: [],
    };
    const settings = {
      ...INITIAL_APP_STATE.settings,
      projectType: "clandestino" as const,
    };
    const context = buildBtDxfContext({
      btTopology: topology,
      settings,
      btNetworkScenario: "asis",
      includeTopology: true,
    });
    // In clandestino mode, only r1 (quantity=3, clandestino) counts
    expect(context.cqtComputationInputs.dmdi.sumClientsX).toBe(3);
  });

  it("includes replacementFromConductors in topology edges", () => {
    const topology: BtTopology = {
      poles: [
        { id: "P1", lat: 0, lng: 0, title: "P1" },
        { id: "P2", lat: 0, lng: 0.001, title: "P2" },
      ],
      transformers: [],
      edges: [
        {
          id: "E1",
          fromPoleId: "P1",
          toPoleId: "P2",
          conductors: [{ id: "c1", conductorName: "4x16mm²", quantity: 1 }],
          replacementFromConductors: [
            { id: "rc1", conductorName: "4x10mm²", quantity: 2 },
          ],
          lengthMeters: 10,
        },
      ],
    };
    const context = buildBtDxfContext({
      btTopology: topology,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: true,
    });
    expect(context.topology!.edges[0].replacementFromConductors).toHaveLength(1);
    expect(context.topology!.edges[0].replacementFromConductors[0].conductorName).toBe("4x10mm²");
  });

  it("includes poles with ramais in topology output", () => {
    const topology: BtTopology = {
      poles: [
        {
          id: "P1",
          lat: 0,
          lng: 0,
          title: "P1",
          ramais: [{ id: "r1", quantity: 5, ramalType: "5 CC", notes: "  note " }],
        },
      ],
      transformers: [],
      edges: [],
    };
    const context = buildBtDxfContext({
      btTopology: topology,
      settings: INITIAL_APP_STATE.settings,
      btNetworkScenario: "asis",
      includeTopology: true,
    });
    expect(context.topology!.poles[0].ramais).toHaveLength(1);
    expect(context.topology!.poles[0].ramais[0].quantity).toBe(5);
    expect(context.topology!.poles[0].ramais[0].notes).toBe("note"); // trimmed
  });
});
