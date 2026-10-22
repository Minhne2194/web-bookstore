/**
 * Seed dữ liệu mẫu (sách + danh mục + tác giả + NXB) — dùng khi chưa có crawler data.
 * Cấu trúc danh mục 2 tầng giống crawler Fahasa: level 1 = cha (Sách trong nước / Sách ngoại văn), level 2 = thể loại.
 * Chạy:  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/bookstore?schema=public" npx ts-node prisma/seed-sample.ts
 * Idempotent: có thể chạy lại nhiều lần không bị trùng.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { createPgPool } from '../src/prisma/create-pg-pool';

const pool = createPgPool();
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface SampleCategory {
  name: string;
  slug: string;
  level: number;
  parent_slug?: string;
}

const categories: SampleCategory[] = [
  // Level 1 — cha
  { name: 'Sách trong nước', slug: 'sach-trong-nuoc', level: 1 },
  { name: 'Sách ngoại văn', slug: 'sach-ngoai-van', level: 1 },
  // Level 2 — thể loại (header hiển thị các mục level 2)
  { name: 'Văn học', slug: 'van-hoc', level: 2, parent_slug: 'sach-trong-nuoc' },
  { name: 'Kinh tế - Kinh doanh', slug: 'kinh-te-kinh-doanh', level: 2, parent_slug: 'sach-trong-nuoc' },
  { name: 'Kỹ năng sống', slug: 'ky-nang-song', level: 2, parent_slug: 'sach-trong-nuoc' },
  { name: 'Công nghệ - Lập trình', slug: 'cong-nghe-lap-trinh', level: 2, parent_slug: 'sach-trong-nuoc' },
  { name: 'Tâm lý học', slug: 'tam-ly-hoc', level: 2, parent_slug: 'sach-trong-nuoc' },
  { name: 'Thiếu nhi', slug: 'thieu-nhi', level: 2, parent_slug: 'sach-trong-nuoc' },
  { name: 'Fiction', slug: 'fiction', level: 2, parent_slug: 'sach-ngoai-van' },
  { name: 'Self-Help', slug: 'self-help', level: 2, parent_slug: 'sach-ngoai-van' },
];

const authors = [
  'Nguyễn Nhật Ánh',
  'Haruki Murakami',
  'Paulo Coelho',
  'Dale Carnegie',
  'Yuval Noah Harari',
  'Robert C. Martin',
  'Andrew Hunt',
  'Daniel Kahneman',
  'Charles Duhigg',
  'Cal Newport',
  'Adam Grant',
  'Antoine de Saint-Exupéry',
  'J.K. Rowling',
  'Tô Hoài',
  'José Mauro de Vasconcelos',
  'Rosie Nguyễn',
  'Nguyên Phong',
  'Douglas Crockford',
  'James Clear',
  'Trác Nhã',
  'George Orwell',
  'Simon Sinek',
  'F. Scott Fitzgerald',
];

const publishers = [
  'Nhà Xuất Bản Trẻ',
  'Nhà Xuất Bản Kim Đồng',
  'Nhà Xuất Bản Lao Động',
  'Nhà Xuất Bản Thế Giới',
  'NXB Thông tin và Truyền thông',
];

interface SampleBook {
  title: string;
  price: number;
  compare_price?: number;
  description: string;
  isbn: string;
  category: string; // category slug
  author: string;
  publisher: string;
  page_count?: number;
  publish_year?: number;
}

const books: SampleBook[] = [
  { title: 'Cho Tôi Xin Một Vé Đi Tuổi Thơ', price: 89000, compare_price: 99000, description: 'Tác phẩm kinh điển về tuổi thơ của nhà văn Nguyễn Nhật Ánh.', isbn: '9786041012345', category: 'van-hoc', author: 'Nguyễn Nhật Ánh', publisher: 'Nhà Xuất Bản Trẻ', page_count: 208, publish_year: 2008 },
  { title: 'Mắt Biếc', price: 95000, description: 'Câu chuyện tình yêu buồn và đẹp của Ngạn và Hà Lan.', isbn: '9786041012352', category: 'van-hoc', author: 'Nguyễn Nhật Ánh', publisher: 'Nhà Xuất Bản Trẻ', page_count: 232, publish_year: 1990 },
  { title: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh', price: 99000, description: 'Tuổi thơ trong trẻo nơi làng quê qua góc nhìn của cậu bé Thiều.', isbn: '9786041012369', category: 'van-hoc', author: 'Nguyễn Nhật Ánh', publisher: 'Nhà Xuất Bản Trẻ', page_count: 360, publish_year: 2010 },
  { title: 'Rừng Na Uy', price: 145000, compare_price: 160000, description: 'Tiểu thuyết tình yêu nổi tiếng nhất của Haruki Murakami.', isbn: '9786041012376', category: 'van-hoc', author: 'Haruki Murakami', publisher: 'Nhà Xuất Bản Lao Động', page_count: 480, publish_year: 1987 },
  { title: 'Nhà Giả Kim', price: 79000, description: 'Hành trình theo đuổi giấc mơ của chàng chăn cừu Santiago.', isbn: '9786041012383', category: 'van-hoc', author: 'Paulo Coelho', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 224, publish_year: 1988 },
  { title: 'Đắc Nhân Tâm', price: 86000, compare_price: 110000, description: 'Nghệ thuật giao tiếp và đối nhân xử thế kinh điển.', isbn: '9786041012390', category: 'ky-nang-song', author: 'Dale Carnegie', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 320, publish_year: 1936 },
  { title: 'Sapiens: Lược Sử Loài Người', price: 260000, description: 'Lịch sử loài người từ thời tiền sử đến kỷ nguyên công nghệ.', isbn: '9786041012406', category: 'kinh-te-kinh-doanh', author: 'Yuval Noah Harari', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 560, publish_year: 2011 },
  { title: 'Homo Deus: Lược Sử Tương Lai', price: 240000, description: 'Dự đoán tương lai nhân loại trong kỷ nguyên trí tuệ nhân tạo.', isbn: '9786041012413', category: 'kinh-te-kinh-doanh', author: 'Yuval Noah Harari', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 512, publish_year: 2015 },
  { title: 'Clean Code', price: 320000, compare_price: 380000, description: 'Cẩm nang viết mã sạch và bảo trì dễ dàng cho lập trình viên.', isbn: '9786041012420', category: 'cong-nghe-lap-trinh', author: 'Robert C. Martin', publisher: 'NXB Thông tin và Truyền thông', page_count: 464, publish_year: 2008 },
  { title: 'The Pragmatic Programmer', price: 380000, description: 'Tư duy và kỹ năng thực dụng để trở thành lập trình viên giỏi.', isbn: '9786041012437', category: 'cong-nghe-lap-trinh', author: 'Andrew Hunt', publisher: 'NXB Thông tin và Truyền thông', page_count: 352, publish_year: 1999 },
  { title: 'Tư Duy Nhanh Và Chậm', price: 250000, description: 'Khám phá hai hệ thống tư duy chi phối mọi quyết định của con người.', isbn: '9786041012444', category: 'tam-ly-hoc', author: 'Daniel Kahneman', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 499, publish_year: 2011 },
  { title: 'Sức Mạnh Của Thói Quen', price: 150000, description: 'Vì sao chúng ta làm những gì chúng ta làm và cách thay đổi.', isbn: '9786041012451', category: 'ky-nang-song', author: 'Charles Duhigg', publisher: 'Nhà Xuất Bản Lao Động', page_count: 400, publish_year: 2012 },
  { title: 'Deep Work', price: 165000, description: 'Làm việc sâu — kỹ năng quý giá trong thời đại phân tán.', isbn: '9786041012468', category: 'ky-nang-song', author: 'Cal Newport', publisher: 'Nhà Xuất Bản Lao Động', page_count: 296, publish_year: 2016 },
  { title: 'Give and Take', price: 175000, description: 'Vì sao người cho đi lại thường thành công hơn trong sự nghiệp.', isbn: '9786041012475', category: 'kinh-te-kinh-doanh', author: 'Adam Grant', publisher: 'Nhà Xuất Bản Lao Động', page_count: 320, publish_year: 2013 },
  { title: 'Hoàng Tử Bé', price: 69000, description: 'Câu chuyện cổ tích hiện đại về tình bạn và ý nghĩa cuộc sống.', isbn: '9786041012482', category: 'thieu-nhi', author: 'Antoine de Saint-Exupéry', publisher: 'Nhà Xuất Bản Kim Đồng', page_count: 112, publish_year: 1943 },
  { title: 'Harry Potter và Hòn Đá Phù Thủy', price: 120000, compare_price: 150000, description: 'Tập đầu của loạt truyện phù thủy nổi tiếng toàn cầu.', isbn: '9786041012499', category: 'thieu-nhi', author: 'J.K. Rowling', publisher: 'Nhà Xuất Bản Trẻ', page_count: 368, publish_year: 1997 },
  { title: 'Dế Mèn Phiêu Lưu Ký', price: 75000, description: 'Cuộc phiêu lưu kỳ thú của chú Dế Mèn dũng cảm.', isbn: '9786041012505', category: 'thieu-nhi', author: 'Tô Hoài', publisher: 'Nhà Xuất Bản Kim Đồng', page_count: 240, publish_year: 1941 },
  { title: 'Cây Cam Ngọt Của Tôi', price: 88000, description: 'Tuổi thơ đầy nước mắt và yêu thương của cậu bé Zezé.', isbn: '9786041012512', category: 'van-hoc', author: 'José Mauro de Vasconcelos', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 240, publish_year: 1968 },
  { title: 'Tuổi Trẻ Đáng Giá Bao Nhiêu', price: 92000, description: 'Cẩm nang sống hết mình cho người trẻ Việt Nam.', isbn: '9786041012529', category: 'ky-nang-song', author: 'Rosie Nguyễn', publisher: 'Nhà Xuất Bản Trẻ', page_count: 288, publish_year: 2016 },
  { title: 'Muôn Kiếp Nhân Sinh', price: 180000, compare_price: 220000, description: 'Hành trình tâm linh và bài học nhân quả sâu sắc.', isbn: '9786041012536', category: 'tam-ly-hoc', author: 'Nguyên Phong', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 432, publish_year: 2020 },
  { title: 'JavaScript: The Good Parts', price: 210000, description: 'Khám phá những phần tốt đẹp nhất của ngôn ngữ JavaScript.', isbn: '9786041012543', category: 'cong-nghe-lap-trinh', author: 'Douglas Crockford', publisher: 'NXB Thông tin và Truyền thông', page_count: 176, publish_year: 2008 },
  { title: 'Atomic Habits', price: 158000, description: 'Thay đổi nhỏ tạo nên kết quả lớn — khoa học về thói quen.', isbn: '9786041012550', category: 'ky-nang-song', author: 'James Clear', publisher: 'Nhà Xuất Bản Lao Động', page_count: 320, publish_year: 2018 },
  { title: 'Khéo Ăn Nói Sẽ Có Được Thiên Hạ', price: 98000, description: 'Bí quyết giao tiếp khôn khéo để thành công trong công việc.', isbn: '9786041012567', category: 'ky-nang-song', author: 'Trác Nhã', publisher: 'Nhà Xuất Bản Lao Động', page_count: 280, publish_year: 2015 },
  { title: '1984', price: 110000, description: 'Tiểu thuyết phản địa đàng kinh điển về xã hội giám sát toàn diện.', isbn: '9786041012574', category: 'van-hoc', author: 'George Orwell', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 328, publish_year: 1949 },
  { title: 'Bắt Đầu Với Câu Hỏi Tại Sao', price: 140000, description: 'Khám phá sức mạnh của mục đích trong lãnh đạo và kinh doanh.', isbn: '9786041012581', category: 'kinh-te-kinh-doanh', author: 'Simon Sinek', publisher: 'Nhà Xuất Bản Lao Động', page_count: 256, publish_year: 2009 },
  { title: 'The Great Gatsby', price: 135000, compare_price: 160000, description: 'Kiệt tác văn học Mỹ về giấc mơ và sự đánh mất.', isbn: '9786041012598', category: 'fiction', author: 'F. Scott Fitzgerald', publisher: 'Nhà Xuất Bản Thế Giới', page_count: 208, publish_year: 1925 },
  { title: 'Start With Why', price: 165000, description: 'Cách các nhà lãnh đạo truyền cảm hứng hành động.', isbn: '9786041012604', category: 'self-help', author: 'Simon Sinek', publisher: 'Nhà Xuất Bản Lao Động', page_count: 256, publish_year: 2009 },
];

async function main() {
  console.log('[seed-sample] Seeding categories, authors, publishers, books...');

  // Categories — pass 1: cha (level 1)
  const parentIdBySlug = new Map<string, string>();
  for (const c of categories.filter((x) => !x.parent_slug)) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, level: c.level },
      create: { name: c.name, slug: c.slug, level: c.level, sort_order: 0 },
    });
    parentIdBySlug.set(c.slug, cat.category_id);
  }

  // Categories — pass 2: thể loại (level 2)
  for (const c of categories.filter((x) => x.parent_slug)) {
    const parentId = c.parent_slug ? parentIdBySlug.get(c.parent_slug) : undefined;
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, level: c.level, parent_id: parentId ?? null },
      create: {
        name: c.name,
        slug: c.slug,
        level: c.level,
        sort_order: 0,
        parent_id: parentId ?? null,
      },
    });
  }
  console.log(`  • ${categories.length} categories (${parentIdBySlug.size} cha)`);

  // Authors
  const authorIdBySlug = new Map<string, string>();
  for (const name of authors) {
    const slug = slugify(name);
    const a = await prisma.author.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    authorIdBySlug.set(slug, a.author_id);
  }
  console.log(`  • ${authors.length} authors`);

  // Publishers
  const publisherIdBySlug = new Map<string, string>();
  for (const name of publishers) {
    const slug = slugify(name);
    const p = await prisma.publisher.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    publisherIdBySlug.set(slug, p.publisher_id);
  }
  console.log(`  • ${publishers.length} publishers`);

  // Books
  let created = 0;
  for (const b of books) {
    const slug = slugify(b.title);
    const category = await prisma.category.findUnique({ where: { slug: b.category } });
    const authorId = authorIdBySlug.get(slugify(b.author));
    const publisherId = publisherIdBySlug.get(slugify(b.publisher));

    const book = await prisma.book.upsert({
      where: { slug },
      update: {
        title: b.title,
        price: b.price,
        compare_price: b.compare_price ?? null,
        description: b.description,
        stock_qty: 50,
        page_count: b.page_count ?? null,
        publish_year: b.publish_year ?? null,
        language: 'vi',
        is_active: true,
        publisher_id: publisherId ?? null,
      },
      create: {
        isbn: b.isbn,
        title: b.title,
        slug,
        price: b.price,
        compare_price: b.compare_price ?? null,
        description: b.description,
        stock_qty: 50,
        sold_count: Math.floor(Math.random() * 500),
        page_count: b.page_count ?? null,
        publish_year: b.publish_year ?? null,
        language: 'vi',
        publisher_id: publisherId ?? null,
        is_active: true,
      },
    });

    if (category) {
      await prisma.bookCategory.upsert({
        where: { book_id_category_id: { book_id: book.book_id, category_id: category.category_id } },
        update: { is_primary: true },
        create: { book_id: book.book_id, category_id: category.category_id, is_primary: true },
      });
    }

    if (authorId) {
      await prisma.bookAuthor.upsert({
        where: { book_id_author_id: { book_id: book.book_id, author_id: authorId } },
        update: { role: 'author' },
        create: { book_id: book.book_id, author_id: authorId, role: 'author' },
      });
    }

    created++;
  }

  console.log(`  • ${created} books`);

  const final = {
    books: await prisma.book.count(),
    categories: await prisma.category.count(),
    authors: await prisma.author.count(),
    publishers: await prisma.publisher.count(),
  };
  console.log('✅ SEED SAMPLE COMPLETE');
  console.log(`   Books: ${final.books} | Categories: ${final.categories} | Authors: ${final.authors} | Publishers: ${final.publishers}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed sample failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
