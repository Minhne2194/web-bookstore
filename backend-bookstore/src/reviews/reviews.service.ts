import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    data: {
      book_id: string;
      order_id?: string;
      rating: number;
      title?: string;
      body?: string;
    },
  ) {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Điểm đánh giá phải từ 1 đến 5!');
    }

    // Kiểm tra user đã mua cuốn sách này chưa (order phải ở trạng thái delivered)
    const purchasedOrder = await this.prisma.order.findFirst({
      where: {
        user_id: userId,
        status: 'delivered',
        items: {
          some: { book_id: data.book_id },
        },
      },
      select: { order_id: true },
    });

    if (!purchasedOrder) {
      throw new ForbiddenException(
        'Bạn cần mua và nhận sách này trước khi đánh giá!',
      );
    }

    // Gắn order_id từ đơn hàng đã mua nếu client không truyền
    const orderId = data.order_id || purchasedOrder.order_id;

    // Kiểm tra đã đánh giá cuốn sách này trong đơn hàng này chưa
    const existing = await this.prisma.review.findFirst({
      where: { user_id: userId, book_id: data.book_id, order_id: orderId },
    });
    if (existing)
      throw new BadRequestException('Bạn đã đánh giá cuốn sách này rồi!');

    const review = await this.prisma.review.create({
      data: {
        book_id: data.book_id,
        user_id: userId,
        order_id: orderId,
        rating: data.rating,
        title: data.title,
        body: data.body,
        status: 'pending',
      },
    });

    return review;
  }

  async findByBook(bookId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { book_id: bookId, status: 'approved' },
        include: { user: { select: { full_name: true, email: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: { book_id: bookId, status: 'approved' },
      }),
    ]);
    return {
      data: reviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByUser(userId: string) {
    return this.prisma.review.findMany({
      where: { user_id: userId },
      include: {
        book: { select: { title: true, cover_url: true, slug: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findPending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { status: 'pending' },
        include: {
          user: { select: { full_name: true, email: true } },
          book: { select: { title: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { status: 'pending' } }),
    ]);
    return {
      data: reviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(reviewId: string, status: 'approved' | 'rejected') {
    const review = await this.prisma.review.findUnique({
      where: { review_id: reviewId },
    });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá!');

    const updated = await this.prisma.review.update({
      where: { review_id: reviewId },
      data: { status },
    });

    // Nếu duyệt/từ chối thì tính lại rating sách
    await this.recalculateBookRating(review.book_id);

    return updated;
  }

  async voteHelpful(reviewId: string, userId: string) {
    // Kiểm tra review tồn tại
    const review = await this.prisma.review.findUnique({
      where: { review_id: reviewId },
    });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá!');

    // Không cho tự vote review của chính mình
    if (review.user_id === userId) {
      throw new BadRequestException(
        'Bạn không thể vote hữu ích cho đánh giá của chính mình!',
      );
    }

    // Kiểm tra đã vote chưa (unique constraint sẽ bắt, nhưng check trước cho message rõ ràng)
    const existingVote = await this.prisma.reviewVote.findUnique({
      where: { user_id_review_id: { user_id: userId, review_id: reviewId } },
    });
    if (existingVote) {
      throw new BadRequestException(
        'Bạn đã vote hữu ích cho đánh giá này rồi!',
      );
    }

    // Tạo vote + tăng helpful_count trong transaction
    const [, updatedReview] = await this.prisma.$transaction([
      this.prisma.reviewVote.create({
        data: { review_id: reviewId, user_id: userId },
      }),
      this.prisma.review.update({
        where: { review_id: reviewId },
        data: { helpful_count: { increment: 1 } },
      }),
    ]);

    return updatedReview;
  }

  private async recalculateBookRating(bookId: string) {
    const stats = await this.prisma.review.aggregate({
      where: { book_id: bookId, status: 'approved' },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await this.prisma.book.update({
      where: { book_id: bookId },
      data: {
        avg_rating: stats._avg.rating ?? 0,
        rating_count: stats._count.rating,
      },
    });
  }
}
