import { User, Prisma } from '@prisma/client';
import { Role } from '../config/roles';
import httpStatus from 'http-status';
import prisma from '../client';
import ApiError from '../utils/ApiError';
import { encryptPassword } from '../utils/encryption';

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (
  username: string,
  password: string,
  name: string,
  role: string,
  departmentId?: number,
  createdBy?: string,
  position?: string
): Promise<User> => {
  if (await getUserByUsername(username)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Username already taken');
  }
  return prisma.user.create({
    data: {
      username,
      name,
      password: await encryptPassword(password),
      role,
      departmentId,
      createdBy,
      updatedBy: createdBy, // Initial updatedBy same as createdBy
      position,
    }
  });
};

/**
 * Query for users
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async <Key extends keyof User>(
  filter: any, // changed to any to allow manipulation
  options: {
    limit?: number;
    page?: number;
    sortBy?: string;
    sortType?: 'asc' | 'desc';
  },
  keys: Key[] = [
    'id',
    'username',
    'name',
    'password',
    'role',
    'isEmailVerified',
    'departmentId',
    'phone',
    'createdBy',
    'updatedBy',
    'position',
    'signatureImage'
  ] as Key[]
): Promise<{
  results: Pick<User, Key>[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}> => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const sortBy = options.sortBy;
  const sortType = options.sortType ?? 'desc';

  // Soft delete filter removed
  // const activeFilter = { ...filter, deletedAt: null };

  const [users, totalResults] = await Promise.all([
    prisma.user.findMany({
      where: filter,
      select: (() => {
        const select: any = {
          department: { select: { id: true, name: true, code: true } }
        };
        keys.forEach(k => { select[k] = true; });
        return select;
      })(),
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sortBy ? { [sortBy]: sortType } : undefined
    }),
    prisma.user.count({ where: filter })
  ]);

  const totalPages = Math.ceil(totalResults / limit);

  return {
    results: users as unknown as Pick<User, Key>[],
    page,
    limit,
    totalPages,
    totalResults
  };
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @param {Array<Key>} keys
 * @returns {Promise<Pick<User, Key> | null>}
 */
const getUserById = async <Key extends keyof User>(
  id: number,
  keys: Key[] = [
    'id',
    'username',
    'name',
    'password',
    'role',
    'isEmailVerified',
    'departmentId',
    'phone',
    'createdBy',
    'updatedBy',
    'position',
    'signatureImage'
  ] as Key[]
): Promise<Pick<User, Key> | null> => {
  const select: any = {
    department: { select: { id: true, name: true, code: true } }
  };
  keys.forEach(k => { select[k] = true; });

  return prisma.user.findFirst({
    where: { id },
    select: select
  }) as unknown as Promise<Pick<User, Key> | null>;
};

/**
 * Get user by username
 * @param {string} username
 * @param {Array<Key>} keys
 * @returns {Promise<Pick<User, Key> | null>}
 */
const getUserByUsername = async <Key extends keyof User>(
  username: string,
  keys: Key[] = [
    'id',
    'username',
    'name',
    'password',
    'role',
    'isEmailVerified',
    'departmentId',
    'phone',
    'createdBy',
    'updatedBy',
    'position',
    'signatureImage'
  ] as Key[]
): Promise<Pick<User, Key> | null> => {
  const select: any = {
    department: { select: { id: true, name: true, code: true } }
  };
  keys.forEach(k => { select[k] = true; });

  return prisma.user.findFirst({
    where: { username },
    select: select
  }) as unknown as Promise<Pick<User, Key> | null>;
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async <Key extends keyof User>(
  userId: number,
  updateBody: Prisma.UserUpdateInput,
  keys: Key[] = ['id', 'username', 'name', 'role', 'departmentId', 'phone', 'createdBy', 'updatedBy', 'position'] as Key[]
): Promise<Pick<User, Key> | null> => {
  const user = await getUserById(userId, ['id', 'username', 'name']);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.username) {
    const existingUser = await getUserByUsername(updateBody.username as string);
    if (existingUser && existingUser.id !== userId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Username already taken');
    }
  }
  const select: any = {
    department: { select: { id: true, name: true, code: true } }
  };
  keys.forEach(k => { select[k] = true; });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateBody,
    select: select
  });
  return updatedUser as unknown as Pick<User, Key> | null;
};

/**
 * Delete user by id (Soft Delete)
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId: number): Promise<User> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Hard delete
  await prisma.user.delete({
    where: { id: user.id }
  });

  return user as User;
};

export default {
  createUser,
  queryUsers,
  getUserById,
  getUserByUsername,
  updateUserById,
  deleteUserById
};
