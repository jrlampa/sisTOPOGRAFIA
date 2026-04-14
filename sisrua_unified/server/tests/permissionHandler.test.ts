import { requirePermission } from '../middleware/permissionHandler';
import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../services/roleService';

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }
}));

// Mock roleService to avoid real DB connections in tests
const mockGetUserRole = jest.fn<(userId: string | undefined) => Promise<UserRole>>();
jest.mock('../services/roleService', () => ({
    getUserRole: (...args: [string | undefined]) => mockGetUserRole(...args),
}));

describe('PermissionHandler Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();
        nextFunction = jest.fn();
        mockReq = {
            headers: {},
            path: '/test'
        };
        mockRes = {
            locals: {},
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    describe('admin role', () => {
        beforeEach(() => {
            mockGetUserRole.mockResolvedValue('admin');
        });

        it('should allow admin to perform read', async () => {
            mockReq.headers!['x-user-id'] = 'admin-user';
            await requirePermission('read')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should allow admin to perform write', async () => {
            mockReq.headers!['x-user-id'] = 'admin-user';
            await requirePermission('write')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should allow admin to perform delete', async () => {
            mockReq.headers!['x-user-id'] = 'admin-user';
            await requirePermission('delete')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should allow admin to perform export_dxf', async () => {
            mockReq.headers!['x-user-id'] = 'admin-user';
            await requirePermission('export_dxf')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should allow admin to perform bt_calculate', async () => {
            mockReq.headers!['x-user-id'] = 'admin-user';
            await requirePermission('bt_calculate')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });
    });

    describe('technician role', () => {
        beforeEach(() => {
            mockGetUserRole.mockResolvedValue('technician');
        });

        it('should allow technician to perform read', async () => {
            mockReq.headers!['x-user-id'] = 'tech-user';
            await requirePermission('read')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should allow technician to perform write', async () => {
            mockReq.headers!['x-user-id'] = 'tech-user';
            await requirePermission('write')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should allow technician to perform export_dxf', async () => {
            mockReq.headers!['x-user-id'] = 'tech-user';
            await requirePermission('export_dxf')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should allow technician to perform bt_calculate', async () => {
            mockReq.headers!['x-user-id'] = 'tech-user';
            await requirePermission('bt_calculate')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should deny technician from delete', async () => {
            mockReq.headers!['x-user-id'] = 'tech-user';
            await requirePermission('delete')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Missing required permission: delete')
            }));
        });

        it('should deny technician from admin', async () => {
            mockReq.headers!['x-user-id'] = 'tech-user';
            await requirePermission('admin')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Missing required permission: admin')
            }));
        });
    });

    describe('viewer role', () => {
        beforeEach(() => {
            mockGetUserRole.mockResolvedValue('viewer');
        });

        it('should allow viewer to perform read', async () => {
            mockReq.headers!['x-user-id'] = 'view-user';
            await requirePermission('read')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });

        it('should deny viewer from write', async () => {
            mockReq.headers!['x-user-id'] = 'view-user';
            await requirePermission('write')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Missing required permission: write')
            }));
        });

        it('should deny viewer from delete', async () => {
            mockReq.headers!['x-user-id'] = 'view-user';
            await requirePermission('delete')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Missing required permission: delete')
            }));
        });

        it('should deny viewer from export_dxf', async () => {
            mockReq.headers!['x-user-id'] = 'view-user';
            await requirePermission('export_dxf')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Missing required permission: export_dxf')
            }));
        });

        it('should support permissions from res.locals.userId', async () => {
            mockRes.locals!.userId = 'local-viewer';
            await requirePermission('read')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith();
        });
    });

    describe('guest role', () => {
        beforeEach(() => {
            mockGetUserRole.mockResolvedValue('guest');
        });

        it('should deny guest from read', async () => {
            await requirePermission('read')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Missing required permission: read')
            }));
        });

        it('should deny guest from write', async () => {
            await requirePermission('write')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Missing required permission: write')
            }));
        });

        it('should deny guest from export_dxf', async () => {
            await requirePermission('export_dxf')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('error handling', () => {
        it('should deny access and call next with error when roleService throws', async () => {
            mockGetUserRole.mockRejectedValue(new Error('DB connection failed'));
            mockReq.headers!['x-user-id'] = 'some-user';
            await requirePermission('read')(mockReq as Request, mockRes as Response, nextFunction);
            expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Permission check failed')
            }));
        });

        it('should call getUserRole with header userId', async () => {
            mockGetUserRole.mockResolvedValue('viewer');
            mockReq.headers!['x-user-id'] = 'header-user-123';
            await requirePermission('read')(mockReq as Request, mockRes as Response, nextFunction);
            expect(mockGetUserRole).toHaveBeenCalledWith('header-user-123');
        });

        it('should prefer header userId over res.locals.userId', async () => {
            mockGetUserRole.mockResolvedValue('admin');
            mockReq.headers!['x-user-id'] = 'header-user';
            mockRes.locals!.userId = 'local-user';
            await requirePermission('delete')(mockReq as Request, mockRes as Response, nextFunction);
            expect(mockGetUserRole).toHaveBeenCalledWith('header-user');
            expect(nextFunction).toHaveBeenCalledWith();
        });
    });
});
