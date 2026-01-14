import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';
import { Role } from '../config/roles';

/**
 * Middleware to scope request to user's department
 * Usage: Apply after 'auth' middleware
 */
export const scopeDepartment = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    // 1. Must be authenticated
    if (!user) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required for department scoping'));
    }

    // 2. ADMIN has access to everything -> No filter
    if (user.role === Role.ADMIN) {
        return next();
    }

    // 3. Check if user belongs to a department
    if (!user.departmentId) {
        return next(new ApiError(httpStatus.FORBIDDEN, 'User is not assigned to any department'));
    }

    // 4. Attach filter to request
    // Controllers/Services can use this filter in Prisma queries: where: { ...req.departmentFilter }
    (req as any).departmentFilter = {
        departmentId: user.departmentId
    };

    next();
};
