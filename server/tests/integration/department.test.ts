import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../src/app';
import setupTestDB from '../utils/setupTestDb';
import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { admin, userOne, insertUsers } from '../fixtures/user.fixture';
import { tokenService } from '../../src/services';
import { faker } from '@faker-js/faker';

import prisma from '../../src/client';

setupTestDB();

describe('Department routes', () => {
    describe('POST /v1/departments', () => {
        let adminAccessToken: string;

        beforeEach(async () => {
            await insertUsers([admin, userOne]);
            const res = await request(app)
                .post('/v1/auth/login')
                .send({ username: admin.username, password: 'password1' });
            adminAccessToken = res.body.tokens.access.token;
        });

        test('should return 201 and successfully create new department if data is ok', async () => {
            const newDepartment = {
                name: faker.commerce.department(),
                code: faker.random.alphaNumeric(5).toUpperCase()
            };

            const res = await request(app)
                .post('/v1/departments')
                .set('Authorization', `Bearer ${adminAccessToken}`)
                .send(newDepartment)
                .expect(httpStatus.CREATED);

            expect(res.body).toEqual({
                id: expect.anything(),
                name: newDepartment.name,
                code: newDepartment.code,
                createdAt: expect.anything(),
                updatedAt: expect.anything()
            });
        });

        test('should return 401 error if access token is missing', async () => {
            const newDepartment = {
                name: faker.commerce.department(),
                code: faker.random.alphaNumeric(5).toUpperCase()
            };

            await request(app)
                .post('/v1/departments')
                .send(newDepartment)
                .expect(httpStatus.UNAUTHORIZED);
        });

        test('should return 403 error if user is not admin', async () => {
            const res = await request(app)
                .post('/v1/auth/login')
                .send({ username: userOne.username, password: 'password1' });
            const userAccessToken = res.body.tokens.access.token;

            const newDepartment = {
                name: faker.commerce.department(),
                code: faker.random.alphaNumeric(5).toUpperCase()
            };

            await request(app)
                .post('/v1/departments')
                .set('Authorization', `Bearer ${userAccessToken}`)
                .send(newDepartment)
                .expect(httpStatus.FORBIDDEN);
        });
    });

    describe('GET /v1/departments', () => {
        let adminAccessToken: string;

        beforeEach(async () => {
            await insertUsers([admin]);
            const res = await request(app)
                .post('/v1/auth/login')
                .send({ username: admin.username, password: 'password1' });
            adminAccessToken = res.body.tokens.access.token;
        });

        test('should return 200 and apply the default query options', async () => {
            await request(app)
                .get('/v1/departments')
                .set('Authorization', `Bearer ${adminAccessToken}`)
                .expect(httpStatus.OK);
        });
    });
});
