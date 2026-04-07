import { CQT_BASELINE_TARGETS } from '../constants/cqtBaselineTargets';
import { TRAFOS_Z_BASELINE } from '../constants/cqtLookupTables';
import { attachCqtSnapshotToBtContext } from '../services/cqtContextService';

describe('cqtContextService.attachCqtSnapshotToBtContext', () => {
    it('returns null when btContext is not an object', () => {
        expect(attachCqtSnapshotToBtContext(null)).toBeNull();
        expect(attachCqtSnapshotToBtContext('invalid')).toBeNull();
    });

    it('keeps original context when cqt inputs are missing', () => {
        const original = { projectType: 'ramais' };
        const enriched = attachCqtSnapshotToBtContext(original);
        expect(enriched).toEqual(original);
    });

    it('attaches partial snapshot when only DMDI inputs are provided', () => {
        const btContext = {
            projectType: 'ramais',
            cqtComputationInputs: {
                scenario: 'proj1',
                dmdi: {
                    clandestinoEnabled: true,
                    aa24DemandBase: 200,
                    sumClientsX: 70,
                    ab35LookupDmdi: 2.84
                }
            }
        };

        const enriched = attachCqtSnapshotToBtContext(btContext) as Record<string, any>;
        expect(enriched.cqtSnapshot).toBeDefined();
        expect(enriched.cqtSnapshot.scenario).toBe('proj1');
        expect(enriched.cqtSnapshot.dmdi).toEqual({ dmdi: 2.84, source: 'lookup-ab35' });
        expect(enriched.cqtSnapshot.geral).toBeUndefined();
        expect(enriched.cqtSnapshot.db).toBeUndefined();
    });

    it('attaches cqt snapshot when complete inputs are provided', () => {
        const btContext = {
            projectType: 'ramais',
            cqtComputationInputs: {
                scenario: 'atual',
                dmdi: {
                    clandestinoEnabled: true,
                    aa24DemandBase: 206.9999999999999,
                    sumClientsX: 73,
                    ab35LookupDmdi: CQT_BASELINE_TARGETS.ramal.ab35LookupDmdi
                },
                geral: {
                    pontoRamal: 'RAMAL',
                    qtMttr: CQT_BASELINE_TARGETS.db.k10QtMttr,
                    esqCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto },
                    dirCqtByPonto: { RAMAL: CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto }
                },
                db: {
                    trAtual: CQT_BASELINE_TARGETS.db.k6TrAtual,
                    demAtual: CQT_BASELINE_TARGETS.db.k7DemAtual,
                    qtMt: CQT_BASELINE_TARGETS.db.k10QtMttr - CQT_BASELINE_TARGETS.db.k8QtTr,
                    trafosZ: TRAFOS_Z_BASELINE
                }
            }
        };

        const enriched = attachCqtSnapshotToBtContext(btContext);
        expect(enriched).not.toBeNull();
        expect(enriched).toHaveProperty('cqtSnapshot');

        const snapshot = (enriched as Record<string, any>).cqtSnapshot;
        expect(snapshot.scenario).toBe('atual');
        expect(snapshot.dmdi.dmdi).toBeCloseTo(CQT_BASELINE_TARGETS.ramal.aa30Dmdi, 12);
        expect(snapshot.geral.p31CqtNoPonto).toBeCloseTo(CQT_BASELINE_TARGETS.geralAtual.p31CqtNoPonto, 12);
        expect(snapshot.geral.p32CqtNoPonto).toBeCloseTo(CQT_BASELINE_TARGETS.geralAtual.p32CqtNoPonto, 12);
        expect(snapshot.db.k8QtTr).toBeCloseTo(CQT_BASELINE_TARGETS.db.k8QtTr, 12);
        expect(snapshot.db.k10QtMttr).toBeCloseTo(CQT_BASELINE_TARGETS.db.k10QtMttr, 12);
        expect(typeof snapshot.generatedAt).toBe('string');
    });

    it('uses scenario lookup fallback when db.trafosZ is omitted', () => {
        const btContext = {
            projectType: 'ramais',
            cqtComputationInputs: {
                scenario: 'proj2',
                db: {
                    trAtual: 225,
                    demAtual: 101.95599999999999,
                    qtMt: 0.018299999999999997
                }
            }
        };

        const enriched = attachCqtSnapshotToBtContext(btContext) as Record<string, any>;
        expect(enriched.cqtSnapshot).toBeDefined();
        expect(enriched.cqtSnapshot.scenario).toBe('proj2');
        expect(enriched.cqtSnapshot.db.k8QtTr).toBeCloseTo(CQT_BASELINE_TARGETS.db.k8QtTr, 12);
        expect(enriched.cqtSnapshot.db.k10QtMttr).toBeCloseTo(CQT_BASELINE_TARGETS.db.k10QtMttr, 12);
    });
});
