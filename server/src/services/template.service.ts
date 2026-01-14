import { Template, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';

/**
 * Create a template
 * @param {Object} templateBody
 * @returns {Promise<Template>}
 */
const createTemplate = async (templateBody: Prisma.TemplateUncheckedCreateInput): Promise<Template> => {
    return prisma.template.create({
        data: templateBody
    });
};

/**
 * Query for templates
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryTemplates = async (
    filter: any,
    options: {
        limit?: number;
        page?: number;
        sortBy?: string;
        sortType?: 'asc' | 'desc';
    }
): Promise<any> => {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const sortBy = options.sortBy;
    const sortType = options.sortType ?? 'desc';

    const where: any = { ...filter };
    if (filter.departmentId) {
        where.departmentId = parseInt(filter.departmentId);
    }

    const [templates, totalResults] = await Promise.all([
        prisma.template.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: sortBy ? { [sortBy]: sortType } : { id: 'desc' },
            include: {
                department: {
                    select: { id: true, name: true }
                },
                category: {
                    select: { id: true, name: true }
                }
            }
        }),
        prisma.template.count({ where: filter })
    ]);

    const totalPages = Math.ceil(totalResults / limit);

    return {
        results: templates,
        page,
        limit,
        totalPages,
        totalResults
    };
};

/**
 * Get template by id
 * @param {number} id
 * @returns {Promise<Template | null>}
 */
const getTemplateById = async (id: number): Promise<Template | null> => {
    return prisma.template.findUnique({
        where: { id },
        include: {
            department: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } }
        }
    });
};

/**
 * Update template by id
 * @param {number} templateId
 * @param {Object} updateBody
 * @returns {Promise<Template>}
 */
const updateTemplateById = async (
    templateId: number,
    updateBody: Prisma.TemplateUncheckedUpdateInput
): Promise<Template> => {
    const template = await getTemplateById(templateId);
    if (!template) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Template not found');
    }
    const updatedTemplate = await prisma.template.update({
        where: { id: templateId },
        data: updateBody
    });
    return updatedTemplate;
};

/**
 * Delete template by id
 * @param {number} templateId
 * @returns {Promise<Template>}
 */
const deleteTemplateById = async (templateId: number): Promise<Template> => {
    const template = await getTemplateById(templateId);
    if (!template) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Template not found');
    }
    await prisma.template.delete({
        where: { id: templateId }
    });
    return template;
};

export default {
    createTemplate,
    queryTemplates,
    getTemplateById,
    updateTemplateById,
    deleteTemplateById
};
