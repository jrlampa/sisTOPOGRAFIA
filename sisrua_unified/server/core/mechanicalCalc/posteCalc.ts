/**
 * Mechanical Calculation Engine — CACUIA Port
 *
 * Core formulas for pole bending moment calculation, conductor force decomposition,
 * and structural verification.
 */

import {
  PosteInput,
  PosteOutput,
  ConductorForceInput,
  VentoInput,
  ForceOutput,
  EsforcoResultante,
  PosteVerificacao,
  PosteCatalogEntry,
} from "./types.js";

const PI = Math.PI;

/**
 * Calculate cylindrical equivalent areas for pole cross-section
 * based on Excel formula: S = π × D × L
 *
 * Source: CACUIA Plan1 C9-C10
 */
export function calculatePosteAreas(input: PosteInput): {
  areaS3M2: number;
  areaS4M2: number;
} {
  const topoM = input.diametroTopoMm / 1000;
  const baseM = input.diametroBaseMm / 1000;

  const areaS3M2 = PI * topoM * input.alturaM;
  const areaS4M2 = PI * baseM * input.alturaM;

  return { areaS3M2, areaS4M2 };
}

/**
 * Wind pressure at 90° (perpendicular incidence)
 * Formula: P = 0.613 × V²
 *
 * Source: CACUIA Plan1 C22
 * Reference: ABNT NBR 6123
 */
export function calculateVentoPresn90(velocidadeMs: number): number {
  if (velocidadeMs <= 0) return 0;
  const P = 0.613 * velocidadeMs * velocidadeMs; // kg/m²
  return P;
}

/**
 * Wind pressure at 45° (diagonal incidence)
 * Approximation: P_45 = P_90 / 2
 */
export function calculateVentoPressao45(velocidadeMs: number): number {
  return calculateVentoPresn90(velocidadeMs) / 2;
}

/**
 * Calculate wind force on conductor segment
 * Formula: F_vento = Pressao × Ca × D × L
 *
 * Where:
 *   Pressao = 0.613 × V² (kg/m²)
 *   Ca = Drag coefficient
 *   D = Conductor diameter (m)
 *   L = Span (m)
 *   Result in: daN (decanewtons)
 *
 * Source: CACUIA Plan1 C26
 */
export function calculateForceVento(
  input: ConductorForceInput & VentoInput,
): ForceOutput {
  const pressao90 = calculateVentoPresn90(input.velocidadeMs);
  const pressaoEfetiva = pressao90; // Simplified: assuming 90° for worst-case

  // Projected area (diameter × span)
  const areaProjM2 = (input.diametroMm / 1000) * input.vaoM;

  // Wind force in kg-force
  const forceVentoKgf = pressaoEfetiva * input.coeficienteArrasto * areaProjM2;

  // Convert to daN (1 daN = 1 kgf)
  const forceVentoDaN = forceVentoKgf;

  // Weight force (vertical)
  const pesoConductorDaN = input.pesoKgPerM * input.vaoM;

  // Decompose wind force by angle
  const anguloRad = (input.anguloGraus * PI) / 180;
  const componenteFxDaN = forceVentoDaN * Math.cos(anguloRad);
  const componenteFyDaN =
    forceVentoDaN * Math.sin(anguloRad) + pesoConductorDaN;

  return {
    forcaVentoN: forceVentoDaN * 9.81, // Convert daN to N (1 daN ≈ 9.81 N)
    pesoCondutorN: pesoConductorDaN * 9.81,
    componenteFxN: componenteFxDaN * 9.81,
    componenteFyN: componenteFyDaN * 9.81,
  };
}

/**
 * Calculate resultant force and angle
 * Formula:
 *   Fr = √(Fx² + Fy²)
 *   θ = arctan(Fy/Fx) × 180/π
 *
 * Source: CACUIA Plan1 C34-C35
 */
export function calculateResultantForce(
  componenteFxDaN: number,
  componenteFyDaN: number,
  alturaPosteM: number,
): EsforcoResultante {
  const forcaResultanteDaN = Math.sqrt(
    componenteFxDaN ** 2 + componenteFyDaN ** 2,
  );

  const anguloResultanteRad =
    componenteFxDaN !== 0
      ? Math.atan(componenteFyDaN / componenteFxDaN)
      : PI / 2;
  const anguloResultanteGraus = (anguloResultanteRad * 180) / PI;

  // Bending moment: M = Force × Height
  const momentoFletorDaN_m = forcaResultanteDaN * alturaPosteM;

  return {
    forcaResultanteDaN,
    anguloResultanteGraus,
    momentoFletorDaN_m,
  };
}

/**
 * Convert bending moment from kN·m to daN·m
 * 1 kN·m = 100 daN·m
 */
export function converterKnMParaDaN_m(knM: number): number {
  return knM * 100;
}

/**
 * Verify pole structural adequacy
 * Source: CACUIA Plan1 C37
 */
export function verificarPoste(
  momentoFletorDaN_m: number,
  rupturaDAn_m: number,
  margemSegurancaPercent: number = 10,
): PosteOutput["verificacao"] {
  const limiteComMargem = rupturaDAn_m * (1 - margemSegurancaPercent / 100);

  if (momentoFletorDaN_m <= limiteComMargem) {
    return "OK";
  } else if (momentoFletorDaN_m <= rupturaDAn_m) {
    return "MARGEM_BAIXA";
  } else {
    return "EXCEDE";
  }
}

/**
 * Calculate safety margin
 */
export function calcularMargem(
  momentoFletorDaN_m: number,
  rupturaDAn_m: number,
): number {
  if (rupturaDAn_m === 0) return 0;
  return ((rupturaDAn_m - momentoFletorDaN_m) / rupturaDAn_m) * 100;
}

/**
 * Main pole calculation pipeline
 */
export function calculatePosteLoad(
  poste: PosteInput,
  forcas: EsforcoResultante[],
): PosteOutput {
  const areas = calculatePosteAreas(poste);

  // Find maximum bending moment across all forces
  const momentoMaximoDaN_m = Math.max(
    ...forcas.map((f) => f.momentoFletorDaN_m),
    0,
  );

  const rupturaDAn_m = converterKnMParaDaN_m(poste.rupturaKnM);

  const verificacao = verificarPoste(momentoMaximoDaN_m, rupturaDAn_m);
  const margemPercent = calcularMargem(momentoMaximoDaN_m, rupturaDAn_m);

  return {
    areaS3M2: areas.areaS3M2,
    areaS4M2: areas.areaS4M2,
    momentoFletorKnM: momentoMaximoDaN_m / 100,
    momentoFletorDaN_m: momentoMaximoDaN_m,
    verificacao,
    margemPercent,
  };
}

/**
 * Comprehensive verification with multiple load cases
 */
export function verificarPosteCompleto(
  poste: PosteInput,
  forcasAplicadas: EsforcoResultante[],
): PosteVerificacao {
  const rupturaDAn_m = converterKnMParaDaN_m(poste.rupturaKnM);
  const momentoMaximoDaN_m = Math.max(
    ...forcasAplicadas.map((f) => f.momentoFletorDaN_m),
    0,
  );
  const margemPercent = calcularMargem(momentoMaximoDaN_m, rupturaDAn_m);
  const statusVerificacao = verificarPoste(momentoMaximoDaN_m, rupturaDAn_m);

  return {
    poste,
    esforcos: forcasAplicadas,
    momentoMaximoDaN_m,
    momentoRupturaDAn_m: rupturaDAn_m,
    statusVerificacao,
    margemPercent,
  };
}

/**
 * Pole selection from catalog
 * Returns first pole in catalog that can withstand the load
 */
export function selecionarPosteDeCatalogo(
  catalogo: PosteCatalogEntry[],
  momentoFletorDaN_m: number,
  margemSegurancaPercent: number = 10,
): PosteCatalogEntry | null {
  const limiteComMargem = 1 - margemSegurancaPercent / 100;

  for (const poste of catalogo) {
    const rupturaDAn_m = converterKnMParaDaN_m(poste.rupturaKnM);
    if (momentoFletorDaN_m <= rupturaDAn_m * limiteComMargem) {
      return poste;
    }
  }

  return null;
}
