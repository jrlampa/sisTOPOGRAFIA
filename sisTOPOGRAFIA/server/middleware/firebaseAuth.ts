import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
// To maintain free tier, we will track user requests per day.
// We'll mock the firebase-admin verification for now, or use a lightweight token validator later.

export interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email?: string;
    };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];

        // TODO: In a real integration, use Firebase Admin SDK to verify the ID token.
        // For now, we decode basic details if available or reject.
        // admin.auth().verifyIdToken(token)

        if (token === 'dev-token' && process.env.NODE_ENV !== 'production') {
            req.user = { uid: 'dev-user', email: 'dev@example.com' };
            return next();
        }

        // Just a placeholder to enforce the middleware usage.
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });

    } catch (error) {
        logger.error('Authentication Error', { error });
        return res.status(401).json({ error: 'Unauthorized' });
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
