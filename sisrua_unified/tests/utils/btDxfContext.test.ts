/**
 * btDxfContext.test.ts — Vitest: teste da construção de contexto DXF.
 * Verifica normalização de dados para exportação de planta.
 */

import { describe, it, expect } from "vitest";
import { buildBtDxfContext } from "../../src/utils/btDxfContext";
import { INITIAL_APP_STATE } from "../../src/app/initialState";
import { EMPTY_BT_TOPOLOGY } from "../../src/utils/btNormalization";

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
});
