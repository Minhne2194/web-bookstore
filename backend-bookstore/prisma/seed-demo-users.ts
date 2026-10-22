/**
 * Seed tài khoản demo (admin + customer).
 * Chạy:  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/bookstore?schema=public" npx ts-node prisma/seed-demo-users.ts
 * Idempotent.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import 'dotenv/config';
import { createPgPool } from '../src/prisma/create-pg-pool';

const pool = createPgPool();
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminHash = await argon2.hash('admin123');
  const customerHash = await argon2.hash('customer123');

  await prisma.user.upsert({
    where: { email: 'admin@bookstore.com' },
    update: {
      password_hash: adminHash,
      full_name: 'Admin BookStore',
      role: 'admin',
      status: 'active',
      email_verified: true,
    },
    create: {
      email: 'admin@bookstore.com',
      password_hash: adminHash,
      full_name: 'Admin BookStore',
      role: 'admin',
      status: 'active',
      email_verified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@bookstore.com' },
    update: {
      password_hash: customerHash,
      full_name: 'Khách Hàng Demo',
      phone: '0901234567',
      role: 'customer',
      status: 'active',
      email_verified: true,
    },
    create: {
      email: 'customer@bookstore.com',
      password_hash: customerHash,
      full_name: 'Khách Hàng Demo',
      phone: '0901234567',
      role: 'customer',
      status: 'active',
      email_verified: true,
    },
  });

  console.log('✅ Demo users ready:');
  console.log('   Admin   : admin@bookstore.com    / admin123');
  console.log('   Customer: customer@bookstore.com / customer123');
}

main()
  .catch((e) => {
    console.error('❌ Seed demo users failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
