/**
 * Seed tổng hợp cho BẢN DEPLOY — bản thu nhỏ 10% của `prisma/seed-synthetic.ts`.
 *
 * Mặc định gốc (quá nặng cho Postgres free 30 ngày của Render):
 *   500 user · 10.000 đơn · 50.000 đánh giá · 200.000 hành vi
 * Bản này:
 *    50 user ·  1.000 đơn ·  5.000 đánh giá ·  20.000 hành vi
 *
 * Việc nó làm: tạo user/đơn/hành vi tổng hợp, sinh đánh giá (90% ở trạng thái
 * approved nên hiện ngay trên trang sách), rồi tính lại avg_rating +
 * rating_count cho toàn bộ sách.
 *
 * Điều kiện: DB đã có sách (đã chạy `catalog:seed` trên bản deploy).
 *
 * Chạy (DATABASE_URL của Render nằm trong backend-bookstore/.env.render.txt):
 *   DATABASE_URL="$(grep DATABASE_URL .env.render.txt | cut -d'"' -f2)" \
 *     npx ts-node prisma/seed-synthetic-deploy.ts
 *
 * Muốn đổi tỉ lệ thì truyền biến môi trường, ví dụ:
 *   SEED_REVIEW_COUNT=8000 SEED_ORDER_COUNT=1500 npx ts-node prisma/seed-synthetic-deploy.ts
 *
 * Lưu ý:
 *   - Chạy lại sẽ TẠO THÊM user/đơn/đánh giá mới, không ghi đè bản cũ.
 *   - Chỉ chọn MỘT trong hai script: file này hoặc `scripts/seed-reviews-deploy.ts`
 *     (script kia chỉ thêm đánh giá, không tạo đơn giả).
 */

process.env.SEED_USER_COUNT ??= '50';
process.env.SEED_ORDER_COUNT ??= '1000';
process.env.SEED_REVIEW_COUNT ??= '5000';
process.env.SEED_EVENT_COUNT ??= '20000';

/* eslint-disable @typescript-eslint/no-var-requires */
require('./seed-synthetic');
