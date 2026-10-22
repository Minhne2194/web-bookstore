import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

interface TrackEventDto {
  event_type: string;
  book_id?: string;
  search_query?: string;
  duration_sec?: number;
  metadata?: Record<string, any>;
}

// Map frontend event_type to Prisma EventType enum
const EVENT_TYPE_MAP: Record<string, string> = {
  view: 'view',
  add_to_cart: 'add_to_cart',
  wishlist: 'wishlist',
  purchase: 'purchase',
  search: 'search',
  click: 'view', // map click → view as fallback
};

@Controller('behavior')
export class BehaviorController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /behavior/track
   * Ghi nhận sự kiện hành vi của user
   */
  @UseGuards(OptionalAuthGuard)
  @Post('track')
  @HttpCode(HttpStatus.OK)
  async track(@Req() req: any, @Body() body: TrackEventDto) {
    const userId: string | undefined = req.user?.userId || req.user?.sub;
    const rawSessionId: string | undefined = req.headers['x-session-id'] || req.headers['x-guest-id'];
    // session_id in DB is @db.Uuid — only store if it looks like a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const sessionId: string | null = (rawSessionId && uuidRegex.test(rawSessionId)) ? rawSessionId : null;

    const mappedType = EVENT_TYPE_MAP[body.event_type];
    if (!mappedType) {
      return { success: false, message: 'Unknown event type' };
    }

    // Only track view events with enough dwell time
    if (mappedType === 'view' && (body.duration_sec || 0) < 2) {
      return { success: false, message: 'View too short' };
    }

    try {
      await this.prisma.userBehaviorEvent.create({
        data: {
          event_type: mappedType as any,
          book_id: body.book_id || null,
          search_query: body.search_query || null,
          user_id: userId || null,
          session_id: rawSessionId,
          duration_sec: body.duration_sec || null,
          metadata: body.metadata ? body.metadata : {},
        },
      });
      return { success: true };
    } catch (error) {
      console.error('[BehaviorTracker] Failed to track event:', error);
      return { success: false };
    }
  }
}
