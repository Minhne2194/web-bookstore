import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(data: {
    email: string;
    password_raw: string;
    full_name?: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email này đã được sử dụng!');
    }

    const hashedPassword = await argon2.hash(data.password_raw);

    const newUser = await this.prisma.user.create({
      data: {
        email: data.email,
        password_hash: hashedPassword,
        full_name: data.full_name,
      },
      select: {
        user_id: true,
        email: true,
        full_name: true,
        role: true,
        created_at: true,
      },
    });

    // Send welcome email (không chặn việc đăng ký nếu Redis/SMTP gặp lỗi)
    try {
      await this.emailService.sendWelcomeEmail(
        newUser.email,
        newUser.full_name || 'Khách hàng',
      );
    } catch (err) {
      console.error('Không gửi được email chào mừng (không ảnh hưởng đăng ký):', err);
    }

    return newUser;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { user_id: true, email: true, full_name: true, role: true },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      select: { 
        email: true, 
        full_name: true, 
        phone: true,
        profile: {
          select: { gender: true, birthday: true }
        }
      },
    });

    if (!user) return null;

    return {
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      gender: user.profile?.gender,
      birthday: user.profile?.birthday,
    };
  }

  async updateProfile(
    userId: string,
    data: { full_name?: string; phone?: string; gender?: string; birthday?: string },
  ) {
    await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        full_name: data.full_name,
        phone: data.phone,
      },
    });

    if (data.gender !== undefined || data.birthday !== undefined) {
      let birthdayDate: Date | null = null;
      if (data.birthday) {
        birthdayDate = new Date(data.birthday);
      }

      await this.prisma.userProfile.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          gender: data.gender,
          birthday: birthdayDate,
        },
        update: {
          gender: data.gender,
          birthday: birthdayDate,
        },
      });
    }

    return this.getProfile(userId);
  }

  async deleteAccount(userId: string) {
    try {
      await this.prisma.user.delete({
        where: { user_id: userId },
      });
      return { message: 'Xóa tài khoản thành công' };
    } catch (error) {
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Không thể xóa tài khoản vì bạn đã có lịch sử giao dịch (đơn hàng/đánh giá) trong hệ thống.',
        );
      }
      throw new BadRequestException('Có lỗi xảy ra khi xóa tài khoản.');
    }
  }

  // --- Address Book ---

  async getAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async addAddress(
    userId: string,
    data: {
      receiver_name: string;
      phone: string;
      province: string;
      district: string;
      ward: string;
      street: string;
      is_default?: boolean;
      address_type?: string;
    },
  ) {
    if (data.is_default) {
      await this.prisma.userAddress.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.userAddress.create({
      data: {
        user_id: userId,
        receiver_name: data.receiver_name,
        phone: data.phone,
        province: data.province,
        district: data.district,
        ward: data.ward,
        street: data.street,
        is_default: data.is_default ?? false,
        address_type: data.address_type ?? 'home',
      },
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    data: {
      receiver_name?: string;
      phone?: string;
      province?: string;
      district?: string;
      ward?: string;
      street?: string;
      is_default?: boolean;
      address_type?: string;
    },
  ) {
    const address = await this.prisma.userAddress.findFirst({
      where: { address_id: addressId, user_id: userId },
    });
    if (!address) {
      throw new BadRequestException('Địa chỉ không tồn tại.');
    }

    if (data.is_default) {
      await this.prisma.userAddress.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { address_id: addressId },
      data: {
        receiver_name: data.receiver_name,
        phone: data.phone,
        province: data.province,
        district: data.district,
        ward: data.ward,
        street: data.street,
        is_default: data.is_default,
        address_type: data.address_type,
      },
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { address_id: addressId, user_id: userId },
    });
    if (!address) {
      throw new BadRequestException('Địa chỉ không tồn tại.');
    }

    await this.prisma.userAddress.delete({
      where: { address_id: addressId },
    });
    return { message: 'Xóa địa chỉ thành công.' };
  }
}
