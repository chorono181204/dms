import { Request, Response, NextFunction } from 'express';
import { Role } from '../config/roles';

/**
 * Middleware to restrict query/body to the user's department
 * @param {string} source - 'query' or 'body' or 'all'
 */
const scopeDepartment = (source: 'query' | 'body' | 'all' = 'query') => (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;

    // Only apply to MANAGERS (Admins see all, Users usually see only themselves or handled elsewhere)
    if (user && user.role === Role.MANAGER && user.departmentId) {
        if (source === 'query' || source === 'all') {
            req.query.departmentId = user.departmentId.toString();
        }
        if (source === 'body' || source === 'all') {
            req.body.departmentId = user.departmentId;
        }
    }
    next();
};

export default scopeDepartment;
