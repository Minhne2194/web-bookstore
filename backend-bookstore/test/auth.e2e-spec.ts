import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// ─────────────────────────────────────────────────────────
// Integration Test — Auth API
// ─────────────────────────────────────────────────────────

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;

  const mockAuthService = {
    login: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // POST /auth/login
  // ─────────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('should login successfully and return tokens', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        user: {
          id: '1',
          email: 'test@test.com',
          name: 'Test User',
          role: 'user',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@test.com', password_raw: 'password123' })
        .expect(201);

      expect(response.body.access_token).toBe('jwt-token');
      expect(response.body.refresh_token).toBe('refresh-token');
      expect(response.body.user.email).toBe('test@test.com');
      expect(mockAuthService.login).toHaveBeenCalledWith(
        'test@test.com',
        'password123',
        undefined,
      );
    });

    it('should pass guest_id for cart merging', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'user' },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password_raw: 'password123',
          guest_id: 'guest:abc123',
        })
        .expect(201);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'test@test.com',
        'password123',
        'guest:abc123',
      );
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Email hoặc mật khẩu không đúng!'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'wrong@test.com', password_raw: 'wrongpassword' })
        .expect(401);

      expect(response.body.message).toContain('không đúng');
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /auth/refresh
  // ─────────────────────────────────────────────────────────
  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      mockAuthService.refreshToken.mockResolvedValue({
        access_token: 'new-jwt-token',
        refresh_token: 'refresh-token-id',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'valid-refresh-token' })
        .expect(201);

      expect(response.body.access_token).toBe('new-jwt-token');
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
    });

    it('should return 401 for invalid refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });

    it('should return 401 for expired refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Refresh token expired'),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'expired-token' })
        .expect(401);

      expect(response.body.message).toContain('expired');
    });
  });
});
