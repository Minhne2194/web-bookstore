import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
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
    it('should create a new category', async () => {
      const categoryData = { name: 'Văn học', slug: 'van-hoc', level: 0 };
      const createdCategory = {
        category_id: 'cat1',
        ...categoryData,
        children: [],
      };
      mockPrismaService.category.create.mockResolvedValue(createdCategory);

      const result = await service.create(categoryData);

      expect(result).toEqual(createdCategory);
      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: categoryData,
        include: { children: true },
      });
    });

    it('should create a child category with parent_id', async () => {
      const categoryData = {
        name: 'Tiểu thuyết',
        slug: 'tieu-thuyet',
        level: 1,
        parent_id: 'cat1',
      };
      mockPrismaService.category.create.mockResolvedValue({
        category_id: 'cat2',
        ...categoryData,
        children: [],
      });

      const result = await service.create(categoryData);

      expect(result.parent_id).toBe('cat1');
    });
  });

  // ─────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all categories with children and book count', async () => {
      const categories = [
        {
          category_id: 'cat1',
          name: 'Văn học',
          children: [],
          _count: { book_categories: 5 },
        },
        {
          category_id: 'cat2',
          name: 'Khoa học',
          children: [],
          _count: { book_categories: 3 },
        },
      ];
      mockPrismaService.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toEqual(categories);
      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        include: {
          children: true,
          _count: { select: { book_categories: true } },
        },
        orderBy: [{ level: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return a category with children and parent', async () => {
      const category = {
        category_id: 'cat1',
        name: 'Văn học',
        children: [],
        parent: null,
      };
      mockPrismaService.category.findUnique.mockResolvedValue(category);

      const result = await service.findOne('cat1');

      expect(result).toEqual(category);
      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith({
        where: { category_id: 'cat1' },
        include: { children: true, parent: true },
      });
    });

    it('should return null if category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update an existing category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        category_id: 'cat1',
        name: 'Văn học',
      });
      const updatedCategory = {
        category_id: 'cat1',
        name: 'Văn học Việt Nam',
        children: [],
      };
      mockPrismaService.category.update.mockResolvedValue(updatedCategory);

      const result = await service.update('cat1', { name: 'Văn học Việt Nam' });

      expect(result).toEqual(updatedCategory);
      expect(mockPrismaService.category.update).toHaveBeenCalledWith({
        where: { category_id: 'cat1' },
        data: { name: 'Văn học Việt Nam' },
        include: { children: true },
      });
    });

    it('should throw NotFoundException if category does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should delete an existing category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        category_id: 'cat1',
      });
      mockPrismaService.category.delete.mockResolvedValue({
        category_id: 'cat1',
      });

      const result = await service.remove('cat1');

      expect(result.category_id).toBe('cat1');
      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { category_id: 'cat1' },
      });
    });

    it('should throw NotFoundException if category does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
