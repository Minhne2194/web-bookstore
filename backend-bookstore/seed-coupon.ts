import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createPgPool } from './src/prisma/create-pg-pool';

const pool = createPgPool();
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.coupon.createMany({
    data: [
      { code: 'SALE10', discount_type: 'percentage', discount_value: 10, start_date: new Date(), end_date: new Date('2026-12-31') },
      { code: 'GIAM50K', discount_type: 'fixed_amount', discount_value: 50000, start_date: new Date(), end_date: new Date('2026-12-31') },
      { code: 'FREESHIP', discount_type: 'free_shipping', discount_value: 30000, start_date: new Date(), end_date: new Date('2026-12-31') },
    ],
    skipDuplicates: true
  });
  console.log('Coupons created');
}
main().finally(() => prisma.$disconnect());
