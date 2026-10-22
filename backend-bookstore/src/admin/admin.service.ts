import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ——— THỐNG KÊ TỔNG QUAN ———

  async getStats() {
    const [
      totalUsers,
      totalBooks,
      totalOrders,
      revenueAgg,
      pendingOrders,
      pendingReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.book.count({ where: { is_active: true } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: { total_amount: true },
        where: { payment_status: 'paid' },
      }),
      this.prisma.order.count({ where: { status: 'pending' } }),
      this.prisma.review.count({ where: { status: 'pending' } }),
    ]);

    return {
      totalUsers,
      totalBooks,
      totalOrders,
      totalRevenue: Number(revenueAgg._sum.total_amount ?? 0),
      pendingOrders,
      pendingReviews,
    };
  }

  // Doanh thu theo tháng (12 tháng gần nhất)
  async getRevenueByMonth() {
    const rows = await this.prisma.$queryRaw<
      { month: string; revenue: number; orders: number }[]
    >`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        SUM(total_amount)::float        AS revenue,
        COUNT(*)::int                   AS orders
      FROM orders
      WHERE payment_status = 'paid'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `;
    return rows;
  }

  // Top 10 sách bán chạy
  async getTopBooks(limit = 10) {
    return this.prisma.book.findMany({
      where: { is_active: true },
      orderBy: { sold_count: 'desc' },
      take: limit,
      select: {
        book_id: true,
        title: true,
        cover_url: true,
        sold_count: true,
        avg_rating: true,
        price: true,
      },
    });
  }

  // ——— QUẢN LÝ USER ———

  async getAllUsers(
    page = 1,
    limit = 20,
    filters: { search?: string; status?: string; role?: string } = {},
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { full_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.role) {
      where.role = filters.role;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        select: {
          user_id: true,
          email: true,
          full_name: true,
          role: true,
          status: true,
          created_at: true,
          _count: { select: { orders: true, reviews: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateUserStatus(
    userId: string,
    status: 'active' | 'banned' | 'unverified',
  ) {
    return this.prisma.user.update({
      where: { user_id: userId },
      data: { status },
      select: { user_id: true, email: true, full_name: true, status: true },
    });
  }

  async getUserOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        items: {
          include: { book: { select: { title: true, cover_url: true } } },
        },
      },
    });
    return { data: orders };
  }

  // ——— QUẢN LÝ TÁC GIẢ ———

  async getAllAuthors(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [authors, total] = await Promise.all([
      this.prisma.author.findMany({
        skip,
        take: limit,
        include: { _count: { select: { book_authors: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.author.count(),
    ]);
    return {
      data: authors,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createAuthor(data: {
    name: string;
    slug: string;
    bio?: string;
    avatar_url?: string;
  }) {
    return this.prisma.author.create({ data });
  }

  async updateAuthor(
    authorId: string,
    data: { name?: string; slug?: string; bio?: string; avatar_url?: string },
  ) {
    return this.prisma.author.update({ where: { author_id: authorId }, data });
  }

  // ——— QUẢN LÝ NHÀ XUẤT BẢN ———

  async getAllPublishers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [publishers, total] = await Promise.all([
      this.prisma.publisher.findMany({
        skip,
        take: limit,
        include: { _count: { select: { books: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.publisher.count(),
    ]);
    return {
      data: publishers,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async createPublisher(data: {
    name: string;
    slug: string;
    website?: string;
  }) {
    return this.prisma.publisher.create({ data });
  }

  async updatePublisher(
    publisherId: string,
    data: { name?: string; slug?: string; website?: string },
  ) {
    return this.prisma.publisher.update({
      where: { publisher_id: publisherId },
      data,
    });
  }

  // ——— QUẢN LÝ THỂ LOẠI ———

  async getAllCategories() {
    return this.prisma.category.findMany({
      include: {
        children: true,
        _count: { select: { book_categories: true } },
      },
      where: { parent_id: null },
      orderBy: { sort_order: 'asc' },
    });
  }

  async createCategory(data: {
    name: string;
    slug: string;
    level: number;
    parent_id?: string;
    sort_order?: number;
  }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(
    categoryId: string,
    data: { name?: string; slug?: string; sort_order?: number; parent_id?: string; level?: number },
  ) {
    return this.prisma.category.update({
      where: { category_id: categoryId },
      data,
    });
  }

  async deleteCategory(categoryId: string) {
    return this.prisma.category.delete({
      where: { category_id: categoryId },
    });
  }
}
