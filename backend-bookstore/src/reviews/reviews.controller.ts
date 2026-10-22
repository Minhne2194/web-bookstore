import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(AuthGuard)
  @Post()
  create(
    @Req() req: any,
    @Body()
    body: {
      book_id: string;
      order_id?: string;
      rating: number;
      title?: string;
      body?: string;
    },
  ) {
    return this.reviewsService.create(req.user.sub, body);
  }

  @Get('book/:bookId')
  findByBook(
    @Param('bookId') bookId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.findByBook(
      bookId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @UseGuards(AuthGuard)
  @Get('my')
  findMyReviews(@Req() req: any) {
    return this.reviewsService.findByUser(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('pending')
  findPending(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.reviewsService.findPending(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected' },
  ) {
    return this.reviewsService.updateStatus(id, body.status);
  }

  @UseGuards(AuthGuard)
  @Put(':id/helpful')
  voteHelpful(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.voteHelpful(id, req.user.sub);
  }
}
