import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let emailService: EmailService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userProfile: {
      upsert: jest.fn(),
    },
  };

  const mockEmailService = {
    sendWelcomeEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ user_id: '1', email: 'test@test.com' });

      await expect(
        service.create({ email: 'test@test.com', password_raw: '123456' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
    });

    it('should create a user, hash password and send welcome email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockPrismaService.user.create.mockResolvedValue({
        user_id: '1',
        email: 'test@test.com',
        full_name: 'Test User',
      });
      mockEmailService.sendWelcomeEmail.mockResolvedValue(true);

      const result = await service.create({ email: 'test@test.com', password_raw: '123456', full_name: 'Test User' });

      expect(result).toEqual({ user_id: '1', email: 'test@test.com', full_name: 'Test User' });
      expect(argon2.hash).toHaveBeenCalledWith('123456');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@test.com',
          password_hash: 'hashed_password',
          full_name: 'Test User',
        },
        select: {
          user_id: true,
          email: true,
          full_name: true,
          role: true,
          created_at: true,
        },
      });
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith('test@test.com', 'Test User');
    });
  });

  describe('updateProfile', () => {
    it('should update user and upsert profile', async () => {
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.userProfile.upsert.mockResolvedValue({});
      
      // mock getProfile to avoid actual database call within it
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@test.com',
        full_name: 'Updated Name',
        phone: '0123456789',
        profile: { gender: 'male', birthday: new Date('2000-01-01') }
      });

      const result = await service.updateProfile('1', {
        full_name: 'Updated Name',
        phone: '0123456789',
        gender: 'male',
        birthday: '2000-01-01',
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { user_id: '1' },
        data: { full_name: 'Updated Name', phone: '0123456789' },
      });
      expect(mockPrismaService.userProfile.upsert).toHaveBeenCalledWith({
        where: { user_id: '1' },
        create: { user_id: '1', gender: 'male', birthday: new Date('2000-01-01') },
        update: { gender: 'male', birthday: new Date('2000-01-01') },
      });
      expect(result).toEqual({
        email: 'test@test.com',
        full_name: 'Updated Name',
        phone: '0123456789',
        gender: 'male',
        birthday: new Date('2000-01-01'),
      });
    });
  });
});
