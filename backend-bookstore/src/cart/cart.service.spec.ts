import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('CartService', () => {
  let service: CartService;
  let redisMock: any;

  const mockPrismaService = {
    coupon: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    (Redis as unknown as jest.Mock).mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);

    // Mock Redis instance methods
    redisMock = (service as any).redis;
    redisMock.get = jest.fn();
    redisMock.set = jest.fn();
    redisMock.del = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────
  // getCart
  // ─────────────────────────────────────────────────────────
  describe('getCart', () => {
    it('should return empty cart if no data in Redis', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getCart('user1');

      expect(redisMock.get).toHaveBeenCalledWith('cart:user1');
      expect(result).toEqual({ items: [] });
    });

    it('should return parsed cart data from Redis', async () => {
      const cartData = { items: [{ bookId: 'book1', quantity: 2 }] };
      redisMock.get.mockResolvedValue(JSON.stringify(cartData));

      const result = await service.getCart('user1');

      expect(result).toEqual(cartData);
    });
  });

  // ─────────────────────────────────────────────────────────
  // addToCart
  // ─────────────────────────────────────────────────────────
  describe('addToCart', () => {
    it('should add new item to empty cart', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.addToCart('user1', 'book1', 1);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ bookId: 'book1', quantity: 1 });
      expect(redisMock.set).toHaveBeenCalledWith(
        'cart:user1',
        expect.any(String),
        'EX',
        604800,
      );
    });

    it('should increase quantity if item already in cart', async () => {
      const existingCart = { items: [{ bookId: 'book1', quantity: 2 }] };
      redisMock.get.mockResolvedValue(JSON.stringify(existingCart));

      const result = await service.addToCart('user1', 'book1', 3);

      expect(result.items[0].quantity).toBe(5);
    });

    it('should add new item alongside existing items', async () => {
      const existingCart = { items: [{ bookId: 'book1', quantity: 1 }] };
      redisMock.get.mockResolvedValue(JSON.stringify(existingCart));

      const result = await service.addToCart('user1', 'book2', 2);

      expect(result.items).toHaveLength(2);
      expect(result.items[1]).toEqual({ bookId: 'book2', quantity: 2 });
    });
  });

  // ─────────────────────────────────────────────────────────
  // updateCartItem
  // ─────────────────────────────────────────────────────────
  describe('updateCartItem', () => {
    it('should update quantity of existing item', async () => {
      const cart = { items: [{ bookId: 'book1', quantity: 2 }] };
      redisMock.get.mockResolvedValue(JSON.stringify(cart));

      const result = await service.updateCartItem('user1', 'book1', 5);

      expect(result.items[0].quantity).toBe(5);
    });

    it('should remove item if quantity <= 0', async () => {
      const cart = { items: [{ bookId: 'book1', quantity: 2 }] };
      redisMock.get.mockResolvedValue(JSON.stringify(cart));

      const result = await service.updateCartItem('user1', 'book1', 0);

      expect(result.items).toHaveLength(0);
    });

    it('should add new item if not in cart', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify({ items: [] }));

      const result = await service.updateCartItem('user1', 'book1', 3);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ bookId: 'book1', quantity: 3 });
    });
  });

  // ─────────────────────────────────────────────────────────
  // removeFromCart
  // ─────────────────────────────────────────────────────────
  describe('removeFromCart', () => {
    it('should remove specified book from cart', async () => {
      const cart = {
        items: [
          { bookId: 'book1', quantity: 1 },
          { bookId: 'book2', quantity: 2 },
        ],
      };
      redisMock.get.mockResolvedValue(JSON.stringify(cart));

      const result = await service.removeFromCart('user1', 'book1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].bookId).toBe('book2');
    });

    it('should return empty items if removing the only item', async () => {
      const cart = { items: [{ bookId: 'book1', quantity: 1 }] };
      redisMock.get.mockResolvedValue(JSON.stringify(cart));

      const result = await service.removeFromCart('user1', 'book1');

      expect(result.items).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // mergeCart
  // ─────────────────────────────────────────────────────────
  describe('mergeCart', () => {
    it('should return user cart if guest cart is empty', async () => {
      redisMock.get
        .mockResolvedValueOnce(JSON.stringify({ items: [] })) // guest cart
        .mockResolvedValueOnce(
          JSON.stringify({ items: [{ bookId: 'book1', quantity: 1 }] }),
        ); // user cart

      const result = await service.mergeCart('guest1', 'user1');

      expect(result.items).toHaveLength(1);
    });

    it('should merge guest items into user cart', async () => {
      redisMock.get
        .mockResolvedValueOnce(
          JSON.stringify({ items: [{ bookId: 'book2', quantity: 3 }] }),
        ) // guest cart
        .mockResolvedValueOnce(
          JSON.stringify({ items: [{ bookId: 'book1', quantity: 1 }] }),
        ); // user cart

      const result = await service.mergeCart('guest1', 'user1');

      expect(result.items).toHaveLength(2);
      expect(redisMock.del).toHaveBeenCalledWith('cart:guest1');
    });

    it('should combine quantities for duplicate items', async () => {
      redisMock.get
        .mockResolvedValueOnce(
          JSON.stringify({ items: [{ bookId: 'book1', quantity: 2 }] }),
        ) // guest cart
        .mockResolvedValueOnce(
          JSON.stringify({ items: [{ bookId: 'book1', quantity: 3 }] }),
        ); // user cart

      const result = await service.mergeCart('guest1', 'user1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────
  // validatePromo
  // ─────────────────────────────────────────────────────────
  describe('validatePromo', () => {
    it('should return invalid for empty code', async () => {
      const result = await service.validatePromo('');
      expect(result.valid).toBe(false);
    });

    it('should return valid for built-in free ship code (FREESHIP)', async () => {
      const result = await service.validatePromo('FREESHIP');

      expect(result.valid).toBe(true);
      expect(result.discount).toBe(30000);
      expect(result.type).toBe('free_shipping');
    });

    it('should return valid for built-in free ship code (MIENPHI) case-insensitive', async () => {
      const result = await service.validatePromo('mienphi');

      expect(result.valid).toBe(true);
      expect(result.type).toBe('free_shipping');
    });

    it('should return invalid if coupon not found in DB', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue(null);

      const result = await service.validatePromo('UNKNOWN_CODE');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('không tồn tại');
    });

    it('should return invalid if coupon is inactive', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue({
        code: 'SALE10',
        is_active: false,
      });

      const result = await service.validatePromo('SALE10');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('vô hiệu hóa');
    });

    it('should return invalid if coupon expired', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue({
        code: 'EXPIRED',
        is_active: true,
        start_date: new Date(Date.now() - 86400000 * 10),
        end_date: new Date(Date.now() - 86400000),
        usage_limit: null,
        used_count: 0,
        discount_type: 'percentage',
        discount_value: 10,
      });

      const result = await service.validatePromo('EXPIRED');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('hết hạn');
    });

    it('should return invalid if coupon usage limit reached', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue({
        code: 'LIMITED',
        is_active: true,
        start_date: new Date(Date.now() - 86400000),
        end_date: new Date(Date.now() + 86400000),
        usage_limit: 5,
        used_count: 5,
        discount_type: 'percentage',
        discount_value: 10,
      });

      const result = await service.validatePromo('LIMITED');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('hết lượt');
    });

    it('should return valid percentage coupon with description', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue({
        code: 'SALE10',
        is_active: true,
        start_date: new Date(Date.now() - 86400000),
        end_date: new Date(Date.now() + 86400000),
        usage_limit: null,
        used_count: 0,
        discount_type: 'percentage',
        discount_value: 10,
      });

      const result = await service.validatePromo('SALE10');

      expect(result.valid).toBe(true);
      expect(result.type).toBe('percentage');
      expect(result.description).toContain('10%');
    });

    it('should return valid fixed_amount coupon', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue({
        code: 'GIAM50K',
        is_active: true,
        start_date: new Date(Date.now() - 86400000),
        end_date: new Date(Date.now() + 86400000),
        usage_limit: 100,
        used_count: 10,
        discount_type: 'fixed_amount',
        discount_value: 50000,
      });

      const result = await service.validatePromo('GIAM50K');

      expect(result.valid).toBe(true);
      expect(result.type).toBe('fixed_amount');
    });
  });
});
