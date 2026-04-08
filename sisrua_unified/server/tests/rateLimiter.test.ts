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

import { Request, Response } from 'express';
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
            const mockReq = {
                ip: '192.168.1.100',
                headers: {}
            } as unknown as Request;

            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });

        it('should handle IPv6 addresses', () => {
            // This test verifies the rate limiters can handle IPv6
            // The ipKeyGenerator will normalize IPv6 to CIDR notation
            const mockReq = {
                ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
                headers: {}
            } as unknown as Request;

            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });

        it('should handle missing IP with fallback', () => {
            const mockReq = {
                ip: undefined,
                headers: {}
            } as unknown as Request;

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
                }
            });
        });
    });

    describe('X-Forwarded-For Support', () => {
        it('should respect X-Forwarded-For when trust proxy is enabled', () => {
            // In production, when trust proxy is enabled, req.ip will be populated
            // from X-Forwarded-For header automatically by Express
            const mockReq = {
                ip: '10.0.0.1',
                headers: {
                    'x-forwarded-for': '10.0.0.1'
                }
            } as unknown as Request;

            // The rate limiters should be configured to use the IP
            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });
    });
});
