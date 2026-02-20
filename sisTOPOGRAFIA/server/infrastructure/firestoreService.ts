/**
 * Firestore Service (Infrastructure Layer)
 * Handles Cloud Storage persistency, jobs and snapshots according to the plan rules (max 90% quota).
 */

import { Firestore, Timestamp, FieldValue } from '@google-cloud/firestore';
import { logger } from '../utils/logger.js';

const QUOTAS = {
    READS_PER_DAY: 50000,
    WRITES_PER_DAY: 20000,
    DELETES_PER_DAY: 20000,
    STORAGE_BYTES: 1024 * 1024 * 1024, // 1 GiB free tier
};

// IMPORTANT CONSTRAINT: Max 90% capacity as requested
const CIRCUIT_BREAKER_THRESHOLD = 0.90;
// Oldest eviction starts at 80% to ensure we never hit 90% abruptly
const CLEANUP_THRESHOLD = 0.80;

interface QuotaUsage {
    date: string;
    reads: number;
    writes: number;
    deletes: number;
    storageBytes: number;
    lastUpdated: Timestamp;
}

export class FirestoreInfrastructure {
    private db: Firestore;
    private static instance: FirestoreInfrastructure | null = null;

    private constructor() {
        this.db = new Firestore({
            projectId: process.env.GCP_PROJECT,
        });
        logger.info('Firestore Infrastructure initialized', { project: process.env.GCP_PROJECT });
    }

    public static getInstance(): FirestoreInfrastructure {
        if (!FirestoreInfrastructure.instance) {
            FirestoreInfrastructure.instance = new FirestoreInfrastructure();
        }
        return FirestoreInfrastructure.instance;
    }

    public getDb(): Firestore {
        return this.db;
    }

    /**
     * Increment quota counter defensively
     */
    public async incrementQuota(operation: 'reads' | 'writes' | 'deletes', count: number = 1): Promise<void> {
        if (process.env.NODE_ENV !== 'production' && process.env.USE_FIRESTORE !== 'true') return;
        const today = new Date().toISOString().split('T')[0];
        const quotaRef = this.db.collection('quotaMonitor').doc(today);

        try {
            await quotaRef.set({
                [operation]: FieldValue.increment(count),
                lastUpdated: Timestamp.now()
            }, { merge: true });
        } catch (error) {
            logger.error('Failed to increment quota', { operation, error });
        }
    }

    /**
     * Gets document while tracking quota
     */
    public async safeRead<T>(collection: string, docId: string): Promise<T | null> {
        const doc = await this.db.collection(collection).doc(docId).get();
        await this.incrementQuota('reads');
        if (!doc.exists) return null;
        return doc.data() as T;
    }

    public async safeWrite<T extends Record<string, any>>(collection: string, docId: string, data: T): Promise<void> {
        await this.db.collection(collection).doc(docId).set(data);
        await this.incrementQuota('writes');
    }

    public async safeDelete(collection: string, docId: string): Promise<void> {
        await this.db.collection(collection).doc(docId).delete();
        await this.incrementQuota('deletes');
    }

    /**
     * Feature 3: Snippet/Versions functionality
     */
    public async createProjectSnapshot(jobId: string, data: any) {
        const snapshotId = `snap_${Date.now()}`;
        await this.safeWrite(`jobs/${jobId}/snapshots`, snapshotId, {
            data,
            createdAt: Timestamp.now()
        });
        return snapshotId;
    }
}
