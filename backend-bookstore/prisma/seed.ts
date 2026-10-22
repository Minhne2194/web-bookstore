import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createPgPool } from '../src/prisma/create-pg-pool';

type SeedCategory = {
  name: string;
  slug: string;
  level: number;
  parent_slug?: string | null;
};

type SeedBook = {
  isbn: string;
  title: string;
  description?: string | null;
  price: number;
  compare_price?: number | null;
  stock_qty?: number | null;
  sold_count?: number | null;
  author?: string | null;
  authors?: string[];
  publisher?: string | null;
  categories: string[];
  cover_url?: string | null;
  page_count?: number | null;
  publish_year?: number | null;
  language?: string | null;
  metadata?: Record<string, unknown> | null;
};

const pool = createPgPool();
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BOOK_ISBN_MAX_LEN = 20;
const BOOK_TITLE_MAX_LEN = 500;
const BOOK_SLUG_MAX_LEN = 500;
const PUBLISHER_NAME_MAX_LEN = 300;
const PUBLISHER_SLUG_MAX_LEN = 300;
const AUTHOR_NAME_MAX_LEN = 300;
const AUTHOR_SLUG_MAX_LEN = 300;
const CATEGORY_NAME_MAX_LEN = 200;
const CATEGORY_SLUG_MAX_LEN = 200;
const LANGUAGE_MAX_LEN = 10;

function createSlug(text: string): string {
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

function limitText(value: string | null | undefined, maxLength: number, fallback = ''): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

function normalizeBookIsbn(item: SeedBook): string {
  const rawIsbn = String(item.isbn ?? '').trim();
  if (rawIsbn && rawIsbn.length <= BOOK_ISBN_MAX_LEN) {
    return rawIsbn;
  }

  const seed = `${rawIsbn}|${String(item.metadata?.source_url ?? '')}|${item.title}`;
  const digest = createHash('sha1').update(seed).digest('hex').slice(0, BOOK_ISBN_MAX_LEN - 4);
  return `FHS-${digest}`;
}

function buildBookSlug(title: string, isbn: string): string {
  const suffix = isbn.slice(-4) || 'book';
  const maxBaseLength = BOOK_SLUG_MAX_LEN - suffix.length - 1;
  const baseSlug = createSlug(title).slice(0, maxBaseLength).replace(/-+$/g, '');
  return `${baseSlug || 'book'}-${suffix}`;
}

function uniqueAuthors(item: SeedBook): string[] {
  const rawAuthors = Array.isArray(item.authors) && item.authors.length
    ? item.authors
    : item.author
      ? [item.author]
      : ['Khuyet danh'];

  return Array.from(
    new Set(
      rawAuthors
        .map((author) => author.trim())
        .filter(Boolean),
    ),
  );
}

async function main() {
  console.log('[seed] Loading catalog JSON...');

  const outputDir = path.join(__dirname, '../scripts/crawler/output');
  const booksFile = path.join(outputDir, 'books_seed.json');
  const catsFile = path.join(outputDir, 'categories_seed.json');

  if (!fs.existsSync(booksFile) || !fs.existsSync(catsFile)) {
    console.error('[seed] Missing JSON seed files.');
    console.error('[seed] Run `npm run catalog:fetch` first.');
    process.exit(1);
  }

  const categoriesData = JSON.parse(fs.readFileSync(catsFile, 'utf-8')) as SeedCategory[];
  const booksData = JSON.parse(fs.readFileSync(booksFile, 'utf-8')) as SeedBook[];

  console.log(`[seed] Upserting ${categoriesData.length} categories...`);
  for (const cat of categoriesData) {
    const categoryName = limitText(cat.name, CATEGORY_NAME_MAX_LEN);
    const categorySlug = limitText(cat.slug, CATEGORY_SLUG_MAX_LEN, createSlug(categoryName));

    await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {
        name: categoryName,
        level: cat.level,
      },
      create: {
        name: categoryName,
        slug: categorySlug,
        level: cat.level,
        sort_order: cat.level,
      },
    });
  }

  for (const cat of categoriesData) {
    if (!cat.parent_slug) continue;
    const parent = await prisma.category.findUnique({
      where: { slug: limitText(cat.parent_slug, CATEGORY_SLUG_MAX_LEN) },
    });
    if (!parent) continue;

    await prisma.category.update({
      where: { slug: limitText(cat.slug, CATEGORY_SLUG_MAX_LEN) },
      data: { parent_id: parent.category_id },
    });
  }

  console.log(`[seed] Upserting ${booksData.length} books...`);
  for (const item of booksData) {
    const safeIsbn = normalizeBookIsbn(item);
    const bookTitle = limitText(item.title, BOOK_TITLE_MAX_LEN, 'Untitled Book');
    const publisherName = limitText(
      item.publisher || (item.metadata?.supplier as string) || 'Dang cap nhat',
      PUBLISHER_NAME_MAX_LEN,
      'Dang cap nhat',
    );
    const publisherSlug = limitText(createSlug(publisherName), PUBLISHER_SLUG_MAX_LEN, 'dang-cap-nhat');
    const publisher = await prisma.publisher.upsert({
      where: { slug: publisherSlug },
      update: { name: publisherName },
      create: {
        name: publisherName,
        slug: publisherSlug,
      },
    });

    const authors: Array<{ author_id: string }> = [];
    for (const authorName of uniqueAuthors(item)) {
      const safeAuthorName = limitText(authorName, AUTHOR_NAME_MAX_LEN, 'Khuyet danh');
      const authorSlug = limitText(createSlug(safeAuthorName), AUTHOR_SLUG_MAX_LEN, 'khuyet-danh');
      const author = await prisma.author.upsert({
        where: { slug: authorSlug },
        update: { name: safeAuthorName },
        create: {
          name: safeAuthorName,
          slug: authorSlug,
        },
      });
      authors.push(author);
    }

    const bookCategories: { category_id: string; is_primary: boolean }[] = [];
    for (let index = 0; index < item.categories.length; index += 1) {
      const categoryName = item.categories[index];
      const categorySlug = limitText(createSlug(categoryName), CATEGORY_SLUG_MAX_LEN);
      const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (!category) continue;

      bookCategories.push({
        category_id: category.category_id,
        is_primary: index === 0,
      });
    }

    const bookSlug = buildBookSlug(bookTitle, safeIsbn);
    const metadata = (item.metadata ?? {}) as Prisma.InputJsonValue;
    const bookLanguage = limitText(item.language ?? 'vi', LANGUAGE_MAX_LEN, 'vi');
    const py = item.publish_year;
    const safePublishYear = py != null && Number.isFinite(py) && py > 0 && py <= 32767 ? py : null;

    await prisma.book.upsert({
      where: { isbn: safeIsbn },
      update: {
        title: bookTitle,
        description: item.description,
        price: item.price,
        compare_price: item.compare_price,
        stock_qty: item.stock_qty ?? 0,
        sold_count: item.sold_count ?? 0,
        page_count: item.page_count ?? null,
        language: bookLanguage,
        publish_year: safePublishYear,
        cover_url: item.cover_url ?? null,
        metadata,
        publisher_id: publisher.publisher_id,
        book_categories: { deleteMany: {} },
        book_authors: { deleteMany: {} },
      },
      create: {
        isbn: safeIsbn,
        title: bookTitle,
        slug: bookSlug,
        description: item.description,
        price: item.price,
        compare_price: item.compare_price,
        stock_qty: item.stock_qty ?? 0,
        sold_count: item.sold_count ?? 0,
        page_count: item.page_count ?? null,
        language: bookLanguage,
        publish_year: safePublishYear,
        cover_url: item.cover_url ?? null,
        metadata,
        publisher_id: publisher.publisher_id,
        is_active: true,
      },
    });

    await prisma.book.update({
      where: { isbn: safeIsbn },
      data: {
        book_authors: {
          create: authors.map((author) => ({
            author_id: author.author_id,
            role: 'author',
          })),
        },
        book_categories: {
          create: bookCategories,
        },
      },
    });

    console.log(`[seed] Imported ${bookTitle}`);
  }

  console.log('[seed] Catalog import complete.');
}

main()
  .catch((error) => {
    console.error('[seed] Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
