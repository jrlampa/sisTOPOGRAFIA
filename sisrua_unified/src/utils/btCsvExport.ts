import { BtExportHistoryEntry } from '../types';
import { escapeCsvCell, downloadBlob } from './appUtils';

export const exportBtHistoryCsvContent = (entries: BtExportHistoryEntry[]): string => {
  const header = [
    'exportedAt', 'projectType', 'criticalPoleId', 'criticalAccumulatedClients',
    'criticalAccumulatedDemandKva', 'cqtScenario', 'cqtDmdi', 'cqtP31', 'cqtP32',
    'cqtK10QtMttr', 'cqtParityStatus', 'cqtParityPassed', 'cqtParityFailed',
    'btContextUrl', 'verifiedPoles', 'totalPoles', 'verifiedEdges', 'totalEdges',
    'verifiedTransformers', 'totalTransformers'
  ];
  const rows = entries.map((entry) => [
    entry.exportedAt, entry.projectType, entry.criticalPoleId,
    entry.criticalAccumulatedClients, entry.criticalAccumulatedDemandKva.toFixed(2),
    entry.cqt?.scenario ?? '', entry.cqt?.dmdi?.toFixed(6) ?? '',
    entry.cqt?.p31?.toFixed(6) ?? '', entry.cqt?.p32?.toFixed(6) ?? '',
    entry.cqt?.k10QtMttr?.toFixed(9) ?? '', entry.cqt?.parityStatus ?? '',
    entry.cqt?.parityPassed ?? '', entry.cqt?.parityFailed ?? '',
    entry.btContextUrl, entry.verifiedPoles ?? 0, entry.totalPoles ?? 0,
    entry.verifiedEdges ?? 0, entry.totalEdges ?? 0,
    entry.verifiedTransformers ?? 0, entry.totalTransformers ?? 0
  ]);
  return [header, ...rows].map((row) => row.map((v) => escapeCsvCell(v)).join(';')).join('\n');
};

export const downloadBtHistoryCsv = (entries: BtExportHistoryEntry[], projectName: string) => {
  downloadBlob(
    exportBtHistoryCsvContent(entries),
    'text/csv;charset=utf-8',
    `${projectName}_bt_history.csv`
  );
};

export const downloadBtHistoryJson = (
  entries: BtExportHistoryEntry[],
  projectName: string,
  projectType: string
) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    projectName,
    projectType,
    totalEntries: entries.length,
    latest: entries[0],
    entries
  };
  downloadBlob(JSON.stringify(payload, null, 2), 'application/json', `${projectName}_bt_history.json`);
};
