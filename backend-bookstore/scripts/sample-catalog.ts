/**
 * Tạo bộ dữ liệu catalog con (mặc định 10%) từ dữ liệu crawler đầy đủ — dùng cho môi trường deploy.
 * Chạy: npx ts-node scripts/sample-catalog.ts           → books_seed_10pct.json (sample 10% sách, giữ nguyên toàn bộ danh mục)
 *       SAMPLE_PERCENT=20 npx ts-node scripts/sample-catalog.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const PERCENT = Number(process.env.SAMPLE_PERCENT || 10);

const outputDir = path.join(__dirname, 'crawler', 'output');
const booksFile = path.join(outputDir, 'books_seed.json');
const catsFile = path.join(outputDir, 'categories_seed.json');

const books = JSON.parse(fs.readFileSync(booksFile, 'utf8'));
const cats = JSON.parse(fs.readFileSync(catsFile, 'utf8'));

// Loại sách không có giá hợp lệ (price = 0 khi hết hàng trên Fahasa)
const priced = (books as any[]).filter((b) => Number(b.price) > 0);

// Chọn mẫu xác định (deterministic): sắp theo isbn rồi lấy mỗi bước thứ N
const sorted = [...priced].sort((a: any, b: any) =>
  String(a.isbn).localeCompare(String(b.isbn)),
);
const step = Math.max(1, Math.round(100 / PERCENT));
const sample = sorted.filter((_, i) => i % step === 0);

fs.writeFileSync(
  path.join(outputDir, `books_seed_${PERCENT}pct.json`),
  `${JSON.stringify(sample, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(outputDir, `categories_seed_${PERCENT}pct.json`),
  `${JSON.stringify(cats, null, 2)}\n`,
  'utf8',
);

console.log(
  `[sample] ${PERCENT}% → ${sample.length}/${books.length} books, ${cats.length} categories`,
);
