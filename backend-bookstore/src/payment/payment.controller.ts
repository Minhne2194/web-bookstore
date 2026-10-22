import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentService } from './payment.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Initiate MoMo payment for an order
   */
  @UseGuards(AuthGuard)
  @Post('momo/create')
  async createMoMoPayment(
    @Req() req: any,
    @Body() body: { orderId: string; amount: number; orderInfo?: string },
  ) {
    const { orderId, amount, orderInfo } = body;

    if (!orderId || !amount) {
      throw new BadRequestException('Thiếu orderId hoặc amount');
    }

    const result = await this.paymentService.createMoMoPayment(
      orderId,
      amount,
      orderInfo || `Thanh toan don hang ${orderId}`,
    );

    return result;
  }

  /**
   * Initiate VNPay payment for an order
   */
  @UseGuards(AuthGuard)
  @Post('vnpay/create')
  async createVNPayPayment(
    @Req() req: any,
    @Body()
    body: {
      orderId: string;
      amount: number;
      orderInfo?: string;
      bankCode?: string;
    },
  ) {
    const { orderId, amount, orderInfo, bankCode } = body;

    if (!orderId || !amount) {
      throw new BadRequestException('Thiếu orderId hoặc amount');
    }

    const result = await this.paymentService.createVNPayPayment(
      orderId,
      amount,
      orderInfo || `Thanh toan don hang ${orderId}`,
      bankCode,
    );

    return result;
  }

  /**
   * MoMo callback (IPN) - Called by MoMo to notify payment status
   * This endpoint should be public (no auth guard)
   */
  @Post('momo/callback')
  async handleMoMoCallback(@Body() body: any) {
    return this.paymentService.handleMoMoCallback(body);
  }

  /**
   * Initiate PayOS payment for an order
   */
  @UseGuards(AuthGuard)
  @Post('payos/create')
  async createPayOSPayment(
    @Req() req: any,
    @Body() body: { orderId: string; amount: number; orderInfo?: string },
  ) {
    const { orderId, amount, orderInfo } = body;

    if (!orderId || !amount) {
      throw new BadRequestException('Thiếu orderId hoặc amount');
    }

    return this.paymentService.createPayOSPayment(
      orderId,
      amount,
      orderInfo || `Thanh toan don hang ${orderId}`,
    );
  }

  /**
   * PayOS webhook callback - Called by PayOS to notify payment status
   * This endpoint should be public (no auth guard)
   */
  @Post('payos/callback')
  async handlePayOSWebhook(@Body() body: any) {
    return this.paymentService.handlePayOSWebhook(body);
  }

  /**
   * VNPay callback (IPN) - Called by VNPay to notify payment status
   * VNPay sends IPN as a GET request with query parameters
   * This endpoint should be public (no auth guard)
   */
  @Get('vnpay/callback')
  async handleVNPayCallback(@Query() query: any) {
    return this.paymentService.handleVNPayCallback(query);
  }

  /**
   * Reconcile abandoned payments — restores stock for online orders
   * that were created but never completed at the payment gateway.
   * Intended to be called by a cron job every ~15 minutes.
   */
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('reconcile')
  async reconcileAbandonedPayments() {
    return this.paymentService.reconcileAbandonedPayments();
  }

  /**
   * Query payment status from MoMo
   */
  @UseGuards(AuthGuard)
  @Get('momo/query/:orderId')
  async queryMoMoPayment(@Param('orderId') orderId: string) {
    return this.paymentService.queryMoMoPayment(orderId);
  }

  /**
   * Redirect to payment result page (for frontend)
   * This handles the returnUrl callback from payment gateways
   */
  @Get('result')
  async paymentResult(@Query() query: any, @Res() res: Response) {
    // Determine which payment gateway based on query parameters
    const isVNPay = query.vnp_TxnRef && query.vnp_ResponseCode;
    const isMoMo = query.orderId && query.resultCode;

    let paymentData: any = {};

    if (isVNPay) {
      paymentData = {
        orderId: query.vnp_TxnRef,
        isSuccess: query.vnp_ResponseCode === '00',
        message:
          query.vnp_ResponseCode === '00'
            ? 'Thanh toán thành công'
            : 'Thanh toán thất bại',
        responseCode: query.vnp_ResponseCode,
        secureHash: query.vnp_SecureHash,
      };
    } else if (isMoMo) {
      paymentData = {
        orderId: query.orderId,
        isSuccess: query.resultCode === '0',
        message: query.message || 'Kết quả thanh toán',
        resultCode: query.resultCode,
      };
    } else {
      paymentData = {
        isSuccess: false,
        message: 'Không xác định được kết quả thanh toán',
      };
    }

    // Redirect to frontend payment result page with data
    const frontendUrl =
      process.env.PAYMENT_RESULT_URL || 'http://localhost:5173/payment/result';
    const params = new URLSearchParams(paymentData);
    res.redirect(`${frontendUrl}?${params.toString()}`);
  }
}
