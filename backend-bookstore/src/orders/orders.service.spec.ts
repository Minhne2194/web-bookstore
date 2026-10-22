import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BadRequestException } from '@nestjs/common';
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
});
