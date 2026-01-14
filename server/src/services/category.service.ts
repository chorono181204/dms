import { Category, Prisma } from '@prisma/client';
import prisma from '../client';

/**
 * Create a category
 * @param {Object} categoryBody
 * @returns {Promise<Category>}
 */
const createCategory = async (categoryBody: any): Promise<Category> => {
    return prisma.category.create({
        data: categoryBody,
    });
};

/**
 * Query for categories
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryCategories = async (filter: any, options: any) => {
    const page = options.page ? parseInt(options.page, 10) : 1;
    const limit = options.limit ? parseInt(options.limit, 10) : 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (filter.name) {
        where.name = { contains: filter.name };
    }
    if (filter.isActive !== undefined) {
        where.isActive = filter.isActive === 'true' || filter.isActive === true;
    }
    if (filter.departmentId) {
        where.departmentId = parseInt(filter.departmentId);
    }

    const [categories, total] = await Promise.all([
        prisma.category.findMany({
            where,
            skip,
            take: limit,
            orderBy: options.sortBy ? { [options.sortBy.split(':')[0]]: options.sortBy.split(':')[1] } : { createdAt: 'desc' },
            include: { department: true } // Include department info
        }),
        prisma.category.count({ where })
    ]);

    return {
        results: categories,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
    };
};

/**
 * Get category by id
 * @param {number} id
 * @returns {Promise<Category | null>}
 */
const getCategoryById = async (id: number | string): Promise<Category | null> => {
    return prisma.category.findUnique({
        where: { id: typeof id === 'string' ? parseInt(id) : id },
    });
};

/**
 * Update category by id
 * @param {number} categoryId
 * @param {Object} updateBody
 * @returns {Promise<Category>}
 */
const updateCategoryById = async (categoryId: number | string, updateBody: any): Promise<Category> => {
    const id = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
    const category = await getCategoryById(id);
    if (!category) {
        throw new Error('Category not found');
    }
    return prisma.category.update({
        where: { id },
        data: updateBody,
    });
};

/**
 * Delete category by id
 * @param {number} categoryId
 * @returns {Promise<Category>}
 */
const deleteCategoryById = async (categoryId: number | string): Promise<Category> => {
    const id = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
    const category = await getCategoryById(id);
    if (!category) {
        throw new Error('Category not found');
    }
    // Check if documents use this category?
    // Prisma will likely throw foreign key constraint if restrict.
    // Or if on delete set null? Schema didn't specify. Default is usually restrict.
    // We should probably check or handle error.

    return prisma.category.delete({
        where: { id },
    });
};

export default {
    createCategory,
    queryCategories,
    getCategoryById,
    updateCategoryById,
    deleteCategoryById,
};
