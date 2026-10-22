import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as express from 'express';
import { ChatService } from './chat.service';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

interface ChatMessageDto {
  message: string;
  history?: { role: string; content: string }[];
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /chat/message
   * SSE streaming response from DeepSeek
   */
  @UseGuards(OptionalAuthGuard)
  @Post('message')
  @HttpCode(HttpStatus.OK)
  async message(
    @Req() req: any,
    @Res() res: express.Response,
    @Body() body: ChatMessageDto,
  ) {
    const userId: string | undefined = req.user?.userId || req.user?.sub;
    const userMessage = (body.message || '').slice(0, 500).trim();

    if (!userMessage) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    try {
      const stream = this.chatService.chat(
        userMessage,
        body.history || [],
        userId,
      );

      for await (const chunk of stream) {
        // SSE format: data: <json>\n\n
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
    } catch (err) {
      res.write(
        `data: ${JSON.stringify({ text: '❌ Đã xảy ra lỗi. Vui lòng thử lại.' })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  }

  /**
   * GET /chat/suggestions
   * Quick action suggestions shown in chat widget
   */
  @Get('suggestions')
  getSuggestions() {
    return [
      { text: 'Tìm sách hay dưới 100k', icon: '🔍' },
      { text: 'Đơn hàng của tôi đang ở đâu?', icon: '📦' },
      { text: 'Gợi ý sách cho cuối tuần', icon: '📚' },
      { text: 'Sách best-seller tháng này', icon: '🔥' },
    ];
  }
}
