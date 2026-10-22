import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../auth/auth.guard';
import { ForbiddenException } from '@nestjs/common';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    checkout: jest.fn(),
    getMyOrders: jest.fn(),
    getAllOrdersForAdmin: jest.fn(),
    updateOrderStatus: jest.fn(),
    getOrderForPayment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkout', () => {
    it('should call ordersService.checkout with userId', async () => {
      const mockReq = { user: { sub: 'user1', role: 'user' } };
      const body = {
        payment_method: 'cod',
        shipping_address: { city: 'HCM' },
      };
      mockOrdersService.checkout.mockResolvedValue({
        message: 'Đặt hàng thành công!',
        order: { order_id: 'ord1' },
      });

      const result = await controller.checkout(mockReq, body);

      expect(mockOrdersService.checkout).toHaveBeenCalledWith('user1', body);
      expect(result.message).toBe('Đặt hàng thành công!');
    });
  });

  describe('getMyOrders', () => {
    it('should return user orders', async () => {
      const mockReq = { user: { sub: 'user1' } };
      mockOrdersService.getMyOrders.mockResolvedValue([
        { order_id: 'ord1' },
      ]);

      const result = await controller.getMyOrders(mockReq);

      expect(result).toHaveLength(1);
    });
  });

  describe('getAllOrders', () => {
    it('should throw ForbiddenException for non-admin', async () => {
      const mockReq = { user: { sub: 'user1', role: 'user' } };

      expect(() => controller.getAllOrders(mockReq)).toThrow(ForbiddenException);
    });

    it('should return all orders for admin', async () => {
      const mockReq = { user: { sub: 'admin1', role: 'admin' } };
      mockOrdersService.getAllOrdersForAdmin.mockResolvedValue([
        { order_id: 'ord1' },
        { order_id: 'ord2' },
      ]);

      const result = await controller.getAllOrders(mockReq);

      expect(result).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('should throw ForbiddenException for non-admin', async () => {
      const mockReq = { user: { sub: 'user1', role: 'user' } };

      expect(() =>
        controller.updateStatus(mockReq, 'ord1', { status: 'confirmed' }),
      ).toThrow(ForbiddenException);
    });

    it('should update status for admin', async () => {
      const mockReq = { user: { sub: 'admin1', role: 'admin' } };
      mockOrdersService.updateOrderStatus.mockResolvedValue({
        order_id: 'ord1',
        status: 'confirmed',
      });

      const result = await controller.updateStatus(mockReq, 'ord1', {
        status: 'confirmed',
      });

      expect(result.status).toBe('confirmed');
    });
  });
});
