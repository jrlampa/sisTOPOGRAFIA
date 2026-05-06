import { vi } from "vitest";
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

// Mock dbClient compartilhado (roleService usa getDbClient() em vez de criar conexão própria)
const mockSql = vi.fn();
vi.mock('../repositories/dbClient', () => ({
    getDbClient: () => mockSql,
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
        clearRoleCache();
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
            expect(mockSql).not.toHaveBeenCalled();
        });

        it('should return guest for whitespace-only userId', async () => {
            const context = await getUserRole('   ');
            expect(context).toEqual({ role: 'guest', tenantId: null });
            expect(mockSql).not.toHaveBeenCalled();
        });

        it('should return role from database for valid userId', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'user-1', role: 'admin', tenant_id: 't-1' }]);
            const context = await getUserRole('user-1');
            expect(context).toEqual({ role: 'admin', tenantId: 't-1' });
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
            // DB called only once due to cache hit on second call
            expect(mockSql).toHaveBeenCalledTimes(1);
        });

        it('should trim whitespace from userId before lookup', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'user-trim', role: 'viewer', tenant_id: null }]);
            const context = await getUserRole('  user-trim  ');
            expect(context).toEqual({ role: 'viewer', tenantId: null });
        });

        it('should support all valid UserRole values', async () => {
            const roles: UserRole[] = ['admin', 'technician', 'viewer', 'guest'];
            for (const expectedRole of roles) {
                clearRoleCache();
                mockSql.mockResolvedValueOnce([{ user_id: 'test-user', role: expectedRole, tenant_id: null }]);
                const context = await getUserRole('test-user');
                expect(context).toEqual({ role: expectedRole, tenantId: null });
            }
        });
    });

    describe('clearRoleCache', () => {
        it('should clear all cached roles', async () => {
            // Prime cache
            mockSql.mockResolvedValueOnce([{ user_id: 'cache-user', role: 'admin', tenant_id: null }]);
            await getUserRole('cache-user');
            expect(mockSql).toHaveBeenCalledTimes(1);

            clearRoleCache();

            // After clear, DB is called again
            mockSql.mockResolvedValueOnce([{ user_id: 'cache-user', role: 'admin', tenant_id: null }]);
            await getUserRole('cache-user');
            expect(mockSql).toHaveBeenCalledTimes(2);
        });
    });

    describe('clearUserRoleCache', () => {
        it('should clear cache for specific user only', async () => {
            // Prime caches for two users
            mockSql
                .mockResolvedValueOnce([{ user_id: 'user-a', role: 'admin', tenant_id: null }])
                .mockResolvedValueOnce([{ user_id: 'user-b', role: 'viewer', tenant_id: null }]);
            await getUserRole('user-a');
            await getUserRole('user-b');
            expect(mockSql).toHaveBeenCalledTimes(2);

            clearUserRoleCache('user-a');

            // user-a must hit DB again; user-b should use cache
            mockSql.mockResolvedValueOnce([{ user_id: 'user-a', role: 'technician', tenant_id: null }]);
            const contextA = await getUserRole('user-a');
            const contextB = await getUserRole('user-b');
            expect(contextA).toEqual({ role: 'technician', tenantId: null });
            expect(contextB).toEqual({ role: 'viewer', tenantId: null });
            expect(mockSql).toHaveBeenCalledTimes(3);
        });
    });

    describe('setUserRole', () => {
        it('should return false for empty userId', async () => {
            const result = await setUserRole('', 'admin', 'system');
            expect(result).toBe(false);
            expect(mockSql).not.toHaveBeenCalled();
        });

        it('should return false for empty assignedBy', async () => {
            const result = await setUserRole('user-x', 'admin', '');
            expect(result).toBe(false);
            expect(mockSql).not.toHaveBeenCalled();
        });

        it('should return true and invalidate cache on successful update', async () => {
            // Prime cache
            mockSql.mockResolvedValueOnce([{ user_id: 'upd-user', role: 'viewer' }]);
            await getUserRole('upd-user');

            // setUserRole should succeed
            mockSql.mockResolvedValueOnce([{ user_id: 'upd-user', role: 'admin' }]);
            const result = await setUserRole('upd-user', 'admin', 'admin-user', 'promotion');
            expect(result).toBe(true);
            expect(onRoleChangeMock).toHaveBeenCalledWith('upd-user');

            // Cache invalidated: DB queried on next getUserRole
            mockSql.mockResolvedValueOnce([{ user_id: 'upd-user', role: 'admin' }]);
            await getUserRole('upd-user');
            expect(mockSql).toHaveBeenCalledTimes(3);
        });

        it('should return false on database error', async () => {
            mockSql.mockRejectedValueOnce(new Error('Write failed'));
            const result = await setUserRole('err-user', 'admin', 'system');
            expect(result).toBe(false);
            expect(onRoleChangeMock).not.toHaveBeenCalled();
        });

        it('should return false if database returns empty rows', async () => {
            mockSql.mockResolvedValueOnce([]);
            const result = await setUserRole('no-rows-user', 'viewer', 'system');
            expect(result).toBe(false);
        });

        it('should accept optional reason parameter', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'reason-user', role: 'technician' }]);
            const result = await setUserRole('reason-user', 'technician', 'admin', 'Novo técnico');
            expect(result).toBe(true);
        });

        it('should work without reason parameter', async () => {
            mockSql.mockResolvedValueOnce([{ user_id: 'no-reason-user', role: 'viewer' }]);
            const result = await setUserRole('no-reason-user', 'viewer', 'admin');
            expect(result).toBe(true);
        });
    });

    describe('getUsersByRole', () => {
        it('should return list of users for a given role', async () => {
            const mockUsers = [
                { user_id: 'u1', role: 'technician' as UserRole, assigned_at: '2026-01-01', last_updated: '2026-01-01' },
                { user_id: 'u2', role: 'technician' as UserRole, assigned_at: '2026-01-02', last_updated: '2026-01-02' },
            ];
            mockSql.mockResolvedValueOnce(mockUsers);
            const users = await getUsersByRole('technician');
            expect(users).toHaveLength(2);
            expect(users[0].user_id).toBe('u1');
        });

        it('should return empty array on database error', async () => {
            mockSql.mockRejectedValueOnce(new Error('Query failed'));
            const users = await getUsersByRole('admin');
            expect(users).toEqual([]);
        });

        it('should return empty array if no users found', async () => {
            mockSql.mockResolvedValueOnce([]);
            const users = await getUsersByRole('guest');
            expect(users).toEqual([]);
        });
    });

    describe('getRoleStatistics', () => {
        it('should return distribution of roles', async () => {
            mockSql.mockResolvedValueOnce([
                { role: 'admin', count: 2 },
                { role: 'technician', count: 5 },
                { role: 'viewer', count: 10 },
            ]);
            const stats = await getRoleStatistics();
            expect(stats.admin).toBe(2);
            expect(stats.technician).toBe(5);
            expect(stats.viewer).toBe(10);
            expect(stats.guest).toBe(0);
        });

        it('should return zeros for all roles on database error', async () => {
            mockSql.mockRejectedValueOnce(new Error('Stats query failed'));
            const stats = await getRoleStatistics();
            expect(stats).toEqual({ admin: 0, technician: 0, viewer: 0, guest: 0 });
        });

        it('should return zeros for roles not returned from DB', async () => {
            mockSql.mockResolvedValueOnce([{ role: 'admin', count: 1 }]);
            const stats = await getRoleStatistics();
            expect(stats.admin).toBe(1);
            expect(stats.technician).toBe(0);
            expect(stats.viewer).toBe(0);
            expect(stats.guest).toBe(0);
        });
    });
});

