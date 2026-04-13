import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { createError } from '../errorHandler.js';

export type Permission = 'read' | 'write' | 'delete' | 'admin' | 'export_dxf' | 'bt_calculate';

/**
 * Middleware para controle de permissões granular.
 * Atualmente implementado como um stub que pode ser conectado a uma tabela de user_roles no futuro.
 */
export const requirePermission = (requiredPermission: Permission) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.headers['x-user-id'] || res.locals.userId;
        const requestId = res.locals.requestId;

        // Recuperar papel do usuário (Placeholder: Atualmente todos são 'admin' se tiverem ID)
        // No futuro: const userRole = await db.query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
        const userRole = userId ? 'admin' : 'guest';

        const permissionsMap: Record<string, Permission[]> = {
            'admin': ['read', 'write', 'delete', 'admin', 'export_dxf', 'bt_calculate'],
            'technician': ['read', 'write', 'export_dxf', 'bt_calculate'],
            'viewer': ['read'],
            'guest': []
        };

        const userPermissions = permissionsMap[userRole] || [];

        if (userPermissions.includes(requiredPermission) || userPermissions.includes('admin')) {
            logger.info('Permission granted', { userId, requiredPermission, requestId });
            return next();
        }

        logger.warn('Permission denied', { userId, requiredPermission, requestId, path: req.path });
        
        return next(createError.authorization(`Missing required permission: ${requiredPermission}`, {
            required: requiredPermission,
            provided: userRole
        }));
    };
};
