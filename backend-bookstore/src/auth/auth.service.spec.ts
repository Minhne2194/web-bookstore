import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { CartService } from '../cart/cart.service';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockCartService = {
    mergeCart: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login('test@test.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        password_hash: 'hashed',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login('test@test.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should login successfully and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        user_id: '1',
        email: 'test@test.com',
        password_hash: 'hashed',
        full_name: 'Test',
        role: 'user',
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockCartService.mergeCart.mockResolvedValue(true);
      mockPrismaService.userSession.create.mockResolvedValue({
        session_id: 'refresh-token',
      });
      mockJwtService.signAsync.mockResolvedValue('access-token');

      const result = await service.login('test@test.com', 'password', 'guest-1');

      expect(mockCartService.mergeCart).toHaveBeenCalledWith('guest-1', '1');
      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          id: '1',
          email: 'test@test.com',
          name: 'Test',
          role: 'user',
        },
      });
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException if token invalid', async () => {
      mockPrismaService.userSession.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token expired', async () => {
      mockPrismaService.userSession.findUnique.mockResolvedValue({
        expires_at: new Date(Date.now() - 10000), // past
      });

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.userSession.deleteMany).toHaveBeenCalled();
    });

    it('should return new tokens', async () => {
      mockPrismaService.userSession.findUnique.mockResolvedValue({
        session_id: 'valid-refresh-token',
        expires_at: new Date(Date.now() + 10000), // future
        user: { user_id: '1', email: 'test@test.com', role: 'user' },
      });
      mockJwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'valid-refresh-token',
      });
      expect(mockPrismaService.userSession.update).toHaveBeenCalled();
    });
  });
});
