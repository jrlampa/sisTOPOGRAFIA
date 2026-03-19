import { createVerify } from 'crypto';
import { Request, Response, NextFunction } from 'express';
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

    const cacheControl = response.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3_600_000; // default 1 h

    const certs = (await response.json()) as Record<string, string>;
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

        // Development shortcut: accept a configurable dev token
        const devToken = process.env.DEV_AUTH_TOKEN || 'dev-token';
        if (token === devToken && process.env.NODE_ENV !== 'production') {
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
        logger.warn('Authentication failed', {
            error: error instanceof Error ? error.message : String(error)
        });
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

export const checkQuota = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: User not found for quota check' });
    }

    // TODO: Connect with FirestoreService to read the user's daily quota.
    // If quota > MAX_DAILY_REQUESTS, return 429 Too Many Requests

    next();
};
