/**
 * Mechanical Calculation Types — CACUIA Port
 *
 * Structures for pole load calculations, conductor forces, and structural verification.
 * Based on: C:\myworld\EXCEL\LEGADO\CACUIA - RUA PEDREIRA...xlsm
 */

export interface PosteInput {
  alturaM: number; // Height (m)
  diametroTopoMm: number; // Top diameter (mm)
  diametroBaseMm: number; // Base diameter (mm)
  rupturaKnM: number; // Bending rupture (kN·m)
  materialTipo: "CIMENTO" | "ACO" | "MADEIRA";
}

export interface PosteOutput {
  areaS3M2: number; // Cylindrical area at top (m²)
  areaS4M2: number; // Cylindrical area at base (m²)
  momentoFletorKnM: number; // Bending moment at base (kN·m)
  momentoFletorDaN_m: number; // Bending moment (daN·m) for verification
  verificacao: "OK" | "EXCEDE" | "MARGEM_BAIXA";
  margemPercent?: number; // Safety margin (%)
}

export interface ConductorForceInput {
  codigo: string; // e.g. "CA 3/0", "CAA 477 MCM"
  vaoM: number; // Span (m)
  pesoKgPerM: number; // Weight (kg/m)
  diametroMm: number; // Diameter (mm)
  tipoRede: "PRIMARIO" | "SECUNDARIO" | "ESTRUTURA" | "PARA_RAIO" | "CABO_ACO";
  anguloGraus: number; // Angle of application (degrees)
}

export interface VentoInput {
  velocidadeMs: number; // Wind velocity (m/s)
  direcaoGraus: number; // Direction (degrees, 0-360)
  coeficienteArrasto: number; // Drag coefficient (Ca) from tipo_rede
  alturaMediaM: number; // Average height of conductor (m)
}

export interface ForceOutput {
  forcaVentoN: number; // Wind force on conductor (N)
  pesoCondutorN: number; // Weight force (N)
  componenteFxN: number; // Horizontal component (N)
  componenteFyN: number; // Vertical component (N)
}

export interface EsforcoResultante {
  forcaResultanteDaN: number; // Resultant force (daN)
  anguloResultanteGraus: number; // Angle of resultant (degrees)
  momentoFletorDaN_m: number; // Bending moment (daN·m)
}

export interface PosteVerificacao {
  poste: PosteInput;
  esforcos: EsforcoResultante[];
  momentoMaximoDaN_m: number;
  momentoRupturaDAn_m: number;
  statusVerificacao: "OK" | "EXCEDE" | "MARGEM_BAIXA";
  margemPercent: number;
}

export interface TipoConductorParams {
  codigoCondutrorLike: string;
  diametroMm: number;
  pesoKgPerM: number;
}

export interface TipoRedeParams {
  tipo:
    | "PRIMARIO"
    | "SECUNDARIO"
    | "ESTRUTURA"
    | "ISOLADOR"
    | "CABO_ACO"
    | "PARA_RAIO";
  coeficienteArrasto: number;
}

export interface PosteCatalogEntry {
  modelo: string; // e.g. "DT 11m/300", "DT 12m/600"
  alturaM: number;
  diametroTopoMm: number;
  diametroBaseMm: number;
  rupturaKnM: number;
  rupturaKnMEmDaNm?: number; // Conversion for compatibility
  pesoKg: number;
  materialTipo: "CIMENTO" | "ACO" | "MADEIRA";
}
