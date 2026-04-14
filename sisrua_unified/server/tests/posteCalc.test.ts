/**
 * Mechanical Calculation Tests — CACUIA Port Parity
 *
 * Test cases derived from C:\myworld\EXCEL\LEGADO\CACUIA...xlsm Plan1 calculations
 */

// describe, it, expect are provided by Jest
import {
  calculatePosteAreas,
  calculateVentoPresn90,
  calculateForceVento,
  calculateResultantForce,
  converterKnMParaDaN_m,
  verificarPoste,
  calcularMargem,
  calculatePosteLoad,
  selecionarPosteDeCatalogo,
} from "../core/mechanicalCalc/posteCalc";
import {
  PosteInput,
  ConductorForceInput,
  VentoInput,
  EsforcoResultante,
} from "../core/mechanicalCalc/types";

describe("Mechanical Calc – CACUIA Parity", () => {
  // ─── Reference values from CACUIA Plan1 ───────────────────────────────────
  // Test case 1: Pole DT 11m/600 (11m height, 600 daN·m rupture)
  // Row 3-7:
  //   H3 = 11m
  //   D3 (topo) = 0.18m = 180mm
  //   D4 (base) = 0.36m = 360mm
  //   Rupture = 600 daN·m
  //   Material = CIMENTO

  it("calculates pole areas (S3, S4) matching Excel", () => {
    const poste: PosteInput = {
      alturaM: 11,
      diametroTopoMm: 180,
      diametroBaseMm: 360,
      rupturaKnM: 6.0, // 600 daN·m = 6 kN·m
      materialTipo: "CIMENTO",
    };

    const areas = calculatePosteAreas(poste);

    // Expected (from Excel C9):
    // S3 = π × 0.18 × 11 ≈ 6.22 m²
    // S4 = π × 0.36 × 11 ≈ 12.44 m²
    expect(areas.areaS3M2).toBeCloseTo(6.22, 1);
    expect(areas.areaS4M2).toBeCloseTo(12.44, 1);
  });

  it("calculates wind pressure 90° correctly", () => {
    // Example: V = 20 m/s (typical Brazilian wind)
    // P = 0.613 × 20² = 245.2 kg/m²
    const velocidade = 20;
    const pressao = calculateVentoPresn90(velocidade);

    expect(pressao).toBeCloseTo(245.2, 0);
  });

  it("calculates conductor wind force (CA 3/0)", () => {
    // Test case from CACUIA Plan1:
    // Conductor: CA 3/0
    //   Diametro: 10.4 mm
    //   Peso: 186 g/m = 0.186 kg/m
    // Vão: 33 m
    // Velocidade: 20 m/s
    // Tipo: PRIMARIO (Ca = 1.2)

    const conductor: ConductorForceInput & VentoInput = {
      codigo: "CA 3/0",
      vaoM: 33,
      pesoKgPerM: 0.186,
      diametroMm: 10.4,
      tipoRede: "PRIMARIO",
      anguloGraus: 0,
      velocidadeMs: 20,
      direcaoGraus: 0,
      coeficienteArrasto: 1.2,
      alturaMediaM: 8,
    };

    const force = calculateForceVento(conductor);

    // F = 245.2 × 1.2 × (10.4/1000) × 33 ≈ 100.98 daN (actual value from formula)
    expect(force.forcaVentoN / 9.81).toBeCloseTo(100.98, 1);

    // Expected weight: 0.186 × 33 ≈ 6.1 daN
    expect(force.pesoCondutorN / 9.81).toBeCloseTo(6.1, 1);
  });

  it("calculates resultant force and angle", () => {
    // Test values (from CACUIA Plan1):
    // Fx = 100 daN, Fy = 6 daN
    // Expected: Fr ≈ 100.18 daN, θ ≈ 3.43°

    const resultante = calculateResultantForce(100, 6, 11);

    expect(resultante.forcaResultanteDaN).toBeCloseTo(100.18, 1);
    expect(resultante.anguloResultanteGraus).toBeCloseTo(3.43, 1);
    expect(resultante.momentoFletorDaN_m).toBeCloseTo(1101.98, 0); // 100.18 × 11
  });

  it("converts kN·m to daN·m", () => {
    const knM = 6.0;
    const daNm = converterKnMParaDaN_m(knM);

    expect(daNm).toBe(600);
  });

  it("verifies pole adequacy", () => {
    // verificarPoste with safety margin 10%:
    // OK limit = ruptura * (1 - 0.10) = 600 * 0.9 = 540
    // MARGEM_BAIXA: 540 < momento <= 600
    // Test OK: momento 500 <= 540
    const statusOk = verificarPoste(500, 600);
    expect(statusOk).toBe("OK");

    // Test exact rupture level: margin 0% (momento == ruptura)
    const status = verificarPoste(600, 600);
    expect(status).toBe("MARGEM_BAIXA");

    // Margem reduzida (margin safety = 10%)
    const statusMargem = verificarPoste(
      600 * 0.95,
      600,
    );
    expect(statusMargem).toBe("MARGEM_BAIXA");

    // Excede
    const statusExcede = verificarPoste(
      600 * 1.05,
      600,
    );
    expect(statusExcede).toBe("EXCEDE");
  });

  it("calculates safety margin correctly", () => {
    const momentoFletorDaN_m = 500;
    const rupturaDAn_m = 600;

    const margem = calcularMargem(momentoFletorDaN_m, rupturaDAn_m);
    expect(margem).toBeCloseTo(16.67, 1); // (600-500)/600 * 100
  });

  it("completes pole load calculation (integration test)", () => {
    const poste: PosteInput = {
      alturaM: 11,
      diametroTopoMm: 180,
      diametroBaseMm: 360,
      rupturaKnM: 6.0,
      materialTipo: "CIMENTO",
    };

    const forcas: EsforcoResultante[] = [
      {
        forcaResultanteDaN: 100.18,
        anguloResultanteGraus: 3.43,
        momentoFletorDaN_m: 1101.98,
      },
    ];

    const output = calculatePosteLoad(poste, forcas);

    expect(output.areaS3M2).toBeCloseTo(6.22, 1);
    expect(output.momentoFletorDaN_m).toBeCloseTo(1101.98, 0);
    expect(output.verificacao).toBe("EXCEDE"); // 1101.98 > 600 daN·m
    expect(output.margemPercent).toBeLessThan(0); // Negative margin = exceeds
  });

  it("selects adequate pole from catalog", () => {
    // Simulated catalog
    const catalogo = [
      {
        modelo: "DT 11m/300",
        alturaM: 11,
        diametroTopoMm: 180,
        diametroBaseMm: 360,
        rupturaKnM: 3.0,
        pesoKg: 350,
        materialTipo: "CIMENTO" as const,
      },
      {
        modelo: "DT 11m/600",
        alturaM: 11,
        diametroTopoMm: 180,
        diametroBaseMm: 360,
        rupturaKnM: 6.0,
        pesoKg: 420,
        materialTipo: "CIMENTO" as const,
      },
    ];

    // With bending moment of 500 daN·m, should select 11m/600
    const momentoFletorDaN_m = 500;

    const posteEscolhido = selecionarPosteDeCatalogo(
      catalogo,
      momentoFletorDaN_m,
      10,
    );

    expect(posteEscolhido).toBeDefined();
    expect(posteEscolhido?.modelo).toBe("DT 11m/600");
  });
});
