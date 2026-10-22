import 'dotenv/config'; // <-- DÒNG NÀY SẼ GIẢI QUYẾT TẤT CẢ! (Tự động đọc file .env)
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createPgPool } from './create-pg-pool';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Lúc này process.env.DATABASE_URL chắc chắn đã có giá trị!
    const pool = createPgPool();
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('📦 Đã kết nối Database thành công!');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
