import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { CartService } from '../cart/cart.service';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private cartService: CartService,
  ) {}

  async login(email: string, password_raw: string, guestId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');
    }

    const isPasswordValid = await argon2.verify(
      user.password_hash,
      password_raw,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');
    }

    // Merge cart if guestId is provided
    if (guestId) {
      await this.cartService.mergeCart(guestId, user.user_id).catch(err => {
        console.error('Lỗi merge cart:', err);
      });
    }

    const payload = { sub: user.user_id, email: user.email, role: user.role };

    // Create session (Refresh Token)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '7', 10) || 7));

    const session = await this.prisma.userSession.create({
      data: {
        user_id: user.user_id,
        expires_at: expiresAt,
        device_info: {}, // Optional: could save user-agent here
      }
    });

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: session.session_id,
      user: {
        id: user.user_id,
        email: user.email,
        name: user.full_name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const session = await this.prisma.userSession.findUnique({
      where: { session_id: refreshToken },
      include: { user: true }
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > session.expires_at) {
      // Delete expired session
      await this.prisma.userSession.deleteMany({ where: { session_id: refreshToken } });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = session.user;
    const payload = { sub: user.user_id, email: user.email, role: user.role };

    // Refresh token rotation (optional, but good for security):
    // Extend expiry by 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '7', 10) || 7));
    await this.prisma.userSession.update({
      where: { session_id: refreshToken },
      data: { expires_at: expiresAt }
    });

    return {
      access_token: await this.jwtService.signAsync(payload),
      refresh_token: session.session_id
    };
  }
}
