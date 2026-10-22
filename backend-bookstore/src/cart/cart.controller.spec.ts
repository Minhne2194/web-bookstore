import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

describe('CartController', () => {
  let controller: CartController;

  const mockCartService = {
    getCart: jest.fn(),
    addToCart: jest.fn(),
    updateCartItem: jest.fn(),
    removeFromCart: jest.fn(),
    validatePromo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    })
      .overrideGuard(OptionalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CartController>(CartController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCart', () => {
    it('should call cartService.getCart with userId from request', async () => {
      const mockReq = { user: { sub: 'user1' }, headers: {} };
      mockCartService.getCart.mockResolvedValue({
        items: [{ bookId: 'b1', quantity: 1 }],
      });

      const result = await controller.getCart(mockReq);

      expect(mockCartService.getCart).toHaveBeenCalledWith('user1');
      expect(result.items).toHaveLength(1);
    });

    it('should use x-guest-id if no user', async () => {
      const mockReq = { headers: { 'x-guest-id': 'guest:abc' } };
      mockCartService.getCart.mockResolvedValue({ items: [] });

      const result = await controller.getCart(mockReq);

      expect(mockCartService.getCart).toHaveBeenCalledWith('guest:abc');
    });
  });

  describe('addToCart', () => {
    it('should call cartService.addToCart', async () => {
      const mockReq = { user: { sub: 'user1' }, headers: {} };
      mockCartService.addToCart.mockResolvedValue({
        items: [{ bookId: 'b1', quantity: 2 }],
      });

      const result = await controller.addToCart(mockReq, {
        bookId: 'b1',
        quantity: 2,
      });

      expect(mockCartService.addToCart).toHaveBeenCalledWith('user1', 'b1', 2);
    });
  });

  describe('validatePromo', () => {
    it('should call cartService.validatePromo', async () => {
      mockCartService.validatePromo.mockResolvedValue({
        valid: true,
        discount: 30000,
        type: 'free_shipping',
      });

      const result = await controller.validatePromo({ code: 'FREESHIP' });

      expect(mockCartService.validatePromo).toHaveBeenCalledWith('FREESHIP');
      expect(result.valid).toBe(true);
    });
  });
});
