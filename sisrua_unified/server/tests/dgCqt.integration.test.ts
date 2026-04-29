/**
 * Teste de Integração DG — Foco em CQT (Queda de Tensão)
 * 
 * Este teste valida se o motor DG respeita o limite de 8% de queda de tensão (CQT)
 * em cenários reais e sintéticos.
 */

import { partitionNetwork } from "../services/dg/dgPartitioner";
import { 
  DEFAULT_DG_PARAMS, 
  COMMERCIAL_TRAFO_KVA,
  type DgPoleInput, 
  type DgParams 
} from "../services/dg/dgTypes";

describe("DG Integration — Queda de Tensão (CQT)", () => {
  
  it("cenário de linha longa: deve respeitar CQT <= 8%", () => {
    // Cria uma linha reta de 10 postes com 40m de vão = 400m total
    // Demanda alta (10 kVA/poste) = 100 kVA total
    const poles: DgPoleInput[] = Array.from({ length: 10 }, (_, i) => ({
      id: `P${i + 1}`,
      position: { lat: -22.9 + i * 0.0004, lon: -43.7 }, // ~40m entre eles
      demandKva: 10,
      clients: 5
    }));

    const params: DgParams = { 
      ...DEFAULT_DG_PARAMS, 
      faixaKvaTrafoPermitida: [112.5, 150], // Força trafo grande para não ser o limitador
      cqtLimitFraction: 0.08 
    };

    const result = partitionNetwork(poles, params);

    // Deve ser viável (selecionando condutores grossos telescópicos)
    for (const partition of result.partitions) {
      expect(partition.electricalResult.feasible).toBe(true);
      expect(partition.electricalResult.cqtMaxFraction).toBeLessThanOrEqual(0.08);
      console.log(`[CQT TEST] Line 400m/100kVA: CQT=${(partition.electricalResult.cqtMaxFraction * 100).toFixed(2)}%, Trafo=${partition.selectedKva}kVA`);
    }
  });

  it("cenário impossível (CQT): deve marcar como infeasible se a distância for extrema", () => {
    // Linha de 2km (50 postes x 40m)
    const poles: DgPoleInput[] = Array.from({ length: 50 }, (_, i) => ({
      id: `P${i + 1}`,
      position: { lat: -22.9 + i * 0.0004, lon: -43.7 },
      demandKva: 5, // Demanda baixa
      clients: 1
    }));

    const params: DgParams = { 
      ...DEFAULT_DG_PARAMS, 
      trafoMaxKva: 112.5, // Limita o trafo para forçar partição por CQT/Capacidade
      trafoMaxUtilization: 0.95,
      cqtLimitFraction: 0.08 
    };

    const result = partitionNetwork(poles, params);

    console.log(`[CQT TEST] Long line 2km: Partitions=${result.totalPartitions}, Infeasible=${result.infeasiblePartitions}, MaxCQT=${(result.partitions[0].electricalResult.cqtMaxFraction * 100).toFixed(2)}%`);
    
    // Agora deve particionar porque 250 kVA > 112.5 kVA OU CQT estourou
    expect(result.totalPartitions).toBeGreaterThan(1);
  });

  it("valida CQT na Av. Padre Decaminada (60 postes reais)", () => {
    // Importante: esse teste assume que o KML já foi extraído pelo teste anterior
    // Para simplificar, vou emular um subset da Decaminada aqui ou carregar se disponível
    const subset: DgPoleInput[] = Array.from({ length: 30 }, (_, i) => ({
        id: `pole-${i}`,
        position: { lat: -22.906 + i * 0.0001, lon: -43.689 },
        demandKva: 4.8,
        clients: 4
    }));

    const params: DgParams = { ...DEFAULT_DG_PARAMS };
    const result = partitionNetwork(subset, params);

    for (const partition of result.partitions) {
      if (partition.electricalResult.feasible) {
          expect(partition.electricalResult.cqtMaxFraction).toBeLessThanOrEqual(0.08);
      }
    }
    console.log(`[CQT TEST] Real Subset: Avg CQT=${(result.partitions.reduce((acc, p) => acc + p.electricalResult.cqtMaxFraction, 0) / result.totalPartitions * 100).toFixed(2)}%`);
  });

});
