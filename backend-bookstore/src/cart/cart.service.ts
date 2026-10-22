import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  private redis: Redis;

  private readonly freeShipCodes: Set<string>;

  constructor(private prisma: PrismaService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    });

    const envCodes = (process.env.FREE_SHIP_CODES || '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    this.freeShipCodes = new Set(['FREESHIP', 'MIENPHI', ...envCodes]);
  }

  async getCart(userId: string) {
    const cartData = await this.redis.get(`cart:${userId}`);
    if (cartData) {
      return JSON.parse(cartData);
    }
    return { items: [] };
  }

  async addToCart(userId: string, bookId: string, quantity: number) {
    const cart = await this.getCart(userId);

    const existingItem = cart.items.find((item: any) => item.bookId === bookId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ bookId, quantity });
    }

    await this.redis.set(`cart:${userId}`, JSON.stringify(cart), 'EX', 604800);

    return cart;
  }

  async updateCartItem(userId: string, bookId: string, quantity: number) {
    const cart = await this.getCart(userId);

    const existingItem = cart.items.find((item: any) => item.bookId === bookId);

    if (!existingItem) {
      // If not in cart, add it
      cart.items.push({ bookId, quantity });
    } else if (quantity <= 0) {
      // If quantity is 0 or negative, remove the item
      cart.items = cart.items.filter((item: any) => item.bookId !== bookId);
    } else {
      existingItem.quantity = quantity;
    }

    await this.redis.set(`cart:${userId}`, JSON.stringify(cart), 'EX', 604800);
    return cart;
  }

  /**
   * Merge guest cart into user cart
   */
  async mergeCart(guestId: string, userId: string) {
    const guestCart = await this.getCart(guestId);
    if (!guestCart.items || guestCart.items.length === 0) {
      return this.getCart(userId);
    }

    const userCart = await this.getCart(userId);
    
    // Merge logic: Add guest items to user items.
    for (const guestItem of guestCart.items) {
      const existingItem = userCart.items.find((item: any) => item.bookId === guestItem.bookId);
      if (existingItem) {
        existingItem.quantity += guestItem.quantity;
      } else {
        userCart.items.push(guestItem);
      }
    }

    // Save user cart
    await this.redis.set(`cart:${userId}`, JSON.stringify(userCart), 'EX', 604800);
    // Delete guest cart
    await this.redis.del(`cart:${guestId}`);

    return userCart;
  }

  /**
   * Validate a promo code. Returns discount info if valid, error if not.
   */
  async validatePromo(code: string) {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) {
      return { valid: false, message: 'Vui lòng nhập mã khuyến mãi.' };
    }
    if (this.freeShipCodes.has(normalized)) {
      return {
        valid: true,
        discount: 30000,
        type: 'free_shipping',
        description: 'Miễn phí vận chuyển',
      };
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { code: normalized }
    });

    if (!coupon) {
      return { valid: false, message: 'Mã khuyến mãi không tồn tại hoặc không hợp lệ.' };
    }

    if (!coupon.is_active) {
      return { valid: false, message: 'Mã khuyến mãi đã bị vô hiệu hóa.' };
    }

    const now = new Date();
    if (now < coupon.start_date) {
      return { valid: false, message: 'Mã khuyến mãi chưa có hiệu lực.' };
    }

    if (now > coupon.end_date) {
      return { valid: false, message: 'Mã khuyến mãi đã hết hạn.' };
    }

    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return { valid: false, message: 'Mã khuyến mãi đã hết lượt sử dụng.' };
    }

    let description = '';
    if (coupon.discount_type === 'percentage') {
      description = `Giảm ${coupon.discount_value}%`;
    } else if (coupon.discount_type === 'fixed_amount') {
      description = `Giảm ${Number(coupon.discount_value).toLocaleString('vi-VN')}đ`;
    } else if (coupon.discount_type === 'free_shipping') {
      description = 'Miễn phí vận chuyển';
    }

    return {
      valid: true,
      discount: coupon.discount_value,
      type: coupon.discount_type,
      description: description,
    };
  }

  async removeFromCart(userId: string, bookId: string) {
    const cart = await this.getCart(userId);
    cart.items = cart.items.filter((item: any) => item.bookId !== bookId);

    await this.redis.set(`cart:${userId}`, JSON.stringify(cart), 'EX', 604800);
    return cart;
  }
}
