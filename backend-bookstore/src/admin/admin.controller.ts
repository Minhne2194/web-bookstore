import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ——— THỐNG KÊ ———
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('stats/revenue')
  getRevenue() {
    return this.adminService.getRevenueByMonth();
  }

  @Get('stats/top-books')
  getTopBooks(@Query('limit') limit?: string) {
    return this.adminService.getTopBooks(limit ? parseInt(limit) : 10);
  }

  // ——— QUẢN LÝ USER ———
  @Get('users')
  getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      { search, status, role },
    );
  }

  @Get('users/:id/orders')
  getUserOrders(@Param('id') id: string) {
    return this.adminService.getUserOrders(id);
  }

  @Put('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'banned' | 'unverified' },
  ) {
    return this.adminService.updateUserStatus(id, body.status);
  }

  // ——— QUẢN LÝ TÁC GIẢ ———
  @Get('authors')
  getAllAuthors(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAllAuthors(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post('authors')
  createAuthor(
    @Body()
    body: {
      name: string;
      slug: string;
      bio?: string;
      avatar_url?: string;
    },
  ) {
    return this.adminService.createAuthor(body);
  }

  @Put('authors/:id')
  updateAuthor(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateAuthor(id, body);
  }

  // ——— QUẢN LÝ NHÀ XUẤT BẢN ———
  @Get('publishers')
  getAllPublishers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllPublishers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post('publishers')
  createPublisher(
    @Body() body: { name: string; slug: string; website?: string },
  ) {
    return this.adminService.createPublisher(body);
  }

  @Put('publishers/:id')
  updatePublisher(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePublisher(id, body);
  }

  // ——— QUẢN LÝ THỂ LOẠI ———
  @Get('categories')
  getAllCategories() {
    return this.adminService.getAllCategories();
  }

  @Post('categories')
  createCategory(
    @Body()
    body: {
      name: string;
      slug: string;
      level: number;
      parent_id?: string;
      sort_order?: number;
    },
  ) {
    return this.adminService.createCategory(body);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }
}
