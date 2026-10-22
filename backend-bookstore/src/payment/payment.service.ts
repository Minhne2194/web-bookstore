import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PayOS } = require('@payos/node');

@Injectable()
export class PaymentService {
  private payOS: any;

  constructor(private prisma: PrismaService) {
    if (process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY) {
      this.payOS = new PayOS({
        clientId: process.env.PAYOS_CLIENT_ID,
        apiKey: process.env.PAYOS_API_KEY,
        checksumKey: process.env.PAYOS_CHECKSUM_KEY,
      });
    } else {
      console.warn('PayOS credentials not configured. PayOS payments will be unavailable.');
      this.payOS = null;
    }
  }

  // MoMo Configuration
  private readonly momoConfig = {
    partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMOBKUN20180810',
    accessKey: process.env.MOMO_ACCESS_KEY || 'klm05673644177',
    secretKey: process.env.MOMO_SECRET_KEY || 'at67qH6mk8w5Y1n71y',
    returnUrl:
      process.env.MOMO_RETURN_URL || 'http://localhost:5173/payment/result',
    notifyUrl:
      process.env.MOMO_NOTIFY_URL ||
      'http://localhost:3000/payment/momo/callback',
    requestUrl: 'https://test-payment.momo.vn/v2/gateway/api/create',
    requestQueryUrl: 'https://test-payment.momo.vn/v2/gateway/api/query',
  };

  // VNPay Configuration
  private readonly vnpayConfig = {
    tmnCode: process.env.VNPAY_TMN_CODE || 'CPH0011',
    hashSecret: process.env.VNPAY_HASH_SECRET || 'ABCDEFG12345678',
    url:
      process.env.VNPAY_URL ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl:
      process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payment/result',
    notifyUrl:
      process.env.VNPAY_NOTIFY_URL ||
      'http://localhost:3000/payment/vnpay/callback',
  };

  // PayOS Configuration
  private readonly payosConfig = {
    returnUrl:
      process.env.PAYOS_RETURN_URL || 'http://localhost:5173/payment/result',
    cancelUrl:
      process.env.PAYOS_CANCEL_URL || 'http://localhost:5173/payment/result',
    webhookUrl:
      process.env.PAYOS_WEBHOOK_URL ||
      'https://pretense-cucumber-varsity.ngrok-free.dev/payment/payos/callback',
  };

  /**
   * Create MoMo payment link
   */
  async createMoMoPayment(orderId: string, amount: number, orderInfo: string) {
    const {
      partnerCode,
      accessKey,
      secretKey,
      returnUrl,
      notifyUrl,
      requestUrl,
    } = this.momoConfig;

    const extraData = '';
    const requestId = partnerCode + new Date().getTime();

    // Build signature according to MoMo API documentation
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=captureWallet`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody: any = {
      partnerCode,
      partnerName: 'Book Store',
      storeId: 'MOMO_TEST_STORE',
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: returnUrl,
      ipnUrl: notifyUrl,
      lang: 'vi',
      requestType: 'captureWallet',
      extraData,
      signature,
      accessKey,
    };

    try {
      // Make actual HTTP request to MoMo API
      const response = await axios.post(requestUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = response.data;

      if (result.resultCode !== 0) {
        throw new BadRequestException(
          result.message || 'Có lỗi xảy ra khi tạo thanh toán MoMo',
        );
      }

      // Update order payment status
      await this.prisma.order.update({
        where: { order_id: orderId },
        data: { payment_status: 'pending' },
      });

      return {
        payUrl: result.payUrl || result.shortLink,
        shortLink: result.shortLink,
        orderId,
        message: 'Tạo thanh toán MoMo thành công',
      };
    } catch (error) {
      console.error('MoMo API Error:', error.response?.data || error.message);
      throw new BadRequestException(
        'Không thể kết nối đến cổng thanh toán MoMo',
      );
    }
  }

  /**
   * Create VNPay payment link
   */
  async createVNPayPayment(
    orderId: string,
    amount: number,
    orderInfo: string,
    bankCode?: string,
  ) {
    const { tmnCode, hashSecret, url, returnUrl } = this.vnpayConfig;

    const createDate = new Date();
    const formattedDate = this.formatDateForVNPay(createDate);
    const expireDate = new Date(createDate.getTime() + 15 * 60 * 1000); // 15 minutes (VNPay recommended)
    const formattedExpireDate = this.formatDateForVNPay(expireDate);

    const locale = 'vn';
    const currCode = 'VND';
    const vnpAmount = amount * 100; // VNPay expects amount in VND (multiply by 100)

    const vnp_Params: any = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: locale,
      vnp_CurrCode: currCode,
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: vnpAmount,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: this.getClientIp(),
      vnp_CreateDate: formattedDate,
      vnp_ExpireDate: formattedExpireDate,
    };

    if (bankCode) {
      vnp_Params['vnp_BankCode'] = bankCode;
    }

    // Sort parameters alphabetically
    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = vnp_Params[key];
        return acc;
      }, {});

    // Build raw query string for hash computation (NOT URL-encoded, per VNPay spec)
    const signData = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const secureHash = crypto
      .createHmac('sha512', hashSecret)
      .update(signData)
      .digest('hex');

    // Build final payment URL with URL-encoded parameters + hash
    const encodedParams = new URLSearchParams(sortedParams).toString();
    const paymentUrl = `${url}?${encodedParams}&vnp_SecureHash=${secureHash}`;

    // Update order payment status
    await this.prisma.order.update({
      where: { order_id: orderId },
      data: { payment_status: 'pending' },
    });

    return {
      payUrl: paymentUrl,
      orderId,
      message: 'Tạo thanh toán VNPay thành công',
    };
  }

  /**
   * Handle MoMo callback (IPN)
   */
  async handleMoMoCallback(body: any) {
    const { secretKey } = this.momoConfig;

    // Verify signature: MoMo computes hash on ALL fields (except signature) sorted alphabetically
    const { signature, ...data } = body;

    const rawSignature = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('MoMo signature mismatch:', {
        expected: expectedSignature,
        received: signature,
      });
      throw new BadRequestException('Invalid MoMo signature');
    }

    const { orderId, resultCode, amount } = body;

    if (resultCode === 0) {
      // Payment successful
      await this.prisma.order.update({
        where: { order_id: orderId }, // This works if we still use order_id as orderId
        data: {
          payment_status: 'paid',
          status: 'confirmed',
        },
      });

      return { result: 0, message: 'success' };
    } else {
      // Payment failed - restore stock
      await this.handlePaymentFailure(orderId);

      return { result: resultCode, message: 'Payment failed' };
    }
  }

  /**
   * Handle VNPay callback (IPN)
   */
  async handleVNPayCallback(query: any) {
    const { hashSecret } = this.vnpayConfig;

    const { vnp_SecureHash, vnp_SecureHashType, ...data } = query;

    // Build data string for hash verification (raw, NOT URL-encoded, per VNPay spec)
    const sortedData = Object.keys(data)
      .sort()
      .filter((key) => key.startsWith('vnp_') && data[key] !== '')
      .reduce((acc, key) => {
        acc[key] = data[key];
        return acc;
      }, {});

    const dataString = Object.entries(sortedData)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const expectedHash = crypto
      .createHmac('sha512', hashSecret)
      .update(dataString)
      .digest('hex');

    if (vnp_SecureHash !== expectedHash) {
      console.error('VNPay signature mismatch:', {
        expected: expectedHash,
        received: vnp_SecureHash,
      });
      throw new BadRequestException('Invalid VNPay signature');
    }

    const { vnp_TxnRef: orderId, vnp_ResponseCode: responseCode } = query;

    if (responseCode === '00') {
      // Payment successful
      await this.prisma.order.update({
        where: { order_id: orderId },
        data: {
          payment_status: 'paid',
          status: 'confirmed',
        },
      });

      return { RspCode: '00', Message: 'success' };
    } else {
      // Payment failed - restore stock
      await this.handlePaymentFailure(orderId);

      return { RspCode: responseCode, Message: 'Payment failed' };
    }
  }

  /**
   * Reconcile abandoned online payments — find orders stuck in pending
   * for more than 15 minutes and restore their stock.
   */
  async reconcileAbandonedPayments() {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    const abandonedOrders = await this.prisma.order.findMany({
      where: {
        payment_status: 'pending',
        status: 'pending',
        payment_method: { in: ['momo', 'vnpay'] },
        created_at: { lt: cutoff },
      },
      include: { items: true },
    });

    for (const order of abandonedOrders) {
      await this.handlePaymentFailure(order.order_id);
    }

    return {
      reconciled: abandonedOrders.length,
      orderIds: abandonedOrders.map((o) => o.order_id),
    };
  }

  /**
   * Query payment status from MoMo
   */
  async queryMoMoPayment(orderId: string) {
    const { partnerCode, accessKey, secretKey, requestQueryUrl } =
      this.momoConfig;

    const requestId = partnerCode + new Date().getTime();
    const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}&requestType=captureWallet`;
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode,
      requestId,
      orderId,
      requestType: 'captureWallet',
      signature,
      lang: 'vi',
    };

    try {
      const response = await axios.post(requestQueryUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('MoMo Query Error:', error.response?.data || error.message);
      return {
        orderId,
        status: 'error',
        message: 'Không thể truy vấn trạng thái thanh toán',
      };
    }
  }

  /**
   * Create PayOS payment link
   */
  async createPayOSPayment(orderId: string, amount: number, orderInfo: string) {
    const { returnUrl, cancelUrl } = this.payosConfig;

    // PayOS requires an integer orderCode (max 15 digits)
    const payosOrderCode =
      Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);

    // Store mapping so webhook can find the order
    await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        payment_status: 'pending',
        note: `payos:${payosOrderCode}`,
      },
    });

    try {
      const result = await this.payOS.paymentRequests.create({
        orderCode: payosOrderCode,
        amount,
        description: orderInfo.slice(0, 25),
        returnUrl,
        cancelUrl,
      });

      return {
        payUrl: result.checkoutUrl,
        qrCode: result.qrCode,
        paymentLinkId: result.paymentLinkId,
        orderCode: payosOrderCode,
        orderId,
        message: 'Tạo thanh toán PayOS thành công',
      };
    } catch (error: any) {
      console.error('PayOS Error:', error?.message || error);
      throw new BadRequestException(
        'Không thể kết nối đến cổng thanh toán PayOS',
      );
    }
  }

  /**
   * Handle PayOS webhook callback
   */
  async handlePayOSWebhook(body: any) {
    try {
      const verified = await this.payOS.webhooks.verify(body);
      const { orderCode, code, desc } = verified;

      // Find order by payos orderCode stored in note field
      const order = await this.prisma.order.findFirst({
        where: { note: `payos:${orderCode}` },
      });

      if (!order) {
        console.error('PayOS webhook: order not found for code', orderCode);
        throw new BadRequestException('Order not found');
      }

      if (code === '00') {
        await this.prisma.order.update({
          where: { order_id: order.order_id },
          data: {
            payment_status: 'paid',
            status: 'confirmed',
          },
        });
        return { success: true };
      } else {
        await this.handlePaymentFailure(order.order_id);
        return { success: false, message: desc };
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      console.error('PayOS Webhook Error:', error?.message || error);
      throw new BadRequestException('Invalid PayOS webhook signature');
    }
  }

  /**
   * Handle payment failure (restore stock)
   */
  private async handlePaymentFailure(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: { items: true },
    });

    if (order) {
      // Restore stock for each item
      for (const item of order.items) {
        await this.prisma.book.update({
          where: { book_id: item.book_id },
          data: {
            stock_qty: { increment: item.quantity },
            sold_count: { decrement: item.quantity },
          },
        });
      }

      // Update order status
      await this.prisma.order.update({
        where: { order_id: orderId },
        data: {
          payment_status: 'failed',
          status: 'cancelled',
        },
      });
    }
  }

  /**
   * Format date for VNPay (YYYYMMDDHHmmss)
   */
  private formatDateForVNPay(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Get client IP address
   */
  private getClientIp(): string {
    // In a real application, get from request
    return '127.0.0.1';
  }
}
