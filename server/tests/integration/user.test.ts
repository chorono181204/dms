import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../src/app';
import setupTestDB from '../utils/setupTestDb';
import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { admin, userOne, insertUsers } from '../fixtures/user.fixture';
import { tokenService } from '../../src/services';
import { logResponse } from '../utils/responseLogger';
import { faker } from '@faker-js/faker';
import prisma from '../../src/client';

setupTestDB();

describe('User routes', () => {
    describe('POST /v1/users', () => {
        let adminAccessToken: string;

        beforeEach(async () => {
            await insertUsers([admin]);
            const res = await request(app)
                .post('/v1/auth/login')
                .send({ username: admin.username, password: 'password1' });
            adminAccessToken = res.body.tokens.access.token;
        });

        test('should return 201 and successfully create new user if data is ok', async () => {
            const newUser = {
                name: faker.name.fullName(),
                username: faker.internet.userName().toLowerCase(),
                password: 'password1',
                role: 'USER',
            };

            const res = await request(app)
                .post('/v1/users')
                .set('Authorization', `Bearer ${adminAccessToken}`)
                .send(newUser)
                .expect(httpStatus.CREATED);

            expect(res.body).toEqual({
                id: expect.anything(),
                name: newUser.name,
                username: newUser.username,
                password: expect.anything(),
                role: newUser.role,
                isEmailVerified: true,
                departmentId: null,
                createdAt: expect.anything(),
                updatedAt: expect.anything()
            });

            logResponse('user', '/v1/users', 'POST', res.body);
        });

        test('should return 400 if username is missing', async () => {
            const newUser = {
                name: faker.name.fullName(),
                password: 'password1',
                role: 'USER',
            };

            await request(app)
                .post('/v1/users')
                .set('Authorization', `Bearer ${adminAccessToken}`)
                .send(newUser)
                .expect(httpStatus.BAD_REQUEST);
        });
    });
});
