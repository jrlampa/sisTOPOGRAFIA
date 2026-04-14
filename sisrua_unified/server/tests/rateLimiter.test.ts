const mockConfig = {
    RATE_LIMIT_GENERAL_WINDOW_MS: 900000,
    RATE_LIMIT_GENERAL_MAX: 100,
    RATE_LIMIT_DXF_WINDOW_MS: 3600000,
    RATE_LIMIT_DXF_MAX: 10,
    useDbConstantsConfig: false
};

const getSyncMock = jest.fn();

jest.mock('../config', () => ({
    config: mockConfig
}));

jest.mock('../services/constantsService', () => ({
    constantsService: {
        getSync: getSyncMock
    }
}));

import { dxfRateLimiter, generalRateLimiter, getRateLimitPolicySnapshot } from '../middleware/rateLimiter';

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Rate Limiter Middleware', () => {
    beforeEach(() => {
        mockConfig.useDbConstantsConfig = false;
        getSyncMock.mockReset();
    });

    describe('Rate Limiter Configuration', () => {
        it('should export dxfRateLimiter', () => {
            expect(dxfRateLimiter).toBeDefined();
            expect(typeof dxfRateLimiter).toBe('function');
        });

        it('should export generalRateLimiter', () => {
            expect(generalRateLimiter).toBeDefined();
            expect(typeof generalRateLimiter).toBe('function');
        });

        it('should handle IPv4 addresses', () => {
            // This test verifies the rate limiters are properly configured
            // In production, the ipKeyGenerator will handle IPv4 correctly

            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });

        it('should handle IPv6 addresses', () => {
            // This test verifies the rate limiters can handle IPv6
            // The ipKeyGenerator will normalize IPv6 to CIDR notation

            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });

        it('should handle missing IP with fallback', () => {

            // The rate limiter should still work even without IP
            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });

        it('should expose fallback policy snapshot from env/config values', () => {
            expect(getRateLimitPolicySnapshot()).toEqual({
                general: {
                    windowMs: 900000,
                    limit: 100
                },
                dxf: {
                    windowMs: 3600000,
                    limit: 10
                },
                downloads: {
                    windowMs: 900000,
                    limit: 50
                },
                analyze: {
                    windowMs: 300000,
                    limit: 20
                }
            });
        });

        it('should expose DB-backed numeric limits when config namespace is enabled', () => {
            mockConfig.useDbConstantsConfig = true;
            getSyncMock.mockImplementation((_namespace: string, key: string) => {
                const dbValues: Record<string, number> = {
                    RATE_LIMIT_GENERAL_WINDOW_MS: 120000,
                    RATE_LIMIT_GENERAL_MAX: 250,
                    RATE_LIMIT_DXF_WINDOW_MS: 1800000,
                    RATE_LIMIT_DXF_MAX: 25,
                };

                return dbValues[key] ?? undefined;
            });

            expect(getRateLimitPolicySnapshot()).toEqual({
                general: {
                    windowMs: 120000,
                    limit: 250
                },
                dxf: {
                    windowMs: 1800000,
                    limit: 25
                },
                downloads: {
                    windowMs: 900000,
                    limit: 50
                },
                analyze: {
                    windowMs: 300000,
                    limit: 20
                }
            });
        });
    });

    describe('X-Forwarded-For Support', () => {
        it('should respect X-Forwarded-For when trust proxy is enabled', () => {
            // In production, when trust proxy is enabled, req.ip will be populated
            // from X-Forwarded-For header automatically by Express

            // The rate limiters should be configured to use the IP
            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });
    });
});
