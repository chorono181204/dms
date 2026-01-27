import Joi from 'joi';

const createTask = {
    body: Joi.object().keys({
        title: Joi.string().required(),
        description: Joi.string().allow('', null),
        priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT'),
        status: Joi.string().valid('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'),
        assigneeId: Joi.number().allow(null),
        assignerId: Joi.number().optional(), // Usually from auth
        departmentId: Joi.number().allow(null),
        dueDate: Joi.date().allow(null),
        files: Joi.any() // Handled by multer handling
    })
};

const getTasks = {
    query: Joi.object().keys({
        filter: Joi.string().valid('all', 'assigned', 'created', 'department'),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer()
    })
};

const updateTask = {
    params: Joi.object().keys({
        taskId: Joi.string().required() // usually number but route param is string
    }),
    body: Joi.object().keys({
        title: Joi.string(),
        description: Joi.string().allow('', null),
        priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT'),
        status: Joi.string().valid('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'),
        assigneeId: Joi.number().allow(null),
        dueDate: Joi.date().allow(null),
        files: Joi.any()
    })
};

const updateTaskStatus = {
    params: Joi.object().keys({
        taskId: Joi.string().required()
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE').required()
    })
};

const deleteTask = {
    params: Joi.object().keys({
        taskId: Joi.string().required()
    })
};

export default {
    createTask,
    getTasks,
    updateTask,
    updateTaskStatus,
    deleteTask
};
