import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

// ─────────────────────────────────────────────────────────
// Integration Test — Books API
// Uses mock providers to avoid real DB/Redis/Elasticsearch
// ─────────────────────────────────────────────────────────

import { BooksController } from '../src/books/books.controller';
import { BooksService } from '../src/books/books.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('Books API (e2e)', () => {
  let app: INestApplication<App>;

  const mockBooksService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySlug: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [{ provide: BooksService, useValue: mockBooksService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          // Simulate auth: only if Authorization header present
          if (req.headers.authorization === 'Bearer admin-token') {
            req.user = { sub: 'admin1', email: 'admin@test.com', role: 'admin' };
            return true;
          }
          if (req.headers.authorization === 'Bearer user-token') {
            req.user = { sub: 'user1', email: 'user@test.com', role: 'user' };
            return true;
          }
          return false;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          return req.user?.role === 'admin';
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // GET /books — Public endpoint
  // ─────────────────────────────────────────────────────────
  describe('GET /books', () => {
    it('should return list of books (200)', async () => {
      mockBooksService.findAll.mockResolvedValue({
        data: [
          { book_id: '1', title: 'Book 1', price: 100000 },
          { book_id: '2', title: 'Book 2', price: 200000 },
        ],
        meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
      });

      const response = await request(app.getHttpServer())
        .get('/books')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
    });

    it('should pass query params to service', async () => {
      mockBooksService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await request(app.getHttpServer())
        .get('/books?page=2&limit=10&sort=newest&category=van-hoc')
        .expect(200);

      expect(mockBooksService.findAll).toHaveBeenCalledWith(2, 10, {
        ids: undefined,
        sort: 'newest',
        category: 'van-hoc',
        author: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        lang: undefined,
        q: undefined,
        rating: undefined,
      });
    });

    it('should pass price filters correctly', async () => {
      mockBooksService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
      });

      await request(app.getHttpServer())
        .get('/books?minPrice=50000&maxPrice=200000')
        .expect(200);

      expect(mockBooksService.findAll).toHaveBeenCalledWith(
        1,
        100,
        expect.objectContaining({
          minPrice: 50000,
          maxPrice: 200000,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /books/:id — Public endpoint
  // ─────────────────────────────────────────────────────────
  describe('GET /books/:id', () => {
    it('should return a single book (200)', async () => {
      mockBooksService.findOne.mockResolvedValue({
        book_id: '1',
        title: 'Book 1',
        price: 100000,
        category: 'Văn học',
        author: 'Author 1',
      });

      const response = await request(app.getHttpServer())
        .get('/books/1')
        .expect(200);

      expect(response.body.title).toBe('Book 1');
    });

    it('should return null if book not found', async () => {
      mockBooksService.findOne.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/books/nonexistent')
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /books/by-slug/:slug — Public endpoint
  // ─────────────────────────────────────────────────────────
  describe('GET /books/by-slug/:slug', () => {
    it('should return book by slug', async () => {
      mockBooksService.findBySlug.mockResolvedValue({
        book_id: '1',
        title: 'Dế Mèn Phiêu Lưu Ký',
        slug: 'de-men-phieu-luu-ky',
      });

      const response = await request(app.getHttpServer())
        .get('/books/by-slug/de-men-phieu-luu-ky')
        .expect(200);

      expect(response.body.slug).toBe('de-men-phieu-luu-ky');
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /books/search — Public endpoint
  // ─────────────────────────────────────────────────────────
  describe('GET /books/search', () => {
    it('should search books by query', async () => {
      mockBooksService.search.mockResolvedValue([
        { book_id: '1', title: 'Matching Book' },
      ]);

      const response = await request(app.getHttpServer())
        .get('/books/search?q=matching')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(mockBooksService.search).toHaveBeenCalledWith('matching');
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /books — Admin-only
  // ─────────────────────────────────────────────────────────
  describe('POST /books', () => {
    it('should reject if no auth token (403)', async () => {
      await request(app.getHttpServer())
        .post('/books')
        .send({ title: 'New Book', price: 100000 })
        .expect(403);
    });

    it('should reject if user is not admin (403)', async () => {
      await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', 'Bearer user-token')
        .send({ title: 'New Book', price: 100000 })
        .expect(403);
    });

    it('should create book if admin (201)', async () => {
      mockBooksService.create.mockResolvedValue({
        book_id: 'new1',
        title: 'New Book',
      });

      const response = await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', 'Bearer admin-token')
        .send({ title: 'New Book', price: 100000 })
        .expect(201);

      expect(response.body.book_id).toBe('new1');
    });
  });

  // ─────────────────────────────────────────────────────────
  // DELETE /books/:id — Admin-only
  // ─────────────────────────────────────────────────────────
  describe('DELETE /books/:id', () => {
    it('should reject if no auth token (403)', async () => {
      await request(app.getHttpServer()).delete('/books/1').expect(403);
    });

    it('should reject if user is not admin (403)', async () => {
      await request(app.getHttpServer())
        .delete('/books/1')
        .set('Authorization', 'Bearer user-token')
        .expect(403);
    });

    it('should delete book if admin (200)', async () => {
      mockBooksService.remove.mockResolvedValue({
        message: 'Xóa sách thành công!',
      });

      const response = await request(app.getHttpServer())
        .delete('/books/1')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.message).toContain('thành công');
    });
  });
});
