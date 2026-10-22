import { Controller, Get, Post, Query, UseGuards, Headers, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggest')
  suggest(@Query('q') q: string) {
    return this.searchService.suggest(q);
  }

  @Get('full')
  fullSearch(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('reindex')
  reindex() {
    return this.searchService.bulkIndex();
  }

  /** Dev-only: trigger reindex without JWT — protected by DEV_SECRET env var */
  @Post('reindex-dev')
  reindexDev(@Headers('x-dev-secret') secret: string) {
    const devSecret = process.env.DEV_SECRET || 'dev-reindex-2026';
    if (secret !== devSecret) throw new ForbiddenException('Invalid dev secret');
    return this.searchService.bulkIndex();
  }
}
