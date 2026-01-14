import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import prisma from '../../src/client';
import { Prisma } from '@prisma/client';
import { Role } from '../../src/config/roles';

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

export const userOne = {
  name: faker.name.fullName(),
  username: faker.internet.userName().toLowerCase(),
  password: hashedPassword,
  role: Role.USER,
  isEmailVerified: true
};

export const userTwo = {
  name: faker.name.fullName(),
  username: faker.internet.userName().toLowerCase(),
  password: hashedPassword,
  role: Role.USER,
  isEmailVerified: true
};

export const admin = {
  name: faker.name.fullName(),
  username: faker.internet.userName().toLowerCase(),
  password: hashedPassword,
  role: Role.ADMIN,
  isEmailVerified: true
};

export const insertUsers = async (users: Prisma.UserCreateInput[]) => {
  await Promise.all(
    users.map((user) => {
      // Ensure role is cast correctly if needed, or rely on type match
      return prisma.user.create({ data: user });
    })
  );
};
