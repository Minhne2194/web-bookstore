import { Injectable, BadRequestException } from '@nestjs/common';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import Redis from 'ioredis';

@Injectable()
export class OrdersService {
  private redis: Redis;
  private readonly validOrderStatuses = new Set(Object.values(OrderStatus));

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      username: process.env.REDIS_USERNAME || 'default',
      password: process.env.REDIS_PASSWORD || undefined,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    });
  }

  private normalizePaymentMethod(paymentMethod?: string): PaymentMethod {
    switch (paymentMethod) {
      case PaymentMethod.bank_transfer:
      case 'bank':
        return PaymentMethod.bank_transfer;
      case PaymentMethod.momo:
        return PaymentMethod.momo;
      case PaymentMethod.vnpay:
        return PaymentMethod.vnpay;
      case PaymentMethod.payos:
      case 'payos':
        return PaymentMethod.payos;
      case PaymentMethod.cod:
      default:
        return PaymentMethod.cod;
    }
  }

  private normalizeOrderStatus(status: string): OrderStatus {
    const normalizedStatus = status?.toLowerCase() as OrderStatus | undefined;

    if (!normalizedStatus || !this.validOrderStatuses.has(normalizedStatus)) {
      throw new BadRequestException('Trạng thái đơn hàng không hợp lệ!');
    }

    return normalizedStatus;
  }

  private readonly freeShipCodes = new Set([
    'FREESHIP',
    'MIENPHI',
    ...(process.env.FREE_SHIP_CODES || '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  ]);

  private isFreeShipPromo(code?: string): boolean {
    return !!(code && this.freeShipCodes.has(code.trim().toUpperCase()));
  }

  async checkout(
    userId: string,
    body: { payment_method: any; shipping_address: any; promo_code?: string },
  ) {
    const cartData = await this.redis.get(`cart:${userId}`);
    if (!cartData)
      throw new BadRequestException('Giỏ hàng của bạn đang trống!');

    const cart = JSON.parse(cartData);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Giỏ hàng của bạn đang trống!');
    }

    let subtotal = 0;
    const orderItemsData: any[] = [];

    for (const item of cart.items) {
      const book = await this.prisma.book.findUnique({
        where: { book_id: item.bookId },
      });

      if (!book)
        throw new BadRequestException(`Sách ID ${item.bookId} không tồn tại!`);
      if (book.stock_qty < item.quantity) {
        throw new BadRequestException(
          `Sách "${book.title}" không đủ số lượng trong kho!`,
        );
      }

      subtotal += Number(book.price) * item.quantity;

      orderItemsData.push({
        book_id: book.book_id,
        quantity: item.quantity,
        unit_price: book.price,
      });
    }

    const baseShippingFee = Number(process.env.SHIPPING_FEE) || 30000;
    let shippingFee = baseShippingFee;
    let discountAmount = 0;
    
    // Dynamic coupon evaluation
    if (body.promo_code) {
      const code = body.promo_code.trim().toUpperCase();
      if (this.freeShipCodes.has(code)) {
        shippingFee = 0;
        discountAmount = baseShippingFee;
      } else {
        const coupon = await this.prisma.coupon.findUnique({ where: { code } });
        if (coupon && coupon.is_active) {
          const now = new Date();
          if (now >= coupon.start_date && now <= coupon.end_date) {
            if (!coupon.usage_limit || coupon.used_count < coupon.usage_limit) {
              if (coupon.discount_type === 'free_shipping') {
                shippingFee = 0;
                discountAmount = baseShippingFee;
              } else if (coupon.discount_type === 'percentage') {
                const calculated = (subtotal * Number(coupon.discount_value)) / 100;
                const max = coupon.max_discount_amount ? Number(coupon.max_discount_amount) : Infinity;
                discountAmount = Math.min(calculated, max);
              } else if (coupon.discount_type === 'fixed_amount') {
                discountAmount = Math.min(Number(coupon.discount_value), subtotal);
              }
              // We will update used_count in the transaction below
            }
          }
        }
      }
    }

    const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);
    const paymentMethod = this.normalizePaymentMethod(body.payment_method);

    // For online payment methods (MoMo, VNPay), set initial status to pending
    // The order will be confirmed after payment callback
    const isOnlinePayment =
      paymentMethod === PaymentMethod.momo ||
      paymentMethod === PaymentMethod.vnpay ||
      paymentMethod === PaymentMethod.payos ||
      paymentMethod === PaymentMethod.bank_transfer;
    const initialStatus = isOnlinePayment ? 'pending' : 'pending';

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          order_code: `ORD-${Date.now()}`,
          user_id: userId,
          status: initialStatus,
          subtotal: subtotal,
          shipping_fee: shippingFee,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_status: 'pending',
          shipping_address: body.shipping_address || {},
          coupon_code: body.promo_code ? body.promo_code.trim().toUpperCase() : null,
          items: {
            create: orderItemsData,
          },
        },
        include: { items: true },
      });

      // For COD, immediately decrement stock
      // For online payment, stock is already decremented and will be restored if payment fails
      for (const item of cart.items) {
        await tx.book.update({
          where: { book_id: item.bookId },
          data: {
            stock_qty: { decrement: item.quantity },
            sold_count: { increment: item.quantity },
          },
        });
      }

      // Update coupon used_count if it's dynamic
      if (body.promo_code && !this.freeShipCodes.has(body.promo_code.trim().toUpperCase())) {
         await tx.coupon.updateMany({
           where: { code: body.promo_code.trim().toUpperCase() },
           data: { used_count: { increment: 1 } }
         });
      }

      return newOrder;
    });

    await this.redis.del(`cart:${userId}`);

    const user = await this.prisma.user.findUnique({ where: { user_id: userId } });
    if (user) {
      // Send email asynchronously without blocking the checkout flow
      this.emailService.sendInvoiceEmail(user.email, user.full_name || 'Khách hàng', order).catch(err => {
         console.error('Lỗi khi gửi email hóa đơn:', err);
      });
    }

    return {
      message: isOnlinePayment
        ? 'Đơn hàng đã được tạo. Vui lòng hoàn tất thanh toán.'
        : 'Đặt hàng thành công!',
      order: order,
      requiresPayment: isOnlinePayment,
    };
  }

  /**
   * Get order by ID for payment processing
   */
  async getOrderForPayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId, user_id: userId },
      include: { items: { include: { book: true } } },
    });

    if (!order) {
      throw new BadRequestException('Đơn hàng không tồn tại!');
    }

    if (order.payment_status === 'paid') {
      throw new BadRequestException('Đơn hàng đã được thanh toán!');
    }

    return order;
  }

  async getMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        items: {
          include: { book: { select: { title: true, cover_url: true } } },
        },
      },
    });
  }
  async getAllOrdersForAdmin() {
    return this.prisma.order.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { full_name: true, email: true } },
        items: { include: { book: { select: { title: true } } } },
      },
    });
  }

  async updateOrderStatus(orderId: string, status: any) {
    const normalizedStatus = this.normalizeOrderStatus(String(status ?? ''));

    return this.prisma.order.update({
      where: { order_id: orderId },
      data: { status: normalizedStatus },
    });
  }
}
