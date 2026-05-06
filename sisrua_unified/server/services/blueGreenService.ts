/**
 * blueGreenService.ts — Blue/Green Deployment (23 [T1])
 *
 * Gerencia a estratégia de deploy Blue/Green:
 * - Registro de versões Blue e Green
 * - Controle de tráfego (qual slot está ativo)
 * - Smoke tests gates antes de switch
 * - Rollback imediato para slot anterior
 * - Histórico de switches
 */

import { logger } from "../utils/logger.js";

export type SlotColor = "blue" | "green";
export type SlotStatus = "ready" | "active" | "standby" | "error" | "draining";

export interface Slot {
  color: SlotColor;
  version: string;
  gitCommit: string;
  deployedAt: string;
  status: SlotStatus;
  healthUrl?: string;
  smokeTestsPassed: boolean;
}

export interface SwitchEvent {
  id: string;
  from: SlotColor;
  to: SlotColor;
  ts: string;
  approvedBy: string;
  motivo: string;
  sucesso: boolean;
  erro?: string;
}

let blue: Slot | null = null;
let green: Slot | null = null;
let activeSlot: SlotColor = "blue";
const switchHistory: SwitchEvent[] = [];
let switchSeq = 1;

export class BlueGreenService {
  static deploySlot(
    color: SlotColor,
    params: { version: string; gitCommit: string; healthUrl?: string }
  ): Slot {
    const slot: Slot = {
      color,
      version: params.version,
      gitCommit: params.gitCommit,
      deployedAt: new Date().toISOString(),
      status: "ready",
      healthUrl: params.healthUrl,
      smokeTestsPassed: false,
    };
    if (color === "blue") blue = slot;
    else green = slot;
    logger.info(`[BlueGreen] Deploy no slot ${color}: v${params.version}`);
    return slot;
  }

  static getSmokeGate(color: SlotColor, passed: boolean): Slot {
    const slot = color === "blue" ? blue : green;
    if (!slot) throw new Error(`Slot ${color} não deployado`);
    slot.smokeTestsPassed = passed;
    slot.status = passed ? "standby" : "error";
    logger.info(`[BlueGreen] Smoke tests slot ${color}: ${passed ? "PASS" : "FAIL"}`);
    return { ...slot };
  }

  static switch(params: {
    to: SlotColor;
    approvedBy: string;
    motivo: string;
  }): SwitchEvent {
    const destino = params.to === "blue" ? blue : green;
    if (!destino) {
      const ev: SwitchEvent = {
        id: `sw-${switchSeq++}`,
        from: activeSlot,
        to: params.to,
        ts: new Date().toISOString(),
        approvedBy: params.approvedBy,
        motivo: params.motivo,
        sucesso: false,
        erro: `Slot ${params.to} não deployado`,
      };
      switchHistory.push(ev);
      return ev;
    }
    if (!destino.smokeTestsPassed) {
      const ev: SwitchEvent = {
        id: `sw-${switchSeq++}`,
        from: activeSlot,
        to: params.to,
        ts: new Date().toISOString(),
        approvedBy: params.approvedBy,
        motivo: params.motivo,
        sucesso: false,
        erro: `Slot ${params.to} não passou nos smoke tests`,
      };
      switchHistory.push(ev);
      return ev;
    }

    // Executa o switch
    const anterior = activeSlot;
    const slotAnterior = anterior === "blue" ? blue : green;
    if (slotAnterior) slotAnterior.status = "standby";

    destino.status = "active";
    activeSlot = params.to;

    const ev: SwitchEvent = {
      id: `sw-${switchSeq++}`,
      from: anterior,
      to: params.to,
      ts: new Date().toISOString(),
      approvedBy: params.approvedBy,
      motivo: params.motivo,
      sucesso: true,
    };
    switchHistory.push(ev);
    logger.info(`[BlueGreen] Switch ${anterior} → ${params.to} por ${params.approvedBy}`);
    return ev;
  }

  static rollback(approvedBy: string): SwitchEvent {
    // Encontra o switch bem-sucedido mais recente e inverte
    const ultimoSwitch = [...switchHistory].reverse().find((s) => s.sucesso);
    if (!ultimoSwitch) {
      return BlueGreenService.switch({
        to: activeSlot === "blue" ? "green" : "blue",
        approvedBy,
        motivo: "Rollback (sem histórico de switch)",
      });
    }
    return BlueGreenService.switch({
      to: ultimoSwitch.from,
      approvedBy,
      motivo: `Rollback para ${ultimoSwitch.from} (revertendo ${ultimoSwitch.id})`,
    });
  }

  static getState(): {
    activeSlot: SlotColor;
    blue: Slot | null;
    green: Slot | null;
  } {
    return { activeSlot, blue, green };
  }

  static getSwitchHistory(): SwitchEvent[] {
    return [...switchHistory];
  }

  /** Reset para testes. */
  static _reset(): void {
    blue = null;
    green = null;
    activeSlot = "blue";
    switchHistory.length = 0;
    switchSeq = 1;
  }
}
