import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../src/app';
import prisma from '../../src/client';
import { tokenService } from '../../src/services';
import { logResponse } from '../utils/responseLogger';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Pagination Integration Tests', () => {
    let adminAccessToken: string;

    beforeAll(async () => {
        // 1. Get an Admin user from seeded data
        const admin = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
        });

        if (!admin) {
            throw new Error('No ADMIN user found. Please run seed first.');
        }

        // 2. Generate token
        const tokens = await tokenService.generateAuthTokens(admin);
        adminAccessToken = tokens.access.token;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    test('GET /v1/users?page=1&limit=10 should return first page', async () => {
        const res = await request(app)
            .get('/v1/users')
            .set('Authorization', `Bearer ${adminAccessToken}`)
            .query({ page: 1, limit: 10 })
            .expect(httpStatus.OK);

        // Verify Structure
        expect(res.body).toHaveProperty('results');
        expect(res.body).toHaveProperty('page', 1);
        expect(res.body).toHaveProperty('limit', 10);
        expect(res.body).toHaveProperty('totalPages');
        expect(res.body).toHaveProperty('totalResults');

        // Verify Data
        expect(res.body.results.length).toBe(10);
        expect(res.body.totalResults).toBeGreaterThanOrEqual(20);
        expect(res.body.totalPages).toBeGreaterThanOrEqual(2);

        logResponse('pagination', '/v1/users?page=1&limit=10', 'GET', res.body);
    });

    test('GET /v1/users?page=2&limit=10 should return second page', async () => {
        const res = await request(app)
            .get('/v1/users')
            .set('Authorization', `Bearer ${adminAccessToken}`)
            .query({ page: 2, limit: 10 })
            .expect(httpStatus.OK);

        expect(res.body.page).toBe(2);
        expect(res.body.results.length).toBe(10);
        logResponse('pagination', '/v1/users?page=2&limit=10', 'GET', res.body);
    });
});
