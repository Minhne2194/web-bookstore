import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    slug: string;
    level: number;
    parent_id?: string;
    sort_order?: number;
  }) {
    return this.prisma.category.create({
      data: data,
      include: { children: true },
    });
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        children: true,
        _count: { select: { book_categories: true } },
      },
      orderBy: [{ level: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(categoryId: string) {
    return this.prisma.category.findUnique({
      where: { category_id: categoryId },
      include: { children: true, parent: true },
    });
  }

  async update(
    categoryId: string,
    data: {
      name?: string;
      slug?: string;
      level?: number;
      parent_id?: string;
      sort_order?: number;
    },
  ) {
    const existing = await this.prisma.category.findUnique({
      where: { category_id: categoryId },
    });
    if (!existing) {
      throw new NotFoundException(`Category ${categoryId} không tồn tại`);
    }
    return this.prisma.category.update({
      where: { category_id: categoryId },
      data,
      include: { children: true },
    });
  }

  async remove(categoryId: string) {
    const existing = await this.prisma.category.findUnique({
      where: { category_id: categoryId },
    });
    if (!existing) {
      throw new NotFoundException(`Category ${categoryId} không tồn tại`);
    }
    return this.prisma.category.delete({
      where: { category_id: categoryId },
    });
  }
}
