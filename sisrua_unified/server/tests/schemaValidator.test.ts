import path from 'path';
import { validateAgainstSchema } from '../utils/schemaValidator';

const SCHEMA_DIR = path.resolve(__dirname, '../../schemas');

const validDxfRequest = {
    lat: -22.9,
    lon: -43.2,
    radius: 500,
    mode: 'circle' as const,
};

const validBtRequest = {
    transformer: { id: 'tr1', rootNodeId: 'n1', kva: 75, zPercent: 3.5, qtMt: 10 },
    nodes: [{ id: 'n1', load: { localDemandKva: 5 } }],
    edges: [{ fromNodeId: 'n1', toNodeId: 'n2', conductorId: 'cu16', lengthMeters: 50 }],
    phase: 'MONO' as const,
};

describe('validateAgainstSchema – DXF request schema', () => {
    const schema = path.join(SCHEMA_DIR, 'dxf_request.schema.json');

    it('accepts a minimal valid request', () => {
        const { valid, errors } = validateAgainstSchema(validDxfRequest, schema);
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('accepts a full request with all optional fields', () => {
        const full = {
            ...validDxfRequest,
            projection: 'SIRGAS2000',
            contourRenderMode: 'spline',
            polygon: null,
            layers: null,
            btContext: null,
        };
        const { valid, errors } = validateAgainstSchema(full, schema);
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('accepts polygon mode with coordinate array', () => {
        const req = {
            ...validDxfRequest,
            mode: 'polygon',
            polygon: [[-43.2, -22.9], [-43.1, -22.9], [-43.1, -22.8], [-43.2, -22.8]],
        };
        const { valid, errors } = validateAgainstSchema(req, schema);
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('rejects missing required field "mode"', () => {
        const bad = { lat: -22.9, lon: -43.2, radius: 500 };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('mode'))).toBe(true);
    });

    it('rejects invalid enum value for mode', () => {
        const bad = { ...validDxfRequest, mode: 'triangle' };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('mode'))).toBe(true);
    });

    it('rejects lat out of range', () => {
        const bad = { ...validDxfRequest, lat: -95 };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('lat') || e.includes('minimum'))).toBe(true);
    });

    it('rejects radius below minimum', () => {
        const bad = { ...validDxfRequest, radius: 5 };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('radius') || e.includes('minimum'))).toBe(true);
    });

    it('rejects radius above maximum', () => {
        const bad = { ...validDxfRequest, radius: 9999 };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('radius') || e.includes('maximum'))).toBe(true);
    });

    it('rejects projection with invalid characters', () => {
        const bad = { ...validDxfRequest, projection: 'BAD PROJ!' };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('projection') || e.includes('pattern'))).toBe(true);
    });

    it('accepts btContext with projectType', () => {
        const req = {
            ...validDxfRequest,
            btContext: { projectType: 'ramais' },
        };
        const { valid, errors } = validateAgainstSchema(req, schema);
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('rejects btContext with invalid projectType', () => {
        const req = {
            ...validDxfRequest,
            btContext: { projectType: 'unknown_type' },
        };
        const { valid, errors } = validateAgainstSchema(req, schema);
        expect(valid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
    });
});

describe('validateAgainstSchema – DXF response schema', () => {
    const schema = path.join(SCHEMA_DIR, 'dxf_response.schema.json');

    it('accepts a success message', () => {
        const { valid, errors } = validateAgainstSchema(
            { status: 'success', message: 'Done' },
            schema,
        );
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('accepts an error message', () => {
        const { valid } = validateAgainstSchema(
            { status: 'error', message: 'Something went wrong' },
            schema,
        );
        expect(valid).toBe(true);
    });

    it('accepts a progress message with progress field', () => {
        const { valid } = validateAgainstSchema(
            { status: 'progress', message: 'Loading…', progress: 42 },
            schema,
        );
        expect(valid).toBe(true);
    });

    it('rejects an unknown status', () => {
        const { valid } = validateAgainstSchema(
            { status: 'unknown', message: 'x' },
            schema,
        );
        expect(valid).toBe(false);
    });
});

describe('validateAgainstSchema – BT calculate request schema', () => {
    const schema = path.join(SCHEMA_DIR, 'bt_calculate_request.schema.json');

    it('accepts a minimal valid BT request', () => {
        const { valid, errors } = validateAgainstSchema(validBtRequest, schema);
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('rejects missing transformer', () => {
        const bad = { ...validBtRequest, transformer: undefined };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('transformer'))).toBe(true);
    });

    it('rejects invalid phase enum', () => {
        const bad = { ...validBtRequest, phase: 'QUAD' };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('phase'))).toBe(true);
    });

    it('rejects transformer kva of zero (exclusiveMinimum)', () => {
        const bad = {
            ...validBtRequest,
            transformer: { ...validBtRequest.transformer, kva: 0 },
        };
        const { valid, errors } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
        expect(errors.some(e => e.includes('kva') || e.includes('exclusiveMinimum'))).toBe(true);
    });
});

describe('validateAgainstSchema – BT calculate response schema', () => {
    const schema = path.join(SCHEMA_DIR, 'bt_calculate_response.schema.json');

    const validResponse = {
        qtTrafo: 1.5,
        nodeResults: [
            {
                nodeId: 'n1',
                qtSegment: 0.5,
                qtAccumulated: 0.5,
                voltageV: 126.5,
                accumulatedDemandKva: 10,
                pathFromRoot: ['n1'],
            },
        ],
        terminalResults: [
            {
                nodeId: 'n2',
                qtTerminal: 0.8,
                qtRamal: 0.2,
                qtTotal: 1.0,
                voltageEndV: 125,
                ramalConductorId: null,
                ramalLengthMeters: null,
            },
        ],
        worstCase: {
            worstTerminalNodeId: 'n2',
            cqtGlobal: 2.5,
            criticalPath: ['n1', 'n2'],
            qtTrafo: 1.5,
        },
        totalDemandKva: 10,
        consistencyAlerts: [],
    };

    it('accepts a valid response', () => {
        const { valid, errors } = validateAgainstSchema(validResponse, schema);
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('rejects missing qtTrafo', () => {
        const bad = { ...validResponse, qtTrafo: undefined };
        const { valid } = validateAgainstSchema(bad, schema);
        expect(valid).toBe(false);
    });

    it('accepts consistency alerts', () => {
        const withAlerts = {
            ...validResponse,
            consistencyAlerts: [{ code: 'OVERLOAD', message: 'Transformer overloaded', severity: 'warn' }],
        };
        const { valid, errors } = validateAgainstSchema(withAlerts, schema);
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });
});

describe('validateAgainstSchema – error handling', () => {
    it('returns error for non-existent schema file', () => {
        const { valid, errors } = validateAgainstSchema({}, 'does_not_exist.schema.json');
        expect(valid).toBe(false);
        expect(errors[0]).toMatch(/Schema load\/parse error/);
    });
});
