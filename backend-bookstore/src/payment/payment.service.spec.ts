import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

// Mock axios
jest.mock('axios');

// Mock @payos/node
jest.mock('@payos/node', () => ({
  PayOS: jest.fn().mockImplementation(() => ({
    paymentRequests: { create: jest.fn() },
    webhooks: { verify: jest.fn() },
  })),
}));

describe('PaymentService', () => {
  let service: PaymentService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    book: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Set env vars for PayOS initialization
    process.env.PAYOS_CLIENT_ID = 'test_client_id';
    process.env.PAYOS_API_KEY = 'test_api_key';
    process.env.PAYOS_CHECKSUM_KEY = 'test_checksum_key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYOS_CLIENT_ID;
    delete process.env.PAYOS_API_KEY;
    delete process.env.PAYOS_CHECKSUM_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────
  // formatDateForVNPay (private method, tested via reflection)
  // ─────────────────────────────────────────────────────────
  describe('formatDateForVNPay', () => {
    it('should format date correctly', () => {
      const date = new Date(2026, 0, 15, 10, 30, 45); // Jan 15, 2026 10:30:45
      const formatted = (service as any).formatDateForVNPay(date);

      expect(formatted).toBe('20260115103045');
    });

    it('should pad single-digit months and days with zeros', () => {
      const date = new Date(2026, 2, 5, 8, 5, 3); // Mar 5, 2026 08:05:03
      const formatted = (service as any).formatDateForVNPay(date);

      expect(formatted).toBe('20260305080503');
    });
  });

  // ─────────────────────────────────────────────────────────
  // getClientIp (private method)
  // ─────────────────────────────────────────────────────────
  describe('getClientIp', () => {
    it('should return 127.0.0.1', () => {
      const ip = (service as any).getClientIp();
      expect(ip).toBe('127.0.0.1');
    });
  });

  // ─────────────────────────────────────────────────────────
  // handlePaymentFailure (private, tested via handleMoMoCallback)
  // ─────────────────────────────────────────────────────────
  describe('handlePaymentFailure', () => {
    it('should restore stock and mark order as cancelled', async () => {
      const order = {
        order_id: 'ord1',
        items: [
          { book_id: 'book1', quantity: 2 },
          { book_id: 'book2', quantity: 1 },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(order);
      mockPrismaService.book.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      await (service as any).handlePaymentFailure('ord1');

      // Should restore stock for each item
      expect(mockPrismaService.book.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.book.update).toHaveBeenCalledWith({
        where: { book_id: 'book1' },
        data: {
          stock_qty: { increment: 2 },
          sold_count: { decrement: 2 },
        },
      });
      expect(mockPrismaService.book.update).toHaveBeenCalledWith({
        where: { book_id: 'book2' },
        data: {
          stock_qty: { increment: 1 },
          sold_count: { decrement: 1 },
        },
      });

      // Should update order status
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { order_id: 'ord1' },
        data: {
          payment_status: 'failed',
          status: 'cancelled',
        },
      });
    });

    it('should do nothing if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await (service as any).handlePaymentFailure('nonexistent');

      expect(mockPrismaService.book.update).not.toHaveBeenCalled();
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // reconcileAbandonedPayments
  // ─────────────────────────────────────────────────────────
  describe('reconcileAbandonedPayments', () => {
    it('should find and handle abandoned orders', async () => {
      const abandonedOrders = [
        {
          order_id: 'ord1',
          items: [{ book_id: 'book1', quantity: 1 }],
        },
        {
          order_id: 'ord2',
          items: [{ book_id: 'book2', quantity: 2 }],
        },
      ];
      mockPrismaService.order.findMany.mockResolvedValue(abandonedOrders);
      mockPrismaService.order.findUnique.mockImplementation(
        async ({ where }) => {
          return abandonedOrders.find((o) => o.order_id === where.order_id);
        },
      );
      mockPrismaService.book.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      const result = await service.reconcileAbandonedPayments();

      expect(result.reconciled).toBe(2);
      expect(result.orderIds).toEqual(['ord1', 'ord2']);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: {
          payment_status: 'pending',
          status: 'pending',
          payment_method: { in: ['momo', 'vnpay'] },
          created_at: { lt: expect.any(Date) },
        },
        include: { items: true },
      });
    });

    it('should return 0 reconciled if no abandoned orders', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      const result = await service.reconcileAbandonedPayments();

      expect(result.reconciled).toBe(0);
      expect(result.orderIds).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────
  // handleMoMoCallback signature verification
  // ─────────────────────────────────────────────────────────
  describe('handleMoMoCallback', () => {
    it('should throw BadRequestException for invalid signature', async () => {
      const callbackBody = {
        orderId: 'ord1',
        resultCode: 0,
        amount: 100000,
        signature: 'invalid_signature',
        partnerCode: 'MOMOBKUN20180810',
      };

      await expect(service.handleMoMoCallback(callbackBody)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // handleVNPayCallback signature verification
  // ─────────────────────────────────────────────────────────
  describe('handleVNPayCallback', () => {
    it('should throw BadRequestException for invalid hash', async () => {
      const callbackQuery = {
        vnp_TxnRef: 'ord1',
        vnp_ResponseCode: '00',
        vnp_Amount: '10000000',
        vnp_SecureHash: 'invalid_hash',
      };

      await expect(service.handleVNPayCallback(callbackQuery)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // createVNPayPayment
  // ─────────────────────────────────────────────────────────
  describe('createVNPayPayment', () => {
    it('should generate a valid VNPay payment URL', async () => {
      mockPrismaService.order.update.mockResolvedValue({});

      const result = await service.createVNPayPayment(
        'ord1',
        200000,
        'Thanh toán đơn hàng ORD-001',
      );

      expect(result.payUrl).toContain('sandbox.vnpayment.vn');
      expect(result.payUrl).toContain('vnp_SecureHash=');
      expect(result.orderId).toBe('ord1');
      expect(result.message).toContain('VNPay');
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { order_id: 'ord1' },
        data: { payment_status: 'pending' },
      });
    });

    it('should include bank code if provided', async () => {
      mockPrismaService.order.update.mockResolvedValue({});

      const result = await service.createVNPayPayment(
        'ord1',
        200000,
        'Test',
        'NCB',
      );

      expect(result.payUrl).toContain('vnp_BankCode=NCB');
    });
  });
});
