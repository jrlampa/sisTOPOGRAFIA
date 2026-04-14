/**
 * artifactProvenance.test.ts
 * Tests for SHA-256 artifact provenance utilities.
 * Roadmap Items 7 and 72.
 */

import fs from 'fs/promises';
import path from 'path';
import {
    computeFileSha256,
    writeProvenance,
    readProvenance,
    verifyProvenance,
    ProvenanceRecord,
} from '../utils/artifactProvenance';

/** Creates a temp file with given content inside the project-relative tmp folder. */
async function makeTempFile(content: string): Promise<string> {
    const dir = path.resolve(process.cwd(), 'server', 'tests', '_provenance_tmp');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `test_${Date.now()}_${Math.random().toString(36).slice(2)}.dxf`);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
}

async function cleanUp(filePath: string) {
    for (const p of [filePath, filePath + '.provenance.json']) {
        await fs.unlink(p).catch(() => undefined);
    }
}

describe('artifactProvenance: computeFileSha256', () => {
    it('returns a 64-character hex string', async () => {
        const filePath = await makeTempFile('hello world');
        try {
            const hash = await computeFileSha256(filePath);
            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]+$/);
        } finally {
            await cleanUp(filePath);
        }
    });

    it('produces a deterministic hash for the same content', async () => {
        const filePath = await makeTempFile('deterministic content');
        try {
            const h1 = await computeFileSha256(filePath);
            const h2 = await computeFileSha256(filePath);
            expect(h1).toBe(h2);
        } finally {
            await cleanUp(filePath);
        }
    });

    it('produces different hashes for different content', async () => {
        const f1 = await makeTempFile('content A');
        const f2 = await makeTempFile('content B');
        try {
            const h1 = await computeFileSha256(f1);
            const h2 = await computeFileSha256(f2);
            expect(h1).not.toBe(h2);
        } finally {
            await cleanUp(f1);
            await cleanUp(f2);
        }
    });
});

describe('artifactProvenance: writeProvenance', () => {
    it('creates a .provenance.json sidecar with required fields', async () => {
        const filePath = await makeTempFile('dxf content');
        try {
            const record = await writeProvenance(filePath, { entity_count: 42 });
            expect(record.sha256).toHaveLength(64);
            expect(record.generator).toBe('sisTOPOGRAFIA/sisrua_unified');
            expect(record.version).toBe('1.0.0');
            expect(record.generated_at).toBeTruthy();
            expect((record as any).entity_count).toBe(42);

            const raw = await fs.readFile(filePath + '.provenance.json', 'utf8');
            const parsed: ProvenanceRecord = JSON.parse(raw);
            expect(parsed.sha256).toBe(record.sha256);
        } finally {
            await cleanUp(filePath);
        }
    });

    it('sha256 in provenance matches actual file content', async () => {
        const filePath = await makeTempFile('verify me');
        try {
            const record = await writeProvenance(filePath);
            const actual = await computeFileSha256(filePath);
            expect(record.sha256).toBe(actual);
        } finally {
            await cleanUp(filePath);
        }
    });
});

describe('artifactProvenance: readProvenance', () => {
    it('returns null when provenance file does not exist', async () => {
        const result = await readProvenance('/nonexistent/path/file.dxf');
        expect(result).toBeNull();
    });

    it('returns the provenance record when the sidecar exists', async () => {
        const filePath = await makeTempFile('readable content');
        try {
            await writeProvenance(filePath);
            const record = await readProvenance(filePath);
            expect(record).not.toBeNull();
            expect(record!.sha256).toHaveLength(64);
            expect(record!.generator).toBe('sisTOPOGRAFIA/sisrua_unified');
        } finally {
            await cleanUp(filePath);
        }
    });
});

describe('artifactProvenance: verifyProvenance', () => {
    it('returns false when provenance sidecar is missing', async () => {
        const filePath = await makeTempFile('no sidecar');
        try {
            const result = await verifyProvenance(filePath);
            expect(result).toBe(false);
        } finally {
            await cleanUp(filePath);
        }
    });

    it('returns true for a valid unmodified file', async () => {
        const filePath = await makeTempFile('original content');
        try {
            await writeProvenance(filePath);
            const result = await verifyProvenance(filePath);
            expect(result).toBe(true);
        } finally {
            await cleanUp(filePath);
        }
    });

    it('returns false after the file has been tampered with', async () => {
        const filePath = await makeTempFile('original content');
        try {
            await writeProvenance(filePath);
            // Tamper with the file
            await fs.appendFile(filePath, ' TAMPERED');
            const result = await verifyProvenance(filePath);
            expect(result).toBe(false);
        } finally {
            await cleanUp(filePath);
        }
    });
});
