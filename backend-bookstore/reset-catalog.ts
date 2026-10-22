import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createPgPool } from './src/prisma/create-pg-pool';

const pool = createPgPool();
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Bắt đầu reset dữ liệu Catalog (Sách, Tác giả, NXB, Danh mục)...');

  // Xóa theo thứ tự để tránh lỗi ràng buộc (nếu có)
  // Lưu ý: BookAuthor và BookCategory đã có onDelete: Cascade nên sẽ tự động mất khi xóa Book
  
  const books = await prisma.book.deleteMany({});
  console.log(`- Đã xóa ${books.count} cuốn sách.`);

  const authors = await prisma.author.deleteMany({});
  console.log(`- Đã xóa ${authors.count} tác giả.`);

  const publishers = await prisma.publisher.deleteMany({});
  console.log(`- Đã xóa ${publishers.count} nhà xuất bản.`);

  const categories = await prisma.category.deleteMany({});
  console.log(`- Đã xóa ${categories.count} danh mục.`);

  console.log('✅ Hoàn tất reset Catalog. Dữ liệu người dùng và đơn hàng vẫn được giữ nguyên.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Lỗi khi reset:', e);
    await prisma.$disconnect();
    pool.end();
    process.exit(1);
  });
