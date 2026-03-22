import { createVerify } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { FieldValue } from '@google-cloud/firestore';
import { FirestoreInfrastructure } from '../infrastructure/firestoreService.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email?: string;
    };
}

// Firebase public certificate URL for RS256 token verification
const FIREBASE_CERT_URL =
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_ISSUER_PREFIX = 'https://securetoken.google.com/';

// In-memory certificate cache with TTL
let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

/**
 * Fetches and caches Firebase public certificates.
 * Respects the Cache-Control max-age header returned by Google.
 */
export async function getFirebaseCerts(): Promise<Record<string, string>> {
    const now = Date.now();
    if (certCache && now < certCache.expiresAt) {
        return certCache.certs;
    }

    const response = await fetch(FIREBASE_CERT_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch Firebase certificates: HTTP ${response.status}`);
    }

    /* istanbul ignore next */
    const cacheControl = response.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    /* istanbul ignore next */
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3_600_000; // default 1 hour

    const certs = (await response.json()) as Record<string, string>;
    if (!certs || typeof certs !== 'object' || Object.keys(certs).length === 0) {
        throw new Error('Firebase returned an empty or invalid certificate set');
    }
    certCache = { certs, expiresAt: now + maxAge };
    return certs;
}

/** Decodes a base64url-encoded string to UTF-8 text. */
function decodeBase64Url(str: string): string {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/**
 * Verifies a Firebase ID token (RS256 JWT) without firebase-admin.
 * Validates signature, expiry, audience, and issuer against the configured project.
 */
export async function verifyFirebaseIdToken(
    idToken: string,
    projectId: string
): Promise<{ uid: string; email?: string }> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
    }

    let header: { alg: string; kid: string; typ?: string };
    let payload: {
        iss: string;
        aud: string;
        exp: number;
        iat: number;
        sub: string;
        email?: string;
    };

    try {
        header = JSON.parse(decodeBase64Url(parts[0]));
        payload = JSON.parse(decodeBase64Url(parts[1]));
    } catch {
        throw new Error('Failed to decode JWT claims');
    }

    if (header.alg !== 'RS256') {
        throw new Error(`Unsupported algorithm: ${header.alg}`);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) {
        throw new Error('Token has expired');
    }
    if (payload.iat > nowSec + 300) {
        // Reject tokens with iat more than 5 minutes in the future (clock-skew tolerance)
        throw new Error('Token issued in the future');
    }
    if (payload.aud !== projectId) {
        throw new Error('Invalid token audience');
    }
    if (payload.iss !== `${FIREBASE_ISSUER_PREFIX}${projectId}`) {
        throw new Error('Invalid token issuer');
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
        throw new Error('Missing or invalid token subject');
    }

    // Verify RS256 signature against Google's published certificates
    const certs = await getFirebaseCerts();
    const cert = certs[header.kid];
    if (!cert) {
        throw new Error('No matching certificate found for token kid');
    }

    const signingInput = `${parts[0]}.${parts[1]}`;
    const signatureBytes = Buffer.from(
        parts[2].replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
    );

    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    const isValid = verifier.verify(cert, signatureBytes);
    if (!isValid) {
        throw new Error('Invalid token signature');
    }

    return { uid: payload.sub, email: payload.email };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];

        // Development shortcut: accept a configurable dev token (only in dev/test environments)
        const devToken = process.env.DEV_AUTH_TOKEN;
        const devEnv = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
        if (devToken && token === devToken && devEnv) {
            req.user = { uid: 'dev-user', email: 'dev@example.com' };
            return next();
        }

        // Production (and development with real tokens): verify Firebase ID token
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
        if (!projectId) {
            logger.error('FIREBASE_PROJECT_ID is not configured — cannot verify tokens');
            return res.status(500).json({ error: 'Server authentication configuration error' });
        }

        const { uid, email } = await verifyFirebaseIdToken(token, projectId);
        req.user = { uid, email };
        return next();

    } catch (error) {
        /* istanbul ignore next */
        const authErrMsg = error instanceof Error ? error.message : String(error);
        logger.warn('Authentication failed', { error: authErrMsg });
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

export const checkQuota = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: User not found for quota check' });
    }

    const MAX_DAILY_REQUESTS = parseInt(process.env.MAX_DAILY_DXF_REQUESTS || '10', 10);

    // Skip quota enforcement in development mode without Firestore
    if (process.env.NODE_ENV !== 'production' && process.env.USE_FIRESTORE !== 'true') {
        return next();
    }

    try {
        const firestoreService = FirestoreInfrastructure.getInstance();
        const db = firestoreService.getDb();

        const today = new Date().toISOString().split('T')[0];
        const quotaDocId = `${req.user.uid}_${today}`;
        const quotaRef = db.collection('userQuotas').doc(quotaDocId);

        // Atomic check-and-increment via Firestore transaction to prevent race conditions
        let allowed = false;
        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(quotaRef);
            /* istanbul ignore next */
            const currentCount: number = snapshot.exists ? ((snapshot.data()?.count as number) ?? 0) : 0;

            if (currentCount >= MAX_DAILY_REQUESTS) {
                allowed = false;
                return;
            }

            transaction.set(quotaRef, {
                uid: req.user!.uid,
                date: today,
                count: FieldValue.increment(1)
            }, { merge: true });

            allowed = true;
        });

        if (!allowed) {
            logger.warn('User daily quota exceeded', { uid: req.user.uid, max: MAX_DAILY_REQUESTS });
            return res.status(429).json({
                error: 'Limite diário de requisições atingido',
                message: `Você atingiu o limite de ${MAX_DAILY_REQUESTS} gerações de DXF por dia. Tente novamente amanhã.`,
                retryAfter: 'tomorrow'
            });
        }

        logger.info('Quota check passed', { uid: req.user.uid, max: MAX_DAILY_REQUESTS });
        return next();
    } catch (error: unknown) {
        // In production, fail closed to prevent quota bypass via Firestore unavailability.
        // In development/test, fail open to avoid blocking local workflows.
        const msg = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV === 'production') {
            logger.error('Quota check failed in production — rejecting request', { uid: req.user.uid, error: msg });
            return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
        }
        logger.error('Quota check failed, allowing request (non-production)', { uid: req.user.uid, error: msg });
        return next();
    }
};
