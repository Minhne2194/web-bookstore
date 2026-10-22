import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Delete,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

@UseGuards(OptionalAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private getUserIdOrGuestId(req: any): string {
    const userId = req.user?.sub || req.headers['x-guest-id'];
    if (!userId) {
      throw new BadRequestException('Missing authentication or guest ID');
    }
    return userId;
  }

  // Lấy giỏ hàng
  @Get()
  getCart(@Req() req: any) {
    const userId = this.getUserIdOrGuestId(req);
    return this.cartService.getCart(userId);
  }

  // Thêm sách vào giỏ hàng
  @Post('add')
  addToCart(
    @Req() req: any,
    @Body() body: { bookId: string; quantity: number },
  ) {
    const userId = this.getUserIdOrGuestId(req);
    return this.cartService.addToCart(userId, body.bookId, body.quantity);
  }

  // Cập nhật số lượng sách trong giỏ hàng
  @Put('update')
  updateCartItem(
    @Req() req: any,
    @Body() body: { bookId: string; quantity: number },
  ) {
    const userId = this.getUserIdOrGuestId(req);
    return this.cartService.updateCartItem(userId, body.bookId, body.quantity);
  }

  // Xóa 1 cuốn sách khỏi giỏ hàng
  @Delete('remove/:bookId')
  removeFromCart(@Req() req: any, @Param('bookId') bookId: string) {
    const userId = this.getUserIdOrGuestId(req);
    return this.cartService.removeFromCart(userId, bookId);
  }

  // Kiểm tra mã khuyến mãi (free ship)
  @Post('validate-promo')
  validatePromo(@Body() body: { code: string }) {
    return this.cartService.validatePromo(body.code);
  }
}
