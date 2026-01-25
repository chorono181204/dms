import httpStatus from 'http-status';
import tokenService from './token.service';
import userService from './user.service';
import ApiError from '../utils/ApiError';
import { User } from '@prisma/client';
import { TokenType } from '../config/tokens';
import prisma from '../client';
import { encryptPassword, isPasswordMatch } from '../utils/encryption';
import { AuthTokensResponse } from '../types/response';
import exclude from '../utils/exclude';

/**
 * Login with username and password
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Omit<User, 'password'>>}
 */
const loginUserWithUsernameAndPassword = async (
  username: string,
  password: string
): Promise<Omit<User, 'password'>> => {
  const user = await userService.getUserByUsername(username, [
    'id',
    'username',
    'name',
    'password',
    'role',
    'isEmailVerified',

    'departmentId',
    'createdBy',
    'updatedBy',
    'signatureImage',
    'digitalCert',
    'phone',
    'position',
    'isChief'
  ]);
  if (!user || !(await isPasswordMatch(password, user.password as string))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect username or password');
  }
  return exclude(user, ['password']);
};

/**
 * Change password
 * @param {number} userId
 * @param {string} newPassword
 * @returns {Promise<User>}
 */
const changePassword = async (userId: number, newPassword: string): Promise<User> => {
  const user = await userService.getUserById(userId, ['id', 'password', 'name', 'username']);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  // Simplified: No old password check required per user request
  const encryptedPassword = await encryptPassword(newPassword);
  const updatedUser = await userService.updateUserById(userId, { password: encryptedPassword });
  return updatedUser as User;
};

export default {
  loginUserWithUsernameAndPassword,
  changePassword,
  isPasswordMatch,
  encryptPassword
};
