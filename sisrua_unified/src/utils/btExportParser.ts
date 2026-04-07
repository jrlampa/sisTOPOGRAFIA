import { BtExportSummary, BtExportHistoryEntry, BtProjectType } from '../types';

/**
 * Parses a raw BT context response into a typed BtExportSummary.
 * Returns null if the context does not contain a valid critical pole.
 */
export function parseBtExportSummary(
  btContextUrl: string,
  btContext: Record<string, unknown>
): BtExportSummary | null {
  const criticalPoleRaw = btContext.criticalPole;
  if (!criticalPoleRaw || typeof criticalPoleRaw !== 'object') return null;
  const criticalPole = criticalPoleRaw as Record<string, unknown>;
  const poleId = typeof criticalPole.poleId === 'string' ? criticalPole.poleId : '';
  if (!poleId) return null;

  const accumulatedClients = typeof criticalPole.accumulatedClients === 'number' ? criticalPole.accumulatedClients : 0;
  const accumulatedDemandKva = typeof criticalPole.accumulatedDemandKva === 'number' ? criticalPole.accumulatedDemandKva : 0;
  const verifiedPoles = typeof btContext.verifiedPoles === 'number' ? btContext.verifiedPoles : 0;
  const totalPoles = typeof btContext.totalPoles === 'number' ? btContext.totalPoles : 0;
  const verifiedEdges = typeof btContext.verifiedEdges === 'number' ? btContext.verifiedEdges : 0;
  const totalEdges = typeof btContext.totalEdges === 'number' ? btContext.totalEdges : 0;
  const verifiedTransformers = typeof btContext.verifiedTransformers === 'number' ? btContext.verifiedTransformers : 0;
  const totalTransformers = typeof btContext.totalTransformers === 'number' ? btContext.totalTransformers : 0;

  const cqtSnapshotRaw = btContext.cqtSnapshot;
  const cqtSnapshot = cqtSnapshotRaw && typeof cqtSnapshotRaw === 'object' ? cqtSnapshotRaw as Record<string, unknown> : null;
  const cqtGeral = cqtSnapshot?.geral && typeof cqtSnapshot.geral === 'object' ? cqtSnapshot.geral as Record<string, unknown> : null;
  const cqtDb = cqtSnapshot?.db && typeof cqtSnapshot.db === 'object' ? cqtSnapshot.db as Record<string, unknown> : null;
  const cqtDmdi = cqtSnapshot?.dmdi && typeof cqtSnapshot.dmdi === 'object' ? cqtSnapshot.dmdi as Record<string, unknown> : null;
  const cqtParity = cqtSnapshot?.parity && typeof cqtSnapshot.parity === 'object' ? cqtSnapshot.parity as Record<string, unknown> : null;
  const cqtSummaryFromSnapshot = cqtSnapshot ? {
    scenario: typeof cqtSnapshot.scenario === 'string' ? cqtSnapshot.scenario as 'atual' | 'proj1' | 'proj2' : undefined,
    dmdi: typeof cqtDmdi?.dmdi === 'number' ? cqtDmdi.dmdi : undefined,
    p31: typeof cqtGeral?.p31CqtNoPonto === 'number' ? cqtGeral.p31CqtNoPonto : undefined,
    p32: typeof cqtGeral?.p32CqtNoPonto === 'number' ? cqtGeral.p32CqtNoPonto : undefined,
    k10QtMttr: typeof cqtDb?.k10QtMttr === 'number' ? cqtDb.k10QtMttr : undefined,
    parityStatus: typeof cqtParity?.referenceStatus === 'string' ? cqtParity.referenceStatus as 'complete' | 'partial' | 'missing' : undefined,
    parityPassed: typeof cqtParity?.passed === 'number' ? cqtParity.passed : undefined,
    parityFailed: typeof cqtParity?.failed === 'number' ? cqtParity.failed : undefined
  } : undefined;
  const cqtSummary = cqtSnapshot ? cqtSummaryFromSnapshot : undefined;

  return {
    btContextUrl, criticalPoleId: poleId, criticalAccumulatedClients: accumulatedClients,
    criticalAccumulatedDemandKva: accumulatedDemandKva, cqt: cqtSummary,
    verifiedPoles, totalPoles, verifiedEdges, totalEdges, verifiedTransformers, totalTransformers
  };
}

export function buildBtHistoryEntry(
  summary: BtExportSummary,
  projectType: BtProjectType,
  cqtSummaryRaw: unknown,
  existing: BtExportSummary | null
): { summary: BtExportSummary; historyEntry: BtExportHistoryEntry } {
  // Merge any top-level cqtSummary from response if snapshot was absent
  const cqtSummaryFromResponse = cqtSummaryRaw && typeof cqtSummaryRaw === 'object' ? cqtSummaryRaw as Record<string, unknown> : null;
  const mergedCqt = summary.cqt ?? (cqtSummaryFromResponse ? {
    scenario: typeof cqtSummaryFromResponse.scenario === 'string' ? cqtSummaryFromResponse.scenario as 'atual' | 'proj1' | 'proj2' : undefined,
    dmdi: typeof cqtSummaryFromResponse.dmdi === 'number' ? cqtSummaryFromResponse.dmdi : undefined,
    p31: typeof cqtSummaryFromResponse.p31 === 'number' ? cqtSummaryFromResponse.p31 : undefined,
    p32: typeof cqtSummaryFromResponse.p32 === 'number' ? cqtSummaryFromResponse.p32 : undefined,
    k10QtMttr: typeof cqtSummaryFromResponse.k10QtMttr === 'number' ? cqtSummaryFromResponse.k10QtMttr : undefined,
    parityStatus: typeof cqtSummaryFromResponse.parityStatus === 'string' ? cqtSummaryFromResponse.parityStatus as 'complete' | 'partial' | 'missing' : undefined,
    parityPassed: typeof cqtSummaryFromResponse.parityPassed === 'number' ? cqtSummaryFromResponse.parityPassed : undefined,
    parityFailed: typeof cqtSummaryFromResponse.parityFailed === 'number' ? cqtSummaryFromResponse.parityFailed : undefined
  } : existing?.cqt);
  const finalSummary: BtExportSummary = { ...summary, cqt: mergedCqt };
  const historyEntry: BtExportHistoryEntry = {
    ...finalSummary,
    exportedAt: new Date().toISOString(),
    projectType
  };
  return { summary: finalSummary, historyEntry };
}
