import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  const mockCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      mockCategoriesService.findAll.mockResolvedValue([
        { category_id: 'cat1', name: 'Văn học' },
        { category_id: 'cat2', name: 'Khoa học' },
      ]);

      const result = await controller.findAll();

      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a single category', async () => {
      mockCategoriesService.findOne.mockResolvedValue({
        category_id: 'cat1',
        name: 'Văn học',
      });

      const result = await controller.findOne('cat1');

      expect(result.name).toBe('Văn học');
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      const createDto = { name: 'Mới', slug: 'moi', level: 0 };
      mockCategoriesService.create.mockResolvedValue({
        category_id: 'new1',
        ...createDto,
      });

      const result = await controller.create(createDto);

      expect(result.category_id).toBe('new1');
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      mockCategoriesService.remove.mockResolvedValue({
        category_id: 'cat1',
      });

      const result = await controller.remove('cat1');

      expect(result.category_id).toBe('cat1');
    });
  });
});
