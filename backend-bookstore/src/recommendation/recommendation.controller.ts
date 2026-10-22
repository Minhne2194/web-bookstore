import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { AuthGuard } from '../auth/auth.guard';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  /**
   * GET /recommendations/for-you?limit=12
   * Personalized nếu đã login, trending nếu anonymous
   */
  @UseGuards(OptionalAuthGuard)
  @Get('for-you')
  async getForYou(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const n = Math.min(parseInt(limit || '12', 10) || 12, 50);
    const userId: string | undefined = req.user?.userId || req.user?.sub;

    if (userId) {
      const books = await this.recommendationService.getPersonalizedRecommendations(userId, n);
      return { type: 'personalized', data: books };
    } else {
      const books = await this.recommendationService.getTrendingBooks(n);
      return { type: 'trending', data: books };
    }
  }

  /**
   * GET /recommendations/similar/:bookId?limit=8
   * Public: sách tương tự cho trang BookDetail
   */
  @Get('similar/:bookId')
  async getSimilar(
    @Param('bookId') bookId: string,
    @Query('limit') limit?: string,
  ) {
    const n = Math.min(parseInt(limit || '8', 10) || 8, 20);
    const books = await this.recommendationService.getSimilarBooks(bookId, n);
    return { data: books };
  }

  /**
   * GET /recommendations/trending?limit=12
   * Public: trending cho mọi user
   */
  @Get('trending')
  async getTrending(@Query('limit') limit?: string) {
    const n = Math.min(parseInt(limit || '12', 10) || 12, 50);
    const books = await this.recommendationService.getTrendingBooks(n);
    return { data: books };
  }

  /**
   * GET /recommendations/because-you-bought?limit=8
   * Auth required: "Vì bạn đã mua sách X"
   */
  @UseGuards(AuthGuard)
  @Get('because-you-bought')
  async getBecauseYouBought(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const n = Math.min(parseInt(limit || '8', 10) || 8, 20);
    const userId: string = req.user?.userId || req.user?.sub;
    const books = await this.recommendationService.getBecauseYouBought(userId, n);
    return { data: books };
  }
}
