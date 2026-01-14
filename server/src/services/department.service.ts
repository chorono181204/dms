import { Department, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';

/**
 * Create a department
 * @param {Object} departmentBody
 * @returns {Promise<Department>}
 */
const createDepartment = async (departmentBody: Prisma.DepartmentCreateInput): Promise<Department> => {
    if (await prisma.department.findUnique({ where: { code: departmentBody.code } })) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Department code already taken');
    }
    return prisma.department.create({
        data: departmentBody
    });
};

/**
 * Query for departments
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryDepartments = async (
    filter: object,
    options: {
        limit?: number;
        page?: number;
        sortBy?: string;
        sortType?: 'asc' | 'desc';
    }
): Promise<{
    results: Department[];
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
}> => {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const sortBy = options.sortBy;
    const sortType = options.sortType ?? 'desc';

    const [departments, totalResults] = await Promise.all([
        prisma.department.findMany({
            where: filter,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: sortBy ? { [sortBy]: sortType } : undefined
        }),
        prisma.department.count({ where: filter })
    ]);

    const totalPages = Math.ceil(totalResults / limit);

    return {
        results: departments,
        page,
        limit,
        totalPages,
        totalResults
    };
};

/**
 * Get department by id
 * @param {number} id
 * @returns {Promise<Department | null>}
 */
const getDepartmentById = async (id: number): Promise<Department | null> => {
    return prisma.department.findUnique({
        where: { id }
    });
};

/**
 * Update department by id
 * @param {number} departmentId
 * @param {Object} updateBody
 * @returns {Promise<Department>}
 */
const updateDepartmentById = async (
    departmentId: number,
    updateBody: Prisma.DepartmentUpdateInput
): Promise<Department> => {
    const department = await getDepartmentById(departmentId);
    if (!department) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
    }
    if (updateBody.code && (await prisma.department.findUnique({ where: { code: updateBody.code as string } }))) {
        // Check if code is taken by another department
        const existingDepartment = await prisma.department.findUnique({ where: { code: updateBody.code as string } });
        if (existingDepartment && existingDepartment.id !== departmentId) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Department code already taken');
        }
    }
    const updatedDepartment = await prisma.department.update({
        where: { id: department.id },
        data: updateBody
    });
    return updatedDepartment;
};

/**
 * Delete department by id
 * @param {number} departmentId
 * @returns {Promise<Department>}
 */
const deleteDepartmentById = async (departmentId: number): Promise<Department> => {
    const department = await getDepartmentById(departmentId);
    if (!department) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
    }
    // Check relationships before delete
    const userCount = await prisma.user.count({ where: { departmentId: departmentId } });
    if (userCount > 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Không thể xóa khoa này vì đang có ${userCount} người dùng.`);
    }

    const documentCount = await prisma.document.count({ where: { departmentId: departmentId } });
    if (documentCount > 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Không thể xóa khoa này vì đang có ${documentCount} văn bản.`);
    }

    await prisma.department.delete({ where: { id: department.id } });
    return department;
};

export default {
    createDepartment,
    queryDepartments,
    getDepartmentById,
    updateDepartmentById,
    deleteDepartmentById
};
