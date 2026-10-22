import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// ─────────────────────────────────────────────────────────
// Integration Test — Orders API
// ─────────────────────────────────────────────────────────

import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('Orders API (e2e)', () => {
  let app: INestApplication<App>;

  const mockOrdersService = {
    checkout: jest.fn(),
    getMyOrders: jest.fn(),
    getAllOrdersForAdmin: jest.fn(),
    updateOrderStatus: jest.fn(),
    getOrderForPayment: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          if (req.headers.authorization === 'Bearer admin-token') {
            req.user = {
              sub: 'admin1',
              email: 'admin@test.com',
              role: 'admin',
            };
            return true;
          }
          if (req.headers.authorization === 'Bearer user-token') {
            req.user = {
              sub: 'user1',
              email: 'user@test.com',
              role: 'user',
            };
            return true;
          }
          return false;
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
  // POST /orders/checkout
  // ─────────────────────────────────────────────────────────
  describe('POST /orders/checkout', () => {
    it('should return 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/orders/checkout')
        .send({
          payment_method: 'cod',
          shipping_address: { city: 'HCM' },
        })
        .expect(403);
    });

    it('should checkout successfully for authenticated user', async () => {
      mockOrdersService.checkout.mockResolvedValue({
        message: 'Đặt hàng thành công!',
        order: { order_id: 'ord1', total_amount: 230000 },
        requiresPayment: false,
      });

      const response = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', 'Bearer user-token')
        .send({
          payment_method: 'cod',
          shipping_address: { city: 'HCM', street: '123 ABC' },
        })
        .expect(201);

      expect(response.body.message).toBe('Đặt hàng thành công!');
      expect(response.body.order.order_id).toBe('ord1');
      expect(mockOrdersService.checkout).toHaveBeenCalledWith('user1', {
        payment_method: 'cod',
        shipping_address: { city: 'HCM', street: '123 ABC' },
      });
    });

    it('should handle online payment method', async () => {
      mockOrdersService.checkout.mockResolvedValue({
        message: 'Đơn hàng đã được tạo. Vui lòng hoàn tất thanh toán.',
        order: { order_id: 'ord2', total_amount: 300000 },
        requiresPayment: true,
      });

      const response = await request(app.getHttpServer())
        .post('/orders/checkout')
        .set('Authorization', 'Bearer user-token')
        .send({
          payment_method: 'momo',
          shipping_address: {},
        })
        .expect(201);

      expect(response.body.requiresPayment).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /orders/my-orders
  // ─────────────────────────────────────────────────────────
  describe('GET /orders/my-orders', () => {
    it('should return 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/orders/my-orders')
        .expect(403);
    });

    it('should return user orders', async () => {
      const orders = [
        {
          order_id: 'ord1',
          status: 'pending',
          total_amount: 230000,
          items: [],
        },
      ];
      mockOrdersService.getMyOrders.mockResolvedValue(orders);

      const response = await request(app.getHttpServer())
        .get('/orders/my-orders')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].order_id).toBe('ord1');
      expect(mockOrdersService.getMyOrders).toHaveBeenCalledWith('user1');
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /orders/all — Admin only
  // ─────────────────────────────────────────────────────────
  describe('GET /orders/all', () => {
    it('should return 403 if not authenticated', async () => {
      await request(app.getHttpServer()).get('/orders/all').expect(403);
    });

    it('should return 403 if user is not admin', async () => {
      await request(app.getHttpServer())
        .get('/orders/all')
        .set('Authorization', 'Bearer user-token')
        .expect(403);
    });

    it('should return all orders for admin', async () => {
      const allOrders = [
        { order_id: 'ord1', user: { full_name: 'User 1' } },
        { order_id: 'ord2', user: { full_name: 'User 2' } },
      ];
      mockOrdersService.getAllOrdersForAdmin.mockResolvedValue(allOrders);

      const response = await request(app.getHttpServer())
        .get('/orders/all')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────
  // PUT /orders/:id/status — Admin only
  // ─────────────────────────────────────────────────────────
  describe('PUT /orders/:id/status', () => {
    it('should return 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .put('/orders/ord1/status')
        .send({ status: 'confirmed' })
        .expect(403);
    });

    it('should return 403 if user is not admin', async () => {
      await request(app.getHttpServer())
        .put('/orders/ord1/status')
        .set('Authorization', 'Bearer user-token')
        .send({ status: 'confirmed' })
        .expect(403);
    });

    it('should update order status for admin', async () => {
      mockOrdersService.updateOrderStatus.mockResolvedValue({
        order_id: 'ord1',
        status: 'confirmed',
      });

      const response = await request(app.getHttpServer())
        .put('/orders/ord1/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'confirmed' })
        .expect(200);

      expect(response.body.status).toBe('confirmed');
      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        'ord1',
        'confirmed',
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /orders/:id/payment-info
  // ─────────────────────────────────────────────────────────
  describe('GET /orders/:id/payment-info', () => {
    it('should return 403 if not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/orders/ord1/payment-info')
        .expect(403);
    });

    it('should return payment info for authenticated user', async () => {
      mockOrdersService.getOrderForPayment.mockResolvedValue({
        order_id: 'ord1',
        total_amount: 300000,
        payment_method: 'momo',
      });

      const response = await request(app.getHttpServer())
        .get('/orders/ord1/payment-info')
        .set('Authorization', 'Bearer user-token')
        .expect(200);

      expect(response.body.order_id).toBe('ord1');
      expect(mockOrdersService.getOrderForPayment).toHaveBeenCalledWith(
        'ord1',
        'user1',
      );
    });
  });
});
