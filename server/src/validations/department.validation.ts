import Joi from 'joi';

const createDepartment = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        code: Joi.string().required()
    })
};

const getDepartments = {
    query: Joi.object().keys({
        name: Joi.string(),
        code: Joi.string(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer()
    })
};

const getDepartment = {
    params: Joi.object().keys({
        departmentId: Joi.number().integer().required()
    })
};

const updateDepartment = {
    params: Joi.object().keys({
        departmentId: Joi.number().integer().required()
    }),
    body: Joi.object()
        .keys({
            name: Joi.string(),
            code: Joi.string()
        })
        .min(1)
};

const deleteDepartment = {
    params: Joi.object().keys({
        departmentId: Joi.number().integer().required()
    })
};

export default {
    createDepartment,
    getDepartments,
    getDepartment,
    updateDepartment,
    deleteDepartment
};
