import request from 'supertest';
import httpStatus from 'http-status';
import httpMocks from 'node-mocks-http';
import moment from 'moment';
import app from '../../src/app';
import config from '../../src/config/config';
import auth from '../../src/middlewares/auth';
import { tokenService } from '../../src/services';
import { logResponse } from '../utils/responseLogger';
import ApiError from '../../src/utils/ApiError';
import setupTestDB from '../utils/setupTestDb';
import { describe, test, expect, jest } from '@jest/globals';
import { userOne, insertUsers } from '../fixtures/user.fixture';
import { User } from '@prisma/client';
import { TokenType } from '../../src/config/tokens';
import prisma from '../../src/client';

setupTestDB();

describe('Auth routes', () => {
  describe('POST /v1/auth/login', () => {
    test('should return 200 and login user if username and password match', async () => {
      await insertUsers([userOne]);
      const dbUser = await prisma.user.findFirst({ where: { username: userOne.username } });
      const loginCredentials = {
        username: userOne.username,
        password: 'password1'
      };

      const res = await request(app)
        .post('/v1/auth/login')
        .send(loginCredentials)
        .expect(httpStatus.OK);

      expect(res.body.user).toMatchObject({
        id: expect.anything(),
        name: userOne.name,
        username: userOne.username,
        role: userOne.role,
        isEmailVerified: userOne.isEmailVerified
      });

      expect(res.body.user).toEqual(expect.not.objectContaining({ password: expect.anything() }));

      expect(res.body.tokens).toEqual({
        access: { token: expect.anything(), expires: expect.anything() }
      });
      logResponse('auth', '/v1/auth/login', 'POST', res.body);
    });

    test('should return 401 error if there are no users with that username', async () => {
      const loginCredentials = {
        username: userOne.username,
        password: userOne.password
      };

      const res = await request(app)
        .post('/v1/auth/login')
        .send(loginCredentials)
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({
        code: httpStatus.UNAUTHORIZED,
        message: 'Incorrect username or password'
      });
    });

    test('should return 401 error if password is wrong', async () => {
      await insertUsers([userOne]);
      const loginCredentials = {
        username: userOne.username,
        password: 'wrongPassword1'
      };

      const res = await request(app)
        .post('/v1/auth/login')
        .send(loginCredentials)
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body).toEqual({
        code: httpStatus.UNAUTHORIZED,
        message: 'Incorrect username or password'
      });
    });
  });
});

describe('Auth middleware', () => {
  test('should call next with no errors if access token is valid', async () => {
    await insertUsers([userOne]);
    const dbUserOne = (await prisma.user.findFirst({ where: { username: userOne.username } })) as User;
    const userOneAccessToken = tokenService.generateToken(
      dbUserOne.id,
      moment().add(config.jwt.accessExpirationMinutes, 'minutes'),
      TokenType.ACCESS
    );
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${userOneAccessToken}` }
    });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
    expect((req.user as User).id).toEqual(dbUserOne.id);
  });

  test('should call next with unauthorized error if access token is not found in header', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest();
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Please authenticate'
      })
    );
  });

  test('should call next with unauthorized error if access token is not a valid jwt token', async () => {
    await insertUsers([userOne]);
    const req = httpMocks.createRequest({ headers: { Authorization: 'Bearer randomToken' } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Please authenticate'
      })
    );
  });

  test('should call next with unauthorized error if access token is generated with an invalid secret', async () => {
    await insertUsers([userOne]);
    const dbUserOne = (await prisma.user.findFirst({ where: { username: userOne.username } })) as User;
    const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = tokenService.generateToken(
      dbUserOne.id,
      expires,
      TokenType.ACCESS,
      'invalidSecret'
    );
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Please authenticate'
      })
    );
  });

  test('should call next with unauthorized error if access token is expired', async () => {
    await insertUsers([userOne]);
    const dbUserOne = (await prisma.user.findFirst({ where: { username: userOne.username } })) as User;
    const expires = moment().subtract(1, 'minutes');
    const accessToken = tokenService.generateToken(dbUserOne.id, expires, TokenType.ACCESS);
    const req = httpMocks.createRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Please authenticate'
      })
    );
  });

  test('should call next with unauthorized error if user is not found', async () => {
    const userOneAccessToken = tokenService.generateToken(
      2000,
      moment().add(config.jwt.accessExpirationMinutes, 'minutes'),
      TokenType.ACCESS
    );
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${userOneAccessToken}` }
    });
    const next = jest.fn();

    await auth()(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: httpStatus.UNAUTHORIZED,
        message: 'Please authenticate'
      })
    );
  });

  test('should call next with forbidden error if user does not have required rights and userId is not in params', async () => {
    await insertUsers([userOne]);
    const dbUserOne = (await prisma.user.findFirst({ where: { username: userOne.username } })) as User;
    const userOneAccessToken = tokenService.generateToken(
      dbUserOne.id,
      moment().add(config.jwt.accessExpirationMinutes, 'minutes'),
      TokenType.ACCESS
    );
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${userOneAccessToken}` }
    });
    const next = jest.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: httpStatus.FORBIDDEN, message: 'Forbidden' })
    );
  });

  test('should call next with no errors if user does not have required rights but userId is in params', async () => {
    await insertUsers([userOne]);
    const dbUserOne = (await prisma.user.findFirst({ where: { username: userOne.username } })) as User;
    const userOneAccessToken = tokenService.generateToken(
      dbUserOne.id,
      moment().add(config.jwt.accessExpirationMinutes, 'minutes'),
      TokenType.ACCESS
    );
    const req = httpMocks.createRequest({
      headers: { Authorization: `Bearer ${userOneAccessToken}` },
      params: { userId: dbUserOne.id }
    });
    const next = jest.fn();

    await auth('anyRight')(req, httpMocks.createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
