import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const mockPrismaService = {
    order: {
      findFirst: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    reviewVote: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    book: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────
  describe('create', () => {
    it('should throw BadRequestException if rating < 1', async () => {
      await expect(
        service.create('user1', { book_id: 'book1', rating: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if rating > 5', async () => {
      await expect(
        service.create('user1', { book_id: 'book1', rating: 6 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user has not purchased the book', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user1', { book_id: 'book1', rating: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if user already reviewed this book', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        order_id: 'ord1',
      });
      mockPrismaService.review.findFirst.mockResolvedValue({
        review_id: 'rev1',
      });

      await expect(
        service.create('user1', { book_id: 'book1', rating: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a review successfully', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        order_id: 'ord1',
      });
      mockPrismaService.review.findFirst.mockResolvedValue(null);
      const createdReview = {
        review_id: 'rev1',
        book_id: 'book1',
        user_id: 'user1',
        order_id: 'ord1',
        rating: 5,
        title: 'Sách hay!',
        body: 'Rất thú vị',
        status: 'pending',
      };
      mockPrismaService.review.create.mockResolvedValue(createdReview);

      const result = await service.create('user1', {
        book_id: 'book1',
        rating: 5,
        title: 'Sách hay!',
        body: 'Rất thú vị',
      });

      expect(result).toEqual(createdReview);
      expect(mockPrismaService.review.create).toHaveBeenCalledWith({
        data: {
          book_id: 'book1',
          user_id: 'user1',
          order_id: 'ord1',
          rating: 5,
          title: 'Sách hay!',
          body: 'Rất thú vị',
          status: 'pending',
        },
      });
    });

    it('should use client-provided order_id if present', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        order_id: 'ord1',
      });
      mockPrismaService.review.findFirst.mockResolvedValue(null);
      mockPrismaService.review.create.mockResolvedValue({
        review_id: 'rev1',
        order_id: 'client-ord',
      });

      await service.create('user1', {
        book_id: 'book1',
        order_id: 'client-ord',
        rating: 4,
      });

      expect(mockPrismaService.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order_id: 'client-ord' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // findByBook
  // ─────────────────────────────────────────────────────────
  describe('findByBook', () => {
    it('should return paginated reviews for a book', async () => {
      const reviews = [
        { review_id: 'rev1', rating: 5, user: { full_name: 'User 1' } },
      ];
      mockPrismaService.review.findMany.mockResolvedValue(reviews);
      mockPrismaService.review.count.mockResolvedValue(1);

      const result = await service.findByBook('book1', 1, 10);

      expect(result.data).toEqual(reviews);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { book_id: 'book1', status: 'approved' },
        }),
      );
    });

    it('should return correct pagination meta for multiple pages', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.review.count.mockResolvedValue(25);

      const result = await service.findByBook('book1', 2, 10);

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.page).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────
  // findByUser
  // ─────────────────────────────────────────────────────────
  describe('findByUser', () => {
    it('should return all reviews by a user', async () => {
      const reviews = [
        {
          review_id: 'rev1',
          book: { title: 'Book 1', cover_url: 'img.jpg', slug: 'book-1' },
        },
      ];
      mockPrismaService.review.findMany.mockResolvedValue(reviews);

      const result = await service.findByUser('user1');

      expect(result).toEqual(reviews);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user1' },
        include: {
          book: { select: { title: true, cover_url: true, slug: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // findPending
  // ─────────────────────────────────────────────────────────
  describe('findPending', () => {
    it('should return pending reviews with pagination', async () => {
      mockPrismaService.review.findMany.mockResolvedValue([]);
      mockPrismaService.review.count.mockResolvedValue(0);

      const result = await service.findPending(1, 20);

      expect(result.meta.total).toBe(0);
      expect(mockPrismaService.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // updateStatus
  // ─────────────────────────────────────────────────────────
  describe('updateStatus', () => {
    it('should throw NotFoundException if review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'approved'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should approve a review and recalculate book rating', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue({
        review_id: 'rev1',
        book_id: 'book1',
      });
      mockPrismaService.review.update.mockResolvedValue({
        review_id: 'rev1',
        status: 'approved',
      });
      mockPrismaService.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 10 },
      });
      mockPrismaService.book.update.mockResolvedValue({});

      const result = await service.updateStatus('rev1', 'approved');

      expect(result.status).toBe('approved');
      expect(mockPrismaService.review.aggregate).toHaveBeenCalledWith({
        where: { book_id: 'book1', status: 'approved' },
        _avg: { rating: true },
        _count: { rating: true },
      });
      expect(mockPrismaService.book.update).toHaveBeenCalledWith({
        where: { book_id: 'book1' },
        data: { avg_rating: 4.5, rating_count: 10 },
      });
    });

    it('should reject a review and recalculate book rating', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue({
        review_id: 'rev1',
        book_id: 'book1',
      });
      mockPrismaService.review.update.mockResolvedValue({
        review_id: 'rev1',
        status: 'rejected',
      });
      mockPrismaService.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });
      mockPrismaService.book.update.mockResolvedValue({});

      const result = await service.updateStatus('rev1', 'rejected');

      expect(result.status).toBe('rejected');
      expect(mockPrismaService.book.update).toHaveBeenCalledWith({
        where: { book_id: 'book1' },
        data: { avg_rating: 0, rating_count: 0 },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // voteHelpful
  // ─────────────────────────────────────────────────────────
  describe('voteHelpful', () => {
    it('should throw NotFoundException if review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(
        service.voteHelpful('nonexistent', 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user votes own review', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue({
        review_id: 'rev1',
        user_id: 'user1',
      });

      await expect(service.voteHelpful('rev1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user already voted', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue({
        review_id: 'rev1',
        user_id: 'user2',
      });
      mockPrismaService.reviewVote.findUnique.mockResolvedValue({
        user_id: 'user1',
        review_id: 'rev1',
      });

      await expect(service.voteHelpful('rev1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should vote helpful successfully', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue({
        review_id: 'rev1',
        user_id: 'user2',
      });
      mockPrismaService.reviewVote.findUnique.mockResolvedValue(null);

      const updatedReview = {
        review_id: 'rev1',
        helpful_count: 1,
      };
      mockPrismaService.$transaction.mockResolvedValue([
        { user_id: 'user1', review_id: 'rev1' },
        updatedReview,
      ]);

      const result = await service.voteHelpful('rev1', 'user1');

      expect(result.helpful_count).toBe(1);
    });
  });
});
