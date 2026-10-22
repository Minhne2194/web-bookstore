import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { OrderStatus } from '@prisma/client';

jest.mock('ioredis');

describe('OrdersService', () => {
  let service: OrdersService;
  let redisMock: any;

  const mockPrismaService = {
    book: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (cb) => {
      // Execute the callback with the mockPrismaService to simulate transaction
      return cb(mockPrismaService);
    }),
  };

  const mockEmailService = {
    sendInvoiceEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    (Redis as unknown as jest.Mock).mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    
    // Explicitly mock Redis methods on the instance created
    redisMock = (service as any).redis;
    redisMock.get = jest.fn();
    redisMock.del = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkout', () => {
    it('should throw error if cart is empty', async () => {
      redisMock.get.mockResolvedValue(null);
      await expect(
        service.checkout('user1', { payment_method: 'cod', shipping_address: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process checkout successfully', async () => {
      redisMock.get.mockResolvedValue(
        JSON.stringify({
          items: [{ bookId: '1', quantity: 2 }],
        }),
      );
      mockPrismaService.book.findUnique.mockResolvedValue({
        book_id: '1',
        title: 'Book 1',
        price: 100000,
        stock_qty: 10,
      });
      mockPrismaService.order.create.mockResolvedValue({
        order_id: 'ord1',
        total_amount: 230000,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        user_id: 'user1',
        email: 'test@test.com',
      });

      const result = await service.checkout('user1', {
        payment_method: 'cod',
        shipping_address: {},
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.order.create).toHaveBeenCalled();
      expect(mockPrismaService.book.update).toHaveBeenCalled();
      expect(redisMock.del).toHaveBeenCalledWith('cart:user1');
      expect(result.message).toBe('Đặt hàng thành công!');
      expect(result.order.order_id).toBe('ord1');
    });

    it('should throw error if out of stock', async () => {
      redisMock.get.mockResolvedValue(
        JSON.stringify({
          items: [{ bookId: '1', quantity: 100 }],
        }),
      );
      mockPrismaService.book.findUnique.mockResolvedValue({
        book_id: '1',
        title: 'Book 1',
        price: 100000,
        stock_qty: 10, // Not enough
      });

      await expect(
        service.checkout('user1', { payment_method: 'cod', shipping_address: {} }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update status if valid', async () => {
      mockPrismaService.order.update.mockResolvedValue({ status: OrderStatus.confirmed });
      const result = await service.updateOrderStatus('ord1', 'confirmed');
      expect(result.status).toBe(OrderStatus.confirmed);
    });

    it('should throw if invalid status', async () => {
      await expect(service.updateOrderStatus('ord1', 'invalid_status')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('changePaymentMethod', () => {
    const pendingOrder = {
      order_id: 'ord1',
      user_id: 'user1',
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'momo',
      total_amount: 100000,
    };

    it('should throw NotFoundException when order does not belong to user', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.changePaymentMethod('ord1', 'user1', 'vnpay'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when order is not awaiting payment', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...pendingOrder,
        status: 'confirmed',
      });

      await expect(
        service.changePaymentMethod('ord1', 'user1', 'vnpay'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('should be a no-op when the method is unchanged', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(pendingOrder);

      const result = await service.changePaymentMethod('ord1', 'user1', 'momo');

      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(result.payment_method).toBe('momo');
    });

    it('should update only the payment method', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(pendingOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...pendingOrder,
        payment_method: 'vnpay',
      });

      const result = await service.changePaymentMethod(
        'ord1',
        'user1',
        'vnpay',
      );

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { order_id: 'ord1' },
        data: { payment_method: 'vnpay' },
      });
      expect(mockPrismaService.book.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        order_id: 'ord1',
        payment_method: 'vnpay',
        total_amount: 100000,
        status: 'pending',
        payment_status: 'pending',
      });
    });
  });

  describe('cancelPendingOrder', () => {
    const pendingOrder = {
      order_id: 'ord1',
      user_id: 'user1',
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'payos',
      items: [
        { book_id: 'book1', quantity: 2 },
        { book_id: 'book2', quantity: 1 },
      ],
    };

    it('should throw NotFoundException when order is not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.cancelPendingOrder('ord1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.book.update).not.toHaveBeenCalled();
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when order is already paid', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...pendingOrder,
        payment_status: 'paid',
      });

      await expect(service.cancelPendingOrder('ord1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.book.update).not.toHaveBeenCalled();
    });

    it('should restore stock and cancel the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(pendingOrder);
      mockPrismaService.book.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      const result = await service.cancelPendingOrder('ord1', 'user1');

      expect(mockPrismaService.book.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.book.update).toHaveBeenCalledWith({
        where: { book_id: 'book1' },
        data: { stock_qty: { increment: 2 }, sold_count: { decrement: 2 } },
      });
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { order_id: 'ord1' },
        data: { status: 'cancelled', payment_status: 'failed' },
      });
      expect(result).toEqual({
        order_id: 'ord1',
        status: 'cancelled',
        message: 'Đã hủy đơn hàng',
      });
    });
  });
});
