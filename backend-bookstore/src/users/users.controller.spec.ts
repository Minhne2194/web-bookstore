import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
    getAddresses: jest.fn(),
    addAddress: jest.fn(),
    updateAddress: jest.fn(),
    deleteAddress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call usersService.create', async () => {
      mockUsersService.create.mockResolvedValue({
        user_id: '1',
        email: 'test@test.com',
      });

      const result = await controller.register({
        email: 'test@test.com',
        password_raw: '123456',
        full_name: 'Test',
      });

      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'test@test.com',
        password_raw: '123456',
        full_name: 'Test',
      });
      expect(result.user_id).toBe('1');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockReq = { user: { sub: 'user1' } };
      mockUsersService.getProfile.mockResolvedValue({
        email: 'test@test.com',
        full_name: 'Test User',
      });

      const result = await controller.getProfile(mockReq);

      expect(result.email).toBe('test@test.com');
      expect(mockUsersService.getProfile).toHaveBeenCalledWith('user1');
    });
  });

  describe('updateProfile', () => {
    it('should update and return profile', async () => {
      const mockReq = { user: { sub: 'user1' } };
      mockUsersService.updateProfile.mockResolvedValue({
        full_name: 'Updated',
        phone: '0123456789',
      });

      const result = await controller.updateProfile(mockReq, {
        full_name: 'Updated',
        phone: '0123456789',
      });

      expect(result.full_name).toBe('Updated');
    });
  });

  describe('getAddresses', () => {
    it('should return user addresses', async () => {
      const mockReq = { user: { sub: 'user1' } };
      mockUsersService.getAddresses.mockResolvedValue([
        { address_id: 'addr1', province: 'HCM' },
      ]);

      const result = await controller.getAddresses(mockReq);

      expect(result).toHaveLength(1);
    });
  });
});
