import Joi from 'joi';
import { password } from './custom.validation';



const login = {
  body: Joi.object().keys({
    username: Joi.string().required(),
    password: Joi.string().required()
  })
};





const changePassword = {
  body: Joi.object().keys({
    newPassword: Joi.string().required()
  })
};

export default {
  login,
  changePassword
};
