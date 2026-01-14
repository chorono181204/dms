import { Role } from '../config/roles';
import Joi from 'joi';
// import { password } from './custom.validation';

const createUser = {
  body: Joi.object().keys({
    username: Joi.string().required(),
    password: Joi.string().required(),
    name: Joi.string().required(),
    role: Joi.string().required().valid(Role.USER, Role.MANAGER, Role.ADMIN),
    departmentId: Joi.number().integer().required(),
    position: Joi.string().allow(null, '')
  })
};

const getUsers = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    departmentId: Joi.number().integer(), // Allow departmentId for filtering (injected by scope or manually passed)
  })
};

const getUser = {
  params: Joi.object().keys({
    userId: Joi.number().integer()
  })
};

const updateUser = {
  params: Joi.object().keys({
    userId: Joi.number().integer()
  }),
  body: Joi.object()
    .keys({
      username: Joi.string(),
      password: Joi.string(),
      name: Joi.string(),
      role: Joi.string(),
      departmentId: Joi.number().integer(),
      position: Joi.string().allow(null, '')
    })
    .min(1)
};

const updateProfile = {
  body: Joi.object()
    .keys({
      name: Joi.string(),
      phone: Joi.string().allow(null, ''),
      password: Joi.string(), // Allow updating password here if desired, or separate flow
      // Explicitly forbidding username, role, departmentId, isEmailVerified to prevent privilege escalation or identity change
      username: Joi.forbidden(),
      role: Joi.forbidden(),
      departmentId: Joi.forbidden(),
      isEmailVerified: Joi.forbidden()
    })
    .min(1)
};

const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.number().integer()
  })
};

export default {
  createUser,
  getUsers,
  getUser,
  updateUser,
  updateProfile,
  deleteUser
};
