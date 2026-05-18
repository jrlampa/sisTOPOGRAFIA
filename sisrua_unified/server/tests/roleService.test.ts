import { vi, describe, it, expect, beforeEach } from "vitest";
import type { UserRole } from '../services/roleService';

// Mock logger first (before any other import)
vi.mock('../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }
}));

// Mock dbClient compartilhado
const mockSql = vi.fn();
const getDbClientMock = vi.fn(() => mockSql);

vi.mock('../repositories/dbClient', () => ({
    getDbClient: () => getDbClientMock(),
    isDbAvailable: () => true,
}));

const onRoleChangeMock = vi.fn();
vi.mock('../services/cacheService', () => ({
    onRoleChange: (userId: string) => onRoleChangeMock(userId),
}));

import {
    getUserRole,
    setUserRole,
    clearRoleCache,
    clearUserRoleCache,
    getUsersByRole,
    getRoleStatistics,
} from '../services/roleService';

describe('RoleService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        onRoleChangeMock.mockClear();
        getDbClientMock.mockReturnValue(mockSql);
        clearRoleCache();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getUserRole', () => {
        it('should return guest for undefined userId', async () => {
            const context = await getUserRole(undefined);
            expect(context).toEqual({ role: 'guest', tenantId: null });
            expect(mockSql).not.toHaveBeenCalled();
        });

        it('should return guest for empty string userId', async () => {
            const context = await getUserRole('');
            expect(context).toEqual({ role: 'guest', tenantId: null });
        });

        it('should return guest for whitespace-only userId', async () => {
            const context = await getUserRole('   ');
            expect(context).toEqual({ role: 'guest', tenantId: null });
        });

        it('should return role from database for valid userId', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'user-1', role: 'admin', tenant_id: 't-1' }]);
            const context = await getUserRole('user-1');
            expect(context).toEqual({ role: 'admin', tenantId: 't-1' });
        });

        it('should return default viewer if DB is not available', async () => {
            getDbClientMock.mockReturnValue(null as any);
            const context = await getUserRole('user-x');
            expect(context).toEqual({ role: 'viewer', tenantId: null });
        });

        it('should return viewer if user not found in database', async () => {
            mockSql.mockResolvedValueOnce([]);
            const context = await getUserRole('unknown-user');
            expect(context).toEqual({ role: 'viewer', tenantId: null });
        });

        it('should return viewer on database error (safe fallback)', async () => {
            mockSql.mockRejectedValueOnce(new Error('Connection refused'));
            const context = await getUserRole('any-user');
            expect(context).toEqual({ role: 'viewer', tenantId: null });
        });

        it('should cache result and not call DB again', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'cached-user', role: 'technician', tenant_id: 't-2' }]);
            const context1 = await getUserRole('cached-user');
            const context2 = await getUserRole('cached-user');
            expect(context1).toEqual({ role: 'technician', tenantId: 't-2' });
            expect(context2).toEqual({ role: 'technician', tenantId: 't-2' });
            expect(mockSql).toHaveBeenCalledTimes(1);
        });

        it('should refresh cache after expiration', async () => {
            mockSql.mockResolvedValue([{ user_id: 'expiring-user', role: 'viewer' }]);
            await getUserRole('expiring-user');
            expect(mockSql).toHaveBeenCalledTimes(1);

            // Advance time 6 minutes (TTL is 5)
            vi.advanceTimersByTime(6 * 60 * 1000);

            await getUserRole('expiring-user');
            expect(mockSql).toHaveBeenCalledTimes(2);
        });
    });

    describe('setUserRole', () => {
        it('should return false if DB is not available', async () => {
            getDbClientMock.mockReturnValue(null as any);
            const result = await setUserRole('u1', 'admin', 'admin');
            expect(result).toBe(false);
        });

        it('should return false for empty userId or assignedBy', async () => {
            expect(await setUserRole('', 'admin', 'sys')).toBe(false);
            expect(await setUserRole('u1', 'admin', '')).toBe(false);
        });

        it('should return true and invalidate cache on successful update', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'upd-user', role: 'admin' }]);
            const result = await setUserRole('upd-user', 'admin', 'admin-user', 'promotion');
            expect(result).toBe(true);
            expect(onRoleChangeMock).toHaveBeenCalledWith('upd-user');
        });

        it('should handle onRoleChange failure without affecting result', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'upd-user', role: 'admin' }]);
            onRoleChangeMock.mockImplementationOnce(() => { throw new Error('Cache invalidation failed'); });
            
            const result = await setUserRole('upd-user', 'admin', 'admin-user');
            expect(result).toBe(true); // Still true because update succeeded
        });

        it('should return false if database returns empty rows', async () => {
            mockSql.mockResolvedValueOnce([]);
            const result = await setUserRole('no-rows-user', 'viewer', 'system');
            expect(result).toBe(false);
        });

        it('should return false on database error', async () => {
            mockSql.mockRejectedValueOnce(new Error('Write failed'));
            const result = await setUserRole('err-user', 'admin', 'system');
            expect(result).toBe(false);
        });
    });

    describe('getUsersByRole', () => {
        it('should return empty array if DB is not available', async () => {
            getDbClientMock.mockReturnValue(null as any);
            expect(await getUsersByRole('admin')).toEqual([]);
        });

        it('should return list of users for a given role', async () => {
            const mockUsers = [
                { user_id: 'u1', role: 'technician' as UserRole, assigned_at: '2026-01-01', last_updated: '2026-01-01' },
            ];
            mockSql.mockResolvedValueOnce(mockUsers);
            const users = await getUsersByRole('technician');
            expect(users).toHaveLength(1);
        });

        it('should return empty array on database error', async () => {
            mockSql.mockRejectedValueOnce(new Error('Query failed'));
            expect(await getUsersByRole('admin')).toEqual([]);
        });
    });

    describe('getRoleStatistics', () => {
        it('should return empty distribution if DB is not available', async () => {
            getDbClientMock.mockReturnValue(null as any);
            const stats = await getRoleStatistics();
            expect(stats.admin).toBe(0);
        });

        it('should return distribution of roles', async () => {
            mockSql.mockResolvedValueOnce([
                { role: 'admin', count: '2' },
                { role: 'viewer', count: '10' },
            ]);
            const stats = await getRoleStatistics();
            expect(stats.admin).toBe(2);
            expect(stats.viewer).toBe(10);
            expect(stats.technician).toBe(0);
        });

        it('should return zeros for all roles on database error', async () => {
            mockSql.mockRejectedValueOnce(new Error('Stats query failed'));
            const stats = await getRoleStatistics();
            expect(stats).toEqual({ admin: 0, technician: 0, viewer: 0, guest: 0 });
        });
    });

    describe('clearUserRoleCache', () => {
        it('should clear specific user from cache', async () => {
            mockSql.mockResolvedValue([{ user_id: 'u1', role: 'admin' }]);
            await getUserRole('u1');
            expect(mockSql).toHaveBeenCalledTimes(1);

            clearUserRoleCache('u1');
            await getUserRole('u1');
            expect(mockSql).toHaveBeenCalledTimes(2);
        });
    });
});

