/**
 * artifactProvenance.ts
 * SHA-256 artifact provenance utilities for DXF files.
 * Roadmap Items 7 and 72: "Proveniência Técnica dos Artefatos" /
 * "Assinatura de Hash Padrão SHA-256 por Artefato".
 */

import crypto from 'crypto';
import fs from 'fs/promises';

export interface ProvenanceRecord {
    sha256: string;
    generated_at: string;
    generator: string;
    version: string;
    entity_count?: number;
}

/** Computes the SHA-256 digest of a file, returned as a lowercase hex string. */
export async function computeFileSha256(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
}

/** Writes a provenance JSON sidecar file next to `filePath`. */
export async function writeProvenance(
    filePath: string,
    metadata: Record<string, unknown> = {}
): Promise<ProvenanceRecord> {
    const sha256 = await computeFileSha256(filePath);
    const record: ProvenanceRecord = {
        sha256,
        generated_at: new Date().toISOString(),
        generator: 'sisTOPOGRAFIA/sisrua_unified',
        version: '1.0.0',
        ...metadata,
    };
    const provenancePath = filePath + '.provenance.json';
    await fs.writeFile(provenancePath, JSON.stringify(record, null, 2), 'utf8');
    return record;
}

/** Reads the provenance JSON sidecar for `filePath`, or returns null if absent. */
export async function readProvenance(filePath: string): Promise<ProvenanceRecord | null> {
    const provenancePath = filePath + '.provenance.json';
    try {
        const raw = await fs.readFile(provenancePath, 'utf8');
        return JSON.parse(raw) as ProvenanceRecord;
    } catch {
        return null;
    }
}

/**
 * Verifies that the file at `filePath` matches the SHA-256 recorded in its
 * provenance sidecar. Returns false if the sidecar is missing or the hash
 * does not match.
 */
export async function verifyProvenance(filePath: string): Promise<boolean> {
    const record = await readProvenance(filePath);
    if (!record) return false;
    const actual = await computeFileSha256(filePath);
    return actual === record.sha256;
}
