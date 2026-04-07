import { TrafosZRow } from '../services/cqtEngine.js';

export const TRAFOS_Z_BASELINE: TrafosZRow[] = [
    { trafoKva: 30, qtFactor: 0.035 },
    { trafoKva: 45, qtFactor: 0.035 },
    { trafoKva: 75, qtFactor: 0.035 },
    { trafoKva: 112.5, qtFactor: 0.035 },
    { trafoKva: 150, qtFactor: 0.035 },
    { trafoKva: 225, qtFactor: 0.035 },
    { trafoKva: 300, qtFactor: 0.035 }
];

export const getTrafosZByScenario = (
    _scenario: 'atual' | 'proj1' | 'proj2' = 'atual'
): TrafosZRow[] => {
    // Workbook atual usa mesma curva de fator para os cenários; manter função para
    // facilitar cenários divergentes sem quebrar contrato.
    return TRAFOS_Z_BASELINE;
};
