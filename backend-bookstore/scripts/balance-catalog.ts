/**
 * Tạo bộ catalog cho deploy: ~700 sách, phân bố ĐỀU theo danh mục.
 *
 * Khác với sample-catalog.ts (lấy mỗi bước thứ N theo ISBN → nhiều danh mục trống),
 * script này đảm bảo:
 *  - Mỗi danh mục level 2 có ít nhất 12 sách (nếu dữ liệu đủ),
 *  - Mỗi danh mục level 3 có ít nhất 2 sách, level 4 ít nhất 1 sách,
 *  - Sau đó bổ sung vòng tròn theo level 2 cho tới TARGET (~700),
 *  - Loại bỏ danh mục rác "Tới trang chủ" và "Tất Cả Nhóm Series" (không có sách thật).
 *
 * Chạy: npx ts-node scripts/balance-catalog.ts            → 700 sách
 *       DEPLOY_SAMPLE_SIZE=800 npx ts-node scripts/balance-catalog.ts
 * Kết quả: scripts/crawler/output/books_seed_deploy.json + categories_seed_deploy.json
 */

import * as fs from 'fs';
import * as path from 'path';

const TARGET = Number(process.env.DEPLOY_SAMPLE_SIZE || 700);
const JUNK_CATEGORIES = new Set(['Tới trang chủ', 'Tất Cả Nhóm Series']);

const outputDir = path.join(__dirname, 'crawler', 'output');
const booksFile = path.join(outputDir, 'books_seed.json');
const catsFile = path.join(outputDir, 'categories_seed.json');

const books = JSON.parse(fs.readFileSync(booksFile, 'utf8')) as any[];
const cats = JSON.parse(fs.readFileSync(catsFile, 'utf8')) as any[];

// Danh mục deploy: bỏ danh mục rác
const deployCats = cats.filter((c) => !JUNK_CATEGORIES.has(c.name));
const deployCatNames = new Set(deployCats.map((c) => c.name));

// Sách hợp lệ (có giá) + rửa danh mục rác khỏi danh sách categories
const priced = books
  .filter((b) => Number(b.price) > 0)
  .map((b) => ({
    ...b,
    categories: (b.categories || []).filter(
      (c: string) => !JUNK_CATEGORIES.has(c),
    ),
  }));

// Index sách theo danh mục (sắp theo sold_count giảm dần)
const byCat = new Map<string, any[]>();
for (const b of priced) {
  for (const c of b.categories) {
    if (!deployCatNames.has(c)) continue;
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(b);
  }
}
for (const list of byCat.values()) {
  list.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
}

const picked = new Map<string, any>(); // isbn -> book

// Phase 1: đảm bảo mỗi danh mục có đủ quota (ưu tiên danh mục ít sách trước)
const quotaOf = (level: number) => (level === 2 ? 12 : level === 3 ? 2 : 1);
const catsByQuota = [...deployCats].sort(
  (a, b) => (byCat.get(a.name)?.length || 0) - (byCat.get(b.name)?.length || 0),
);
for (const c of catsByQuota) {
  const quota = quotaOf(c.level);
  const list = byCat.get(c.name) || [];
  let got = 0;
  for (const b of list) {
    if (got >= quota) break;
    if (picked.has(b.isbn)) continue;
    picked.set(b.isbn, b);
    got += 1;
  }
}

// Phase 2: bổ sung vòng tròn theo level 2 cho tới TARGET
const l2 = deployCats.filter((c) => c.level === 2);
let idx = 0;
let idleRounds = 0;
while (picked.size < TARGET && l2.length > 0 && idleRounds < l2.length) {
  const cat = l2[idx % l2.length];
  const list = byCat.get(cat.name) || [];
  let added = false;
  for (const b of list) {
    if (picked.size >= TARGET) break;
    if (!picked.has(b.isbn)) {
      picked.set(b.isbn, b);
      added = true;
      break;
    }
  }
  idx += 1;
  idleRounds = added ? 0 : idleRounds + 1;
}

// Phase 3: nếu vẫn thiếu, lấy nốt theo sold_count chung
if (picked.size < TARGET) {
  const rest = [...priced].sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
  for (const b of rest) {
    if (picked.size >= TARGET) break;
    picked.set(b.isbn, b);
  }
}

const sample = [...picked.values()];
fs.writeFileSync(
  path.join(outputDir, 'books_seed_deploy.json'),
  `${JSON.stringify(sample, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(outputDir, 'categories_seed_deploy.json'),
  `${JSON.stringify(deployCats, null, 2)}\n`,
  'utf8',
);

// Báo cáo phân bố
const dist: Record<string, number> = {};
for (const b of sample) {
  for (const c of b.categories) {
    if (!deployCatNames.has(c)) continue;
    dist[c] = (dist[c] || 0) + 1;
  }
}
console.log(
  `[balance] ${sample.length}/${priced.length} books, ${deployCats.length} categories (bỏ ${cats.length - deployCats.length} danh mục rác)`,
);
console.log('[balance] Phân bố level 2:');
for (const c of deployCats.filter((c) => c.level === 2)) {
  console.log(`  ${dist[c.name] || 0}`.padStart(4) + `  ${c.name}`);
}
