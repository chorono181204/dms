import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const envVars = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: 3000,
  JWT_SECRET: 'secret',
  JWT_ACCESS_EXPIRATION_MINUTES: 43200,
  JWT_REFRESH_EXPIRATION_DAYS: 30,
  JWT_RESET_PASSWORD_EXPIRATION_MINUTES: 10,
  JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: 10,
  SMTP_HOST: 'smtp.ethereal.email',
  SMTP_PORT: 587,
  SMTP_USERNAME: 'demo@demo.com',
  SMTP_PASSWORD: 'password',
  EMAIL_FROM: 'support@yourapp.com'
};

export default {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD
      }
    },
    from: envVars.EMAIL_FROM
  }
};
