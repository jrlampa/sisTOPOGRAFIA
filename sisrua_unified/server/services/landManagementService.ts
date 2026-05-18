/**
 * LandManagementService.ts — Orquestração de Gestão Fundiária (T2-107).
 * 
 * Integra lógicas de Georreferenciamento (INCRA) e Documentação (Memoriais/Anuência).
 */

import { BtTopology } from "./bt/btDerivedTypes.js";
import { ServidoesFundiariosService } from "./servidoesFundiariosService.js";
import { ServidoesFundiariasIncraService } from "./servidoesFundiariasIncraService.js";
import { getEngineeringStandard } from "../standards/index.js";

export interface LandConflict {
  poleId: string;
  type: "property_intersection" | "buffer_violation";
  propertyId?: string;
  propertyName?: string;
  status: "pending" | "regularized";
}

export class LandManagementService {
  /**
   * Escaneia a topologia em busca de conflitos fundiários (T2-107).
   * Simula a intersecção com base em uma grade de propriedades virtuais.
   */
  static detectEasementConflicts(topology: BtTopology): LandConflict[] {
    const conflicts: LandConflict[] = [];
    
    // Heurística de simulação: 
    // Postes com latitude "redonda" (ex: milésimos pares) são considerados em área privada.
    for (const pole of topology.poles) {
      const isPrivate = Math.floor(pole.lat * 1000) % 2 === 0;
      
      if (isPrivate) {
        conflicts.push({
          poleId: pole.id,
          type: "property_intersection",
          propertyName: `Propriedade Rural #${Math.abs(Math.floor(pole.lng * 100))}`,
          status: "pending"
        });
      }
    }

    return conflicts;
  }

  /**
   * Cria um processo formal de servidão no INCRA/SIGEF a partir dos conflitos detectados.
   */
  static createProcessFromConflicts(tenantId: string, projetoId: string, topology: BtTopology): any {
    const conflicts = this.detectEasementConflicts(topology);
    if (conflicts.length === 0) return { message: "Nenhum conflito detectado." };

    const standard = getEngineeringStandard();

    // 1. Cria processo técnico (INCRA)
    const procIncra = ServidoesFundiariasIncraService.criarProcesso({
      tenantId,
      titulo: `Processo Fundiário - Projeto ${projetoId}`,
      tipoServidao: "eletrica",
      matriculaImovelServiente: "MAT-999-SIMULADO",
      municipio: "Rio de Janeiro",
      uf: "RJ",
      responsavelTecnico: "Engenheiro sisRUA",
    });

    // 2. Adiciona vértices (baseado nos postes em conflito)
    conflicts.forEach((c, idx) => {
      const pole = topology.poles.find(p => p.id === c.poleId);
      if (pole) {
        ServidoesFundiariasIncraService.adicionarVertice(procIncra.id, {
          codigo: `V-${idx + 1}`,
          latitude: pole.lat,
          longitude: pole.lng,
          descricaoLocalizacao: `Poste ${pole.id}`,
          precisaoM: 0.1,
          metodoLevantamento: "GNSS_RTK"
        });
      }
    });

    // 3. Cria processo documental
    const procDoc = ServidoesFundiariosService.criarProcesso({
      nome: `Documentação Servidão - ${projetoId}`,
      tenantId,
      projetoId,
      concessionaria: "Light S.A.",
      tensaoKv: standard.constants.BT_LINE_REFERENCE_VOLTAGE_V / 1000 // BT
    });

    return {
      incraProcessId: procIncra.id,
      documentProcessId: procDoc.id,
      conflictsCount: conflicts.length
    };
  }
}
