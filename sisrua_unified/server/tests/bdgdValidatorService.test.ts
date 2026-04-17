import {
    validateBdgdLayer,
    buildBdgdValidationReport,
    isBdgdConformant,
    type BdgdRecord,
} from '../services/bdgdValidatorService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const GEO_POINT = { type: 'Point', coordinates: [-43.18, -22.9] };
const GEO_LINE  = { type: 'LineString', coordinates: [[-43.18, -22.9], [-43.17, -22.91]] };

const validSegbt: BdgdRecord = {
    COD_ID:     'SEG-BT-001',
    DES_CONC:   'LIGHT',
    FAS_CON:    'ABCN',
    COMP:       120.5,
    TIP_CONDUT: 1,
    MAT_CONDU:  1,
    geometry:   GEO_LINE,
};

const validPonnot: BdgdRecord = {
    COD_ID:   'POS-001',
    DES_CONC: 'LIGHT',
    MAT_ESTR: 1,
    ALT_ESTR: 11,
    geometry: GEO_POINT,
};

const validEqtrat: BdgdRecord = {
    COD_ID:   'TRF-001',
    DES_CONC: 'LIGHT',
    POT_NOM:  225,
    TEN_PRI:  13.8,
    TEN_SEC:  220,
    TIP_TRAF: 2,
    geometry: GEO_POINT,
};

const validRambt: BdgdRecord = {
    COD_ID:     'RAM-001',
    DES_CONC:   'LIGHT',
    FAS_CON:    'AN',
    COMP:       15.0,
    TIP_CONDUT: 1,
    geometry:   GEO_LINE,
};

// ─── SEGBT ────────────────────────────────────────────────────────────────────

describe('bdgdValidatorService – SEGBT', () => {
    it('registro válido → sem issues', () => {
        const report = validateBdgdLayer('SEGBT', [validSegbt]);
        expect(report.conformant).toBe(true);
        expect(report.issues).toHaveLength(0);
        expect(report.validRecords).toBe(1);
    });

    it('R1 – campo obrigatório ausente gera erro', () => {
        const rec: BdgdRecord = { ...validSegbt };
        delete rec['COD_ID'];
        const report = validateBdgdLayer('SEGBT', [rec]);
        expect(report.conformant).toBe(false);
        const issue = report.issues.find((i) => i.field === 'COD_ID' && i.rule === 'R1');
        expect(issue).toBeDefined();
        expect(issue?.severity).toBe('error');
    });

    it('R3 – FAS_CON inválido gera erro', () => {
        const rec: BdgdRecord = { ...validSegbt, FAS_CON: 'X' };
        const report = validateBdgdLayer('SEGBT', [rec]);
        const issue = report.issues.find((i) => i.field === 'FAS_CON' && i.rule === 'R3');
        expect(issue).toBeDefined();
    });

    it('R3 – TIP_CONDUT inválido (código 99) gera erro', () => {
        const rec: BdgdRecord = { ...validSegbt, TIP_CONDUT: 99 };
        const report = validateBdgdLayer('SEGBT', [rec]);
        const issue = report.issues.find((i) => i.field === 'TIP_CONDUT' && i.rule === 'R3');
        expect(issue).toBeDefined();
    });

    it('R4 – COMP negativo gera erro', () => {
        const rec: BdgdRecord = { ...validSegbt, COMP: -5 };
        const report = validateBdgdLayer('SEGBT', [rec]);
        const issue = report.issues.find((i) => i.field === 'COMP' && i.rule === 'R4');
        expect(issue).toBeDefined();
    });

    it('R5 – COD_ID duplicado gera erro', () => {
        const report = validateBdgdLayer('SEGBT', [validSegbt, { ...validSegbt }]);
        const dup = report.issues.filter((i) => i.rule === 'R5');
        expect(dup).toHaveLength(1);
        expect(dup[0].codId).toBe('SEG-BT-001');
    });

    it('R6 – geometria ausente gera erro', () => {
        const rec: BdgdRecord = { ...validSegbt, geometry: { tipo: 'invalido' } };
        const report = validateBdgdLayer('SEGBT', [rec]);
        const issue = report.issues.find((i) => i.field === 'geometry' && i.rule === 'R6');
        expect(issue).toBeDefined();
    });

    it('R2 – DES_CONC com mais de 10 chars gera erro', () => {
        const rec: BdgdRecord = { ...validSegbt, DES_CONC: 'CONCESSIONARIA_LONGA' };
        const report = validateBdgdLayer('SEGBT', [rec]);
        const issue = report.issues.find((i) => i.field === 'DES_CONC' && i.rule === 'R2');
        expect(issue).toBeDefined();
    });
});

// ─── PONNOT ───────────────────────────────────────────────────────────────────

describe('bdgdValidatorService – PONNOT', () => {
    it('registro válido → sem issues', () => {
        const report = validateBdgdLayer('PONNOT', [validPonnot]);
        expect(report.conformant).toBe(true);
        expect(report.issues).toHaveLength(0);
    });

    it('R3 – MAT_ESTR código 5 (inválido) gera erro', () => {
        const rec: BdgdRecord = { ...validPonnot, MAT_ESTR: 5 };
        const report = validateBdgdLayer('PONNOT', [rec]);
        const issue = report.issues.find((i) => i.field === 'MAT_ESTR' && i.rule === 'R3');
        expect(issue).toBeDefined();
    });
});

// ─── EQTRAT ───────────────────────────────────────────────────────────────────

describe('bdgdValidatorService – EQTRAT', () => {
    it('registro válido → sem issues', () => {
        const report = validateBdgdLayer('EQTRAT', [validEqtrat]);
        expect(report.conformant).toBe(true);
        expect(report.issues).toHaveLength(0);
    });

    it('R4 – POT_NOM zero gera erro', () => {
        const rec: BdgdRecord = { ...validEqtrat, POT_NOM: 0 };
        const report = validateBdgdLayer('EQTRAT', [rec]);
        const issue = report.issues.find((i) => i.field === 'POT_NOM' && i.rule === 'R4');
        expect(issue).toBeDefined();
    });
});

// ─── RAMBT ────────────────────────────────────────────────────────────────────

describe('bdgdValidatorService – RAMBT', () => {
    it('registro válido → sem issues', () => {
        const report = validateBdgdLayer('RAMBT', [validRambt]);
        expect(report.conformant).toBe(true);
        expect(report.issues).toHaveLength(0);
    });
});

// ─── Camada desconhecida ──────────────────────────────────────────────────────

describe('bdgdValidatorService – camada desconhecida', () => {
    it('retorna conformant=false com issue descritivo', () => {
        const report = validateBdgdLayer('XYZBT', [{ COD_ID: '1' }]);
        expect(report.conformant).toBe(false);
        expect(report.issues[0].message).toContain('XYZBT');
    });
});

// ─── buildBdgdValidationReport ────────────────────────────────────────────────

describe('buildBdgdValidationReport', () => {
    it('suite totalmente válida → conformant=true', () => {
        const report = buildBdgdValidationReport({
            layers: {
                SEGBT:  [validSegbt],
                PONNOT: [validPonnot],
                EQTRAT: [validEqtrat],
                RAMBT:  [validRambt],
            },
        });
        expect(report.conformant).toBe(true);
        expect(isBdgdConformant(report)).toBe(true);
        expect(report.totals.layersChecked).toBe(4);
        expect(report.totals.layersConformant).toBe(4);
        expect(report.totals.totalRecords).toBe(4);
        expect(report.totals.errors).toBe(0);
        expect(report.aneelSpec).toContain('PRODIST');
    });

    it('com um erro em SEGBT → report conformant=false', () => {
        const broken: BdgdRecord = { ...validSegbt, FAS_CON: 'INVALIDO' };
        const report = buildBdgdValidationReport({
            layers: { SEGBT: [broken] },
        });
        expect(report.conformant).toBe(false);
        expect(isBdgdConformant(report)).toBe(false);
        expect(report.totals.errors).toBeGreaterThan(0);
    });

    it('retorna 422 status hint via totals.errors > 0 quando há erros', () => {
        const broken: BdgdRecord = { ...validSegbt };
        delete broken['geometry'];
        const report = buildBdgdValidationReport({ layers: { SEGBT: [broken] } });
        expect(report.totals.errors).toBeGreaterThan(0);
    });

    it('generatedAt é um ISO timestamp válido', () => {
        const report = buildBdgdValidationReport({ layers: { SEGBT: [validSegbt] } });
        expect(() => new Date(report.generatedAt).toISOString()).not.toThrow();
    });
});
