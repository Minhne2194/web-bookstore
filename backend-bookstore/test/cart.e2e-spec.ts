import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// ─────────────────────────────────────────────────────────
// Integration Test — Cart API
// ─────────────────────────────────────────────────────────

import { CartController } from '../src/cart/cart.controller';
import { CartService } from '../src/cart/cart.service';
import { OptionalAuthGuard } from '../src/auth/optional-auth.guard';

describe('Cart API (e2e)', () => {
  let app: INestApplication<App>;

  const mockCartService = {
    getCart: jest.fn(),
    addToCart: jest.fn(),
    updateCartItem: jest.fn(),
    removeFromCart: jest.fn(),
    validatePromo: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    })
      .overrideGuard(OptionalAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          // Simulate: If Authorization header, set user; otherwise use guest ID
          if (req.headers.authorization === 'Bearer user-token') {
            req.user = { sub: 'user1', email: 'user@test.com', role: 'user' };
          }
          return true;
        },
      })
      .compile();

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
  // GET /cart — Get cart (auth or guest)
  // ─────────────────────────────────────────────────────────
  describe('GET /cart', () => {
    it('should get cart for authenticated user', async () => {
      mockCartService.getCart.mockResolvedValue({
        items: [{ bookId: 'book1', quantity: 2 }],
      });

      const response = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(mockCartService.getCart).toHaveBeenCalledWith('user1');
    });

    it('should get cart for guest user via x-guest-id header', async () => {
      mockCartService.getCart.mockResolvedValue({ items: [] });

      const response = await request(app.getHttpServer())
        .get('/cart')
        .set('x-guest-id', 'guest:abc123')
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(mockCartService.getCart).toHaveBeenCalledWith('guest:abc123');
    });

    it('should return 400 if no auth and no guest-id', async () => {
      await request(app.getHttpServer()).get('/cart').expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /cart/add — Add item to cart
  // ─────────────────────────────────────────────────────────
  describe('POST /cart/add', () => {
    it('should add item to cart for auth user', async () => {
      mockCartService.addToCart.mockResolvedValue({
        items: [{ bookId: 'book1', quantity: 1 }],
      });

      const response = await request(app.getHttpServer())
        .post('/cart/add')
        .set('Authorization', 'Bearer user-token')
        .send({ bookId: 'book1', quantity: 1 })
        .expect(201);

      expect(response.body.items).toHaveLength(1);
      expect(mockCartService.addToCart).toHaveBeenCalledWith(
        'user1',
        'book1',
        1,
      );
    });

    it('should add item to cart for guest user', async () => {
      mockCartService.addToCart.mockResolvedValue({
        items: [{ bookId: 'book1', quantity: 3 }],
      });

      const response = await request(app.getHttpServer())
        .post('/cart/add')
        .set('x-guest-id', 'guest:xyz')
        .send({ bookId: 'book1', quantity: 3 })
        .expect(201);

      expect(mockCartService.addToCart).toHaveBeenCalledWith(
        'guest:xyz',
        'book1',
        3,
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // PUT /cart/update — Update cart item quantity
  // ─────────────────────────────────────────────────────────
  describe('PUT /cart/update', () => {
    it('should update cart item quantity', async () => {
      mockCartService.updateCartItem.mockResolvedValue({
        items: [{ bookId: 'book1', quantity: 5 }],
      });

      const response = await request(app.getHttpServer())
        .put('/cart/update')
        .set('Authorization', 'Bearer user-token')
        .send({ bookId: 'book1', quantity: 5 })
        .expect(200);

      expect(response.body.items[0].quantity).toBe(5);
      expect(mockCartService.updateCartItem).toHaveBeenCalledWith(
        'user1',
        'book1',
        5,
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // DELETE /cart/remove/:bookId — Remove item from cart
  // ─────────────────────────────────────────────────────────
  describe('DELETE /cart/remove/:bookId', () => {
    it('should remove item from cart', async () => {
      mockCartService.removeFromCart.mockResolvedValue({ items: [] });

      const response = await request(app.getHttpServer())
        .delete('/cart/remove/book1')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(mockCartService.removeFromCart).toHaveBeenCalledWith(
        'user1',
        'book1',
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /cart/validate-promo — Validate promo code
  // ─────────────────────────────────────────────────────────
  describe('POST /cart/validate-promo', () => {
    it('should validate a valid free-ship promo code', async () => {
      mockCartService.validatePromo.mockResolvedValue({
        valid: true,
        discount: 30000,
        type: 'free_shipping',
        description: 'Miễn phí vận chuyển',
      });

      const response = await request(app.getHttpServer())
        .post('/cart/validate-promo')
        .set('x-guest-id', 'guest:abc')
        .send({ code: 'FREESHIP' })
        .expect(201);

      expect(response.body.valid).toBe(true);
      expect(response.body.type).toBe('free_shipping');
    });

    it('should return invalid for unknown promo code', async () => {
      mockCartService.validatePromo.mockResolvedValue({
        valid: false,
        message: 'Mã khuyến mãi không tồn tại hoặc không hợp lệ.',
      });

      const response = await request(app.getHttpServer())
        .post('/cart/validate-promo')
        .set('x-guest-id', 'guest:abc')
        .send({ code: 'INVALID' })
        .expect(201);

      expect(response.body.valid).toBe(false);
    });
  });
});
