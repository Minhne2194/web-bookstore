import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Put,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ChangePaymentDto } from '../payment/dto/change-payment.dto';

@UseGuards(AuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  checkout(@Req() req: any, @Body() dto: CreateOrderDto) {
    const userId = req.user.sub;
    return this.ordersService.checkout(userId, dto);
  }

  @Get('my-orders')
  getMyOrders(@Req() req: any) {
    const userId = req.user.sub;
    return this.ordersService.getMyOrders(userId);
  }

  @Get('all')
  getAllOrders(@Req() req: any) {
    if (req.user.role !== 'admin')
      throw new ForbiddenException('Chỉ Admin mới có quyền xem!');
    return this.ordersService.getAllOrdersForAdmin();
  }

  @Put(':id/status')
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    if (req.user.role !== 'admin')
      throw new ForbiddenException('Chỉ Admin mới có quyền sửa!');
    return this.ordersService.updateOrderStatus(id, dto.status);
  }

  @Get(':id/payment-info')
  getPaymentInfo(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.ordersService.getOrderForPayment(id, userId);
  }

  @Post(':id/change-payment')
  changePayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ChangePaymentDto,
  ) {
    const userId = req.user.sub;
    return this.ordersService.changePaymentMethod(
      id,
      userId,
      dto.payment_method,
    );
  }

  @Post(':id/cancel')
  cancelOrder(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.ordersService.cancelPendingOrder(id, userId);
  }
}
