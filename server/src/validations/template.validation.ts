import Joi from 'joi';

const createTemplate = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        content: Joi.string().allow(null, ''), // Optional, derived from file or input
        categoryId: Joi.number().integer(),
        category: Joi.string().allow(null, ''),
        isActive: Joi.any(), // FormData converts boolean to string 'true'/'false'
        departmentId: Joi.number().integer(),
    }).unknown(true) // Allow 'file' field from FormData
};

const getTemplates = {
    query: Joi.object().keys({
        name: Joi.string(),
        category: Joi.string(),
        isActive: Joi.boolean(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer()
    })
};

const getTemplate = {
    params: Joi.object().keys({
        templateId: Joi.number().integer().required()
    })
};

const updateTemplate = {
    params: Joi.object().keys({
        templateId: Joi.number().integer().required()
    }),
    body: Joi.object()
        .keys({
            name: Joi.string(),
            content: Joi.string().allow(null, ''),
            category: Joi.string().allow(null, ''),
            isActive: Joi.any(),
            departmentId: Joi.number().integer(),
        })
        .min(1)
        .unknown(true)
};

const deleteTemplate = {
    params: Joi.object().keys({
        templateId: Joi.number().integer().required()
    })
};

export default {
    createTemplate,
    getTemplates,
    getTemplate,
    updateTemplate,
    deleteTemplate
};
