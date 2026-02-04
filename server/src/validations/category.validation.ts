import Joi from 'joi';

const createCategory = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string().allow('', null),
        isActive: Joi.boolean(),
        departmentId: Joi.number().allow(null), // Keep for backward compatibility if needed, or remove
        isGlobal: Joi.boolean(),

        departmentIds: Joi.array().items(Joi.number()),
        parentId: Joi.number().integer().allow(null),
        isTemplate: Joi.boolean(), // Allow isTemplate
    }),
};

const getCategories = {
    query: Joi.object().keys({
        name: Joi.string(),
        isActive: Joi.boolean(),
        departmentId: Joi.number(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
        parentId: Joi.alternatives().try(Joi.number().integer(), Joi.string().valid('null')),
    }),
};

const getCategory = {
    params: Joi.object().keys({
        categoryId: Joi.number().integer().required(),
    }),
};

const updateCategory = {
    params: Joi.object().keys({
        categoryId: Joi.number().integer().required(),
    }),
    body: Joi.object()
        .keys({
            name: Joi.string(),
            description: Joi.string().allow('', null),
            isActive: Joi.boolean(),
            departmentId: Joi.number().allow(null),
            isGlobal: Joi.boolean(),
            departmentIds: Joi.array().items(Joi.number()),
            parentId: Joi.number().integer().allow(null),
            isTemplate: Joi.boolean(), // Allow isTemplate
        })
        .min(1),
};

const deleteCategory = {
    params: Joi.object().keys({
        categoryId: Joi.number().integer().required(),
    }),
};

export default {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory,
};
