import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async create(data: any) {
    const { author_ids, category_ids, is_primary_category, ...bookData } = data;

    const book = await this.prisma.book.create({
      data: {
        title: bookData.title,
        slug: bookData.slug,
        price: bookData.price,
        compare_price: bookData.compare_price,
        stock_qty: bookData.stock_qty ?? 0,
        description: bookData.description,
        cover_url: bookData.cover_url,
        language: bookData.language ?? 'vi',
        publish_year: bookData.publish_year,
        page_count: bookData.page_count,
        publisher_id: bookData.publisher_id ?? null,
        isbn: bookData.isbn ?? null,
        is_active: bookData.is_active ?? true,
        metadata: bookData.metadata ?? {},
      },
    });

    if (author_ids?.length) {
      await this.prisma.bookAuthor.createMany({
        data: author_ids.map((id: string) => ({
          book_id: book.book_id,
          author_id: id,
          role: 'author',
        })),
        skipDuplicates: true,
      });
    }

    if (category_ids?.length) {
      await this.prisma.bookCategory.createMany({
        data: category_ids.map((id: string, idx: number) => ({
          book_id: book.book_id,
          category_id: id,
          is_primary: idx === 0,
        })),
        skipDuplicates: true,
      });
    }

    await this.searchService.indexBook(book.book_id);

    return this.findOne(book.book_id);
  }

  async findAll(
    page: number = 1,
    limit: number = 100,
    filters: {
      ids?: string;
      sort?: string;
      category?: string;
      author?: string;
      minPrice?: number;
      maxPrice?: number;
      lang?: string;
      q?: string;
      rating?: number;
    } = {},
  ) {
    if (filters.q?.trim()) {
      return this.searchService.search({ ...filters, page, limit });
    }

    const skip = (page - 1) * limit;
    const where: any = { is_active: true };

    if (filters.ids) {
      where.book_id = { in: filters.ids.split(',') };
    }
    if (filters.lang) {
      where.language = filters.lang;
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
    }
    if (filters.category) {
      where.book_categories = {
        some: {
          category: {
            OR: [
              { category_id: filters.category },
              { slug: filters.category },
              { name: { equals: filters.category, mode: 'insensitive' } },
            ],
          },
        },
      };
    }
    if (filters.author) {
      where.book_authors = { some: { author_id: filters.author } };
    }
    if (filters.q?.trim()) {
      const normalizedQuery = filters.q.trim().replace(/\s+/g, ' ');
      const terms = normalizedQuery
        .split(' ')
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 8);
      where.AND = [
        ...(where.AND || []),
        ...terms.map((term) => ({
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            {
              book_authors: {
                some: {
                  author: { name: { contains: term, mode: 'insensitive' } },
                },
              },
            },
          ],
        })),
      ];
    }
    if (filters.rating !== undefined) {
      where.avg_rating = { gte: filters.rating };
    }

    let orderByClause: any = { created_at: 'desc' };
    if (filters.sort === 'bestseller') orderByClause = { sold_count: 'desc' };
    else if (filters.sort === 'newest') orderByClause = { created_at: 'desc' };
    else if (filters.sort === 'price_asc') orderByClause = { price: 'asc' };
    else if (filters.sort === 'price_desc') orderByClause = { price: 'desc' };
    else if (filters.sort === 'rating') orderByClause = { avg_rating: 'desc' };

    const [total, books] = await Promise.all([
      this.prisma.book.count({ where }),
      this.prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByClause,
        include: {
          book_categories: {
            include: { category: { include: { parent: true } } },
          },
          book_authors: { include: { author: true } },
          publisher: true,
        },
      }),
    ]);

    const data = books.map((book) => this.formatBook(book));
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async search(q: string) {
    return this.searchService.suggest(q);
  }

  async findBySlug(slug: string) {
    const book = await this.prisma.book.findUnique({
      where: { slug },
      include: {
        book_categories: {
          include: { category: { include: { parent: true } } },
        },
        book_authors: { include: { author: true } },
        publisher: true,
      },
    });
    if (!book) return null;
    return this.formatBook(book);
  }

  async findOne(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { book_id: id },
      include: {
        book_categories: {
          include: { category: { include: { parent: true } } },
        },
        book_authors: { include: { author: true } },
        publisher: true,
      },
    });
    if (!book) return null;
    return this.formatBook(book);
  }

  async update(id: string, data: any) {
    const { author_ids, category_ids, ...bookData } = data;

    await this.prisma.book.update({
      where: { book_id: id },
      data: {
        title: bookData.title,
        slug: bookData.slug,
        price: bookData.price,
        compare_price: bookData.compare_price,
        stock_qty: bookData.stock_qty,
        description: bookData.description,
        cover_url: bookData.cover_url,
        extra_images: bookData.extra_images !== undefined ? bookData.extra_images : undefined,
        language: bookData.language,
        publish_year: bookData.publish_year,
        page_count: bookData.page_count,
        publisher_id: bookData.publisher_id,
        is_active: bookData.is_active,
      },
    });

    if (author_ids !== undefined) {
      await this.prisma.bookAuthor.deleteMany({ where: { book_id: id } });
      if (author_ids.length) {
        await this.prisma.bookAuthor.createMany({
          data: author_ids.map((aid: string) => ({
            book_id: id,
            author_id: aid,
            role: 'author',
          })),
        });
      }
    }
    if (category_ids !== undefined) {
      await this.prisma.bookCategory.deleteMany({ where: { book_id: id } });
      if (category_ids.length) {
        await this.prisma.bookCategory.createMany({
          data: category_ids.map((cid: string, idx: number) => ({
            book_id: id,
            category_id: cid,
            is_primary: idx === 0,
          })),
        });
      }
    }

    await this.searchService.indexBook(id);

    return this.findOne(id);
  }

  async remove(id: string) {
    try {
      await this.prisma.book.delete({ where: { book_id: id } });
      await this.searchService.removeBook(id);
      return { message: 'Xóa sách thành công!' };
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Không thể xóa! Cuốn sách này đã nằm trong hóa đơn của khách hàng.',
        );
      }
      throw new BadRequestException('Có lỗi xảy ra khi xóa sách.');
    }
  }

  private formatBook(book: any) {
    const { book_categories, book_authors, publisher, ...rest } = book;
    const primaryCat = book_categories?.[0]?.category;
    const rootCategory =
      primaryCat?.parent?.name || primaryCat?.name || 'Tất cả';
    return {
      ...rest,
      category: rootCategory,
      categories: book_categories?.map((bc: any) => bc.category) ?? [],
      author:
        book_authors?.map((ba: any) => ba.author.name).join(', ') ||
        'Khuyết danh',
      authors: book_authors?.map((ba: any) => ba.author) ?? [],
      publisher: publisher?.name || 'Đang cập nhật',
      publisher_id: publisher?.publisher_id,
    };
  }
}
