import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login with correct params', async () => {
      mockAuthService.login.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'user' },
      });

      const result = await controller.login({
        email: 'test@test.com',
        password_raw: 'password123',
        guest_id: 'guest-1',
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'test@test.com',
        'password123',
        'guest-1',
      );
      expect(result.access_token).toBe('token');
    });
  });

  describe('refreshToken', () => {
    it('should call authService.refreshToken', async () => {
      mockAuthService.refreshToken.mockResolvedValue({
        access_token: 'new-token',
        refresh_token: 'refresh-id',
      });

      const result = await controller.refreshToken({
        refresh_token: 'valid-token',
      });

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-token');
      expect(result.access_token).toBe('new-token');
    });
  });
});
