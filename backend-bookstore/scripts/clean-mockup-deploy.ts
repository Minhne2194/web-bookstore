/**
 * Dọn dữ liệu mockup trên DB deploy (Render):
 *  - Ẩn (is_active = false) các sách mockup cũ không có trong catalog crawler thật.
 *  - Xóa các danh mục mockup/junk không có trong categories_seed_deploy.json
 *    (Sách trong nước, Sách ngoại văn, Công nghệ - Lập trình, Fiction, ... Tới trang chủ).
 *
 * Chạy (DATABASE_URL của Render lấy từ .env.render.txt — không in ra):
 *   DATABASE_URL="$(grep DATABASE_URL .env.render.txt | cut -d'"' -f2)" npx ts-node scripts/clean-mockup-deploy.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { createPgPool } from '../src/prisma/create-pg-pool';

const BOOK_ISBN_MAX_LEN = 20;

/** Tái tạo đúng cách seed.ts chuẩn hóa ISBN trước khi lưu vào DB. */
function normalizeBookIsbn(item: any): string {
  const rawIsbn = String(item.isbn ?? '').trim();
  if (rawIsbn && rawIsbn.length <= BOOK_ISBN_MAX_LEN) {
    return rawIsbn;
  }
  const seed = `${rawIsbn}|${String(item.metadata?.source_url ?? '')}|${item.title}`;
  const digest = createHash('sha1')
    .update(seed)
    .digest('hex')
    .slice(0, BOOK_ISBN_MAX_LEN - 4);
  return `FHS-${digest}`;
}

async function main() {
  const outputDir = path.join(__dirname, 'crawler', 'output');
  const crawlerBooks = JSON.parse(
    fs.readFileSync(path.join(outputDir, 'books_seed.json'), 'utf-8'),
  ) as any[];
  const deployCats = JSON.parse(
    fs.readFileSync(
      path.join(outputDir, 'categories_seed_deploy.json'),
      'utf-8',
    ),
  ) as any[];

  const realIsbns = new Set(crawlerBooks.map(normalizeBookIsbn));
  const validSlugs = new Set(deployCats.map((c) => c.slug));

  const pool = createPgPool();
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  // 1. Ẩn sách mockup (ISBN không có trong catalog crawler thật)
  const allBooks = await prisma.book.findMany({
    select: { book_id: true, isbn: true, title: true },
    orderBy: { title: 'asc' },
  });
  const mockBooks = allBooks.filter(
    (b) => b.isbn === null || !realIsbns.has(b.isbn),
  );
  if (mockBooks.length > 0) {
    await prisma.book.updateMany({
      where: { book_id: { in: mockBooks.map((b) => b.book_id) } },
      data: { is_active: false },
    });
    console.log(`[clean] Đã ẩn ${mockBooks.length} sách mockup:`);
    for (const b of mockBooks) console.log(`  - ${b.title} (${b.isbn})`);
  } else {
    console.log('[clean] Không có sách mockup.');
  }

  // 2. Xóa danh mục không có trong file deploy (mockup/junk), con trước cha sau
  const allCats = await prisma.category.findMany({
    select: { category_id: true, name: true, slug: true, level: true },
  });
  const toDelete = allCats.filter((c) => !validSlugs.has(c.slug));
  let deleted = 0;
  for (const level of [4, 3, 2, 1]) {
    const ids = toDelete
      .filter((c) => c.level === level)
      .map((c) => c.category_id);
    if (ids.length === 0) continue;
    const res = await prisma.category.deleteMany({
      where: { category_id: { in: ids } },
    });
    deleted += res.count;
  }
  console.log(`[clean] Đã xóa ${deleted} danh mục mockup/junk:`);
  for (const c of toDelete) console.log(`  - ${c.name} (${c.slug})`);

  const remainBooks = await prisma.book.count({ where: { is_active: true } });
  const remainCats = await prisma.category.count();
  console.log(
    `[clean] Xong. Sách active: ${remainBooks} | Danh mục: ${remainCats}`,
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('[clean] Lỗi:', err instanceof Error ? err.message : err);
  process.exit(1);
});
