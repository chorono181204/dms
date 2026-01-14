import jwt from 'jsonwebtoken';
import moment, { Moment } from 'moment';
import httpStatus from 'http-status';
import config from '../config/config';
import userService from './user.service';
import ApiError from '../utils/ApiError';
// import { Token } from '@prisma/client';
import { TokenType } from '../config/tokens';
import prisma from '../client';
import { AuthTokensResponse } from '../types/response';

/**
 * Generate token
 * @param {number} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (
  userId: number,
  expires: Moment,
  type: TokenType,
  secret = config.jwt.secret
): string => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a token
 * @param {string} token
 * @param {number} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<Token>}
 */
const saveToken = async (
  token: string,
  userId: number,
  expires: Moment,
  type: TokenType,
  blacklisted = false
): Promise<void> => {
  // DB Token storage removed per user request
  return;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Token>}
 */
const verifyToken = async (token: string, type: TokenType): Promise<any> => {
  const payload = jwt.verify(token, config.jwt.secret) as any;
  const userId = Number(payload.sub);
  // No DB check
  return { token, userId, type, blacklisted: false, expires: moment.unix(payload.exp as number).toDate() };
};

/**
 * Generate auth tokens
 * @param {User} user
 * @returns {Promise<AuthTokensResponse>}
 */
const generateAuthTokens = async (user: { id: number }): Promise<AuthTokensResponse> => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, TokenType.ACCESS);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate()
    }
  };
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
const generateResetPasswordToken = async (username: string): Promise<string> => {
  const user = await userService.getUserByUsername(username);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this username');
  }
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(user.id as number, expires, TokenType.RESET_PASSWORD);
  // await saveToken(resetPasswordToken, user.id as number, expires, TokenType.RESET_PASSWORD);
  return resetPasswordToken;
};

/**
 * Generate verify email token
 * @param {User} user
 * @returns {Promise<string>}
 */
const generateVerifyEmailToken = async (user: { id: number }): Promise<string> => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.id, expires, TokenType.VERIFY_EMAIL);
  // await saveToken(verifyEmailToken, user.id, expires, TokenType.VERIFY_EMAIL);
  return verifyEmailToken;
};

export default {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken
};
