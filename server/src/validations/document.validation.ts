import Joi from 'joi';

const createDocument = {
    body: Joi.object().keys({
        title: Joi.string().required(),
        code: Joi.string().allow('', null),
        description: Joi.string().allow('', null),
        departmentId: Joi.number().required(),
        categoryId: Joi.number().allow(null),
        status: Joi.string().valid('DRAFT', 'PENDING', 'APPROVED', 'SIGNED', 'REJECTED', 'ARCHIVED').default('DRAFT'),
        visibility: Joi.string().valid('PRIVATE', 'DEPARTMENT', 'PUBLIC').default('PRIVATE'),
        accessLevel: Joi.string().valid('VIEW', 'EDIT').default('VIEW'),
    }).unknown(true),
};

const getDocuments = {
    query: Joi.object().keys({
        title: Joi.string(),
        code: Joi.string(),
        status: Joi.string(),
        departmentId: Joi.number(),
        categoryId: Joi.number(),
        createdBy: Joi.string(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getDocument = {
    params: Joi.object().keys({
        documentId: Joi.number().integer().required(),
    }),
};

const updateDocument = {
    params: Joi.object().keys({
        documentId: Joi.number().integer().required(),
    }),
    body: Joi.object()
        .keys({
            title: Joi.string(),
            code: Joi.string().allow('', null),
            description: Joi.string().allow('', null),
            status: Joi.string().valid('DRAFT', 'PENDING', 'APPROVED', 'SIGNED', 'REJECTED', 'ARCHIVED'),
            departmentId: Joi.number(),
            categoryId: Joi.number().allow(null),
            visibility: Joi.string().valid('PRIVATE', 'DEPARTMENT', 'PUBLIC'),
            accessLevel: Joi.string().valid('VIEW', 'EDIT'),
        })
        .min(1)
        .unknown(true),
};

const deleteDocument = {
    params: Joi.object().keys({
        documentId: Joi.number().integer().required(),
    }),
};

export default {
    createDocument,
    getDocuments,
    getDocument,
    updateDocument,
    deleteDocument,
};
