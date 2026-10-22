import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';

describe('BooksService', () => {
  let service: BooksService;

  const mockPrismaService = {
    book: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bookAuthor: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    bookCategory: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockSearchService = {
    indexBook: jest.fn(),
    search: jest.fn(),
    suggest: jest.fn(),
    removeBook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return books without q', async () => {
      mockPrismaService.book.count.mockResolvedValue(1);
      mockPrismaService.book.findMany.mockResolvedValue([
        { book_id: '1', title: 'Book 1' }
      ]);

      const result = await service.findAll(1, 10, { minPrice: 100 });
      expect(mockPrismaService.book.count).toHaveBeenCalled();
      expect(mockPrismaService.book.findMany).toHaveBeenCalled();
      expect(result.meta.total).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Book 1');
    });

    it('should call searchService if q is provided', async () => {
      mockSearchService.search.mockResolvedValue({
        data: [{ book_id: '2', title: 'Book 2' }],
        meta: { total: 1 }
      });
      const result = await service.findAll(1, 10, { q: 'test' });
      expect(mockSearchService.search).toHaveBeenCalledWith({ q: 'test', page: 1, limit: 10 });
      expect(result.data[0].title).toBe('Book 2');
    });
  });

  describe('findOne', () => {
    it('should return book if found', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue({
        book_id: '1',
        title: 'Book 1',
        book_categories: [{ category: { name: 'Cat 1' } }],
        book_authors: [{ author: { name: 'Author 1' } }],
        publisher: { name: 'Pub 1' }
      });

      const result = await service.findOne('1');
      expect(result).toBeDefined();
      expect(result?.title).toBe('Book 1');
      expect(result?.category).toBe('Cat 1');
      expect(result?.author).toBe('Author 1');
    });

    it('should return null if not found', async () => {
      mockPrismaService.book.findUnique.mockResolvedValue(null);
      const result = await service.findOne('99');
      expect(result).toBeNull();
    });
  });
});
