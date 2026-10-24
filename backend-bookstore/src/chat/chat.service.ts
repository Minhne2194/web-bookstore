import { Injectable, Logger } from '@nestjs/common';
import { Coupon } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Từ dừng tiếng Việt dùng để lọc từ khóa tìm sách (kèm dạng không dấu)
const SEARCH_STOPWORDS = new Set([
  'tôi',
  'toi',
  'muốn',
  'muon',
  'cần',
  'can',
  'tìm',
  'tim',
  'kiếm',
  'kiem',
  'sách',
  'sach',
  'cuốn',
  'cuon',
  'quyển',
  'quyen',
  'cho',
  'về',
  've',
  'hay',
  'nhất',
  'nhat',
  'nào',
  'nao',
  'không',
  'khong',
  'có',
  'co',
  'mua',
  'bán',
  'ban',
  'giúp',
  'giup',
  'xin',
  'vui',
  'lòng',
  'long',
  'đang',
  'dang',
  'ở',
  'o',
  'đâu',
  'dau',
  'giá',
  'gia',
  'tiền',
  'tien',
  'dưới',
  'duoi',
  'trên',
  'tren',
  'khoảng',
  'khoang',
  'ngàn',
  'ngan',
  'nghìn',
  'nghin',
  'đồng',
  'dong',
  'k',
  'đ',
  'd',
  'vnd',
  'từ',
  'tu',
  'đến',
  'den',
  'thể loại',
  'the loai',
  'tác giả',
  'tac gia',
]);

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
  private readonly MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  private readonly requestTimeoutMs = 5000;

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. SYSTEM PROMPT ──
  private buildSystemPrompt(): string {
    return `Bạn là trợ lý AI của Modern Book — hệ thống bán sách trực tuyến hàng đầu Việt Nam.

Nhiệm vụ:
- Giúp khách hàng tìm sách phù hợp với nhu cầu
- Tra cứu trạng thái đơn hàng
- Gợi ý sách hay dựa trên sở thích
- Trả lời câu hỏi về sách và cửa hàng

Quy tắc bắt buộc:
- Trả lời bằng tiếng Việt, thân thiện và ngắn gọn (tối đa 300 từ)
- Chỉ được giới thiệu những cuốn sách CÓ TRONG phần NGỮ CẢNH DỮ LIỆU HỆ THỐNG. Không có trong ngữ cảnh thì không được nhắc tới.
- Khi gợi ý sách, LUÔN bao gồm: tên sách, giá (định dạng VNĐ), đánh giá sao, và đường dẫn dạng [Xem chi tiết](/book/ID) — lấy nguyên văn từ ngữ cảnh
- Format giá: 125.000đ (dùng dấu chấm phân cách nghìn)
- TUYỆT ĐỐI không bịa tên sách, giá, đánh giá, mã giảm giá hay đường link. Link chi tiết chỉ được copy từ ngữ cảnh, KHÔNG tự chế ra (/book/101 là sai).
- Nếu ngữ cảnh không có sách phù hợp: nói rõ là chưa tìm thấy trong hệ thống và hướng dẫn khách dùng thanh tìm kiếm ở đầu trang. Không được đoán bừa.
- Khi user hỏi về đơn hàng mà chưa đăng nhập, yêu cầu đăng nhập tại [đây](/login)
- Sử dụng emoji phù hợp để làm nội dung sinh động`;
  }

  // ── 2. INTENT CLASSIFICATION ──
  classifyIntent(
    message: string,
  ):
    | 'book_search'
    | 'order_tracking'
    | 'promotion'
    | 'recommendation'
    | 'general' {
    const lower = message.toLowerCase();

    if (
      /đơn hàng|don hang|order|giao hàng|giao hang|vận chuyển|van chuyen|trạng thái đơn|trang thai don|đơn của tôi|don cua toi|theo dõi|theo doi|shipper|mã đơn|ma don/.test(
        lower,
      )
    )
      return 'order_tracking';

    if (
      /mã giảm giá|khuyến mãi|giảm giá|ưu đãi|mã ưu đãi|coupon|voucher|khuyen mai|ma giam gia|uu dai|ma uu dai|giam gia/.test(
        lower,
      )
    )
      return 'promotion';

    // TODO (bài tập live-code cho sinh viên): thêm intent 'return_policy'
    // cho câu hỏi đổi trả / hoàn tiền / bảo hành tại đây.

    if (
      /tương tự|tuong tu|giống|giong|gợi ý|goi y|recommend|hay như|hay nhu|nên đọc gì|nen doc gi|sách nào hay|sach nao hay|đọc gì|doc gi|sách gì|sach gi/.test(
        lower,
      )
    )
      return 'recommendation';

    if (
      /tìm sách|tim sach|sách về|sach ve|sách cho|sach cho|mua sách|mua sach|giá.*dưới|gia.*duoi|giá.*trên|gia.*tren|thể loại|the loai|tác giả|tac gia|tìm kiếm|tim kiem|có sách|co sach|bán sách|ban sach|dưới|duoi|trên|tren/.test(
        lower,
      )
    )
      return 'book_search';

    return 'general';
  }

  // ── 3. CONTEXT BUILDERS ──

  async buildBookSearchContext(message: string): Promise<string> {
    const lower = message.toLowerCase();

    // ── Tách giá từ câu hỏi ──
    // "dưới 200k / 200 nghìn / 200.000" → lte; "trên 50k" → gte;
    // "khoảng 100k-200k" / "từ 100k đến 200k" → gte + lte; "150k" → lte (hành vi cũ)
    const toPrice = (raw: string, hasUnit: boolean) =>
      parseInt(raw.replace(/\./g, ''), 10) * (hasUnit ? 1000 : 1);

    let priceFilter: { gte?: number; lte?: number } = {};

    const rangeMatch = lower.match(
      /(?:khoảng|khoang|từ|tu)\s*(\d[\d.]*)\s*(k)?\s*(?:-|–|đến|den)\s*(\d[\d.]*)\s*(k|nghìn|ngàn)?/,
    );

    if (rangeMatch) {
      const hasUnit = Boolean(rangeMatch[2] || rangeMatch[4]);
      priceFilter = {
        gte: toPrice(rangeMatch[1], hasUnit),
        lte: toPrice(rangeMatch[3], hasUnit),
      };
    } else {
      const lteMatch = lower.match(
        /(?:dưới|duoi)\s*(\d[\d.]*)\s*(k|nghìn|ngàn)?/,
      );
      const gteMatch = lower.match(
        /(?:trên|tren)\s*(\d[\d.]*)\s*(k|nghìn|ngàn)?/,
      );

      if (lteMatch)
        priceFilter.lte = toPrice(lteMatch[1], Boolean(lteMatch[2]));
      if (gteMatch)
        priceFilter.gte = toPrice(gteMatch[1], Boolean(gteMatch[2]));

      if (!priceFilter.gte && !priceFilter.lte) {
        // "150k", "100 nghìn", "200.000" không có từ chỉ hướng → lte
        const generic = lower.match(
          /(\d+)\s*k|(\d+)\s*(?:nghìn|ngàn)|(\d+(?:\.\d{3})+)\s*đ?/,
        );
        if (generic) {
          const raw = generic[1] || generic[2] || generic[3];
          priceFilter.lte = toPrice(raw, Boolean(generic[1] || generic[2]));
        }
      }
    }

    // ── Tách từ khóa: xóa số + đơn vị tiền rồi lọc stopword ──
    const keyword = message
      .replace(/\b\d[\d.]*\s*(?:k|nghìn|ngàn|đ)?\b/gi, ' ')
      .split(/[\s,.;:!?()"'\-–—…/\\]+/)
      .filter((w) => w && !SEARCH_STOPWORDS.has(w.toLowerCase()))
      .join(' ')
      .trim()
      .slice(0, 50);

    const books = await this.prisma.book.findMany({
      where: {
        is_active: true,
        ...(priceFilter.gte || priceFilter.lte ? { price: priceFilter } : {}),
        ...(keyword
          ? {
              OR: [
                { title: { contains: keyword, mode: 'insensitive' } },
                { description: { contains: keyword, mode: 'insensitive' } },
                {
                  book_authors: {
                    some: {
                      author: {
                        name: { contains: keyword, mode: 'insensitive' },
                      },
                    },
                  },
                },
                {
                  book_categories: {
                    some: {
                      category: {
                        name: { contains: keyword, mode: 'insensitive' },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        book_categories: { include: { category: true }, take: 2 },
        book_authors: { include: { author: true }, take: 1 },
      },
      orderBy: [{ avg_rating: 'desc' }, { sold_count: 'desc' }],
      take: 6,
    });

    // Fallback: trả về sách nổi bật nếu không match từ khóa
    if (books.length === 0) {
      const fallback = await this.prisma.book.findMany({
        where: {
          is_active: true,
          ...(priceFilter.gte || priceFilter.lte ? { price: priceFilter } : {}),
        },
        include: {
          book_categories: { include: { category: true }, take: 2 },
          book_authors: { include: { author: true }, take: 1 },
        },
        orderBy: [{ avg_rating: 'desc' }, { sold_count: 'desc' }],
        take: 6,
      });
      if (fallback.length === 0)
        return 'Không tìm thấy sách phù hợp trong hệ thống.';
      return this.formatBooksContext(fallback);
    }

    return this.formatBooksContext(books);
  }

  private formatBooksContext(books: any[]): string {
    return `📚 DỮ LIỆU SÁCH TÌM ĐƯỢC (${books.length} kết quả):
${books
  .map(
    (b, i) => `
${i + 1}. "${b.title}"
   - Giá: ${Number(b.price).toLocaleString('vi-VN')}đ
   - Đánh giá: ${Number(b.avg_rating).toFixed(1)}⭐ (${b.rating_count} lượt đánh giá)
   - Thể loại: ${b.book_categories?.map((bc: any) => bc.category.name).join(', ') || 'Chưa phân loại'}
   - Tác giả: ${b.book_authors?.map((ba: any) => ba.author.name).join(', ') || 'Đang cập nhật'}
   - Link: [Xem chi tiết](/book/${b.book_id})`,
  )
  .join('')}`;
  }

  async buildOrderContext(userId: string): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: { user_id: userId },
      include: {
        items: { include: { book: { select: { title: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    if (orders.length === 0) return 'Khách hàng chưa có đơn hàng nào.';

    const statusMap: Record<string, string> = {
      pending: '⏳ Chờ xác nhận',
      confirmed: '✅ Đã xác nhận',
      shipping: '🚚 Đang giao hàng',
      delivered: '📦 Đã giao thành công',
      cancelled: '❌ Đã hủy',
      refunded: '💰 Đã hoàn tiền',
    };

    return `📋 ĐƠN HÀNG GẦN ĐÂY CỦA KHÁCH HÀNG:
${orders
  .map(
    (o, i) => `
${i + 1}. Mã đơn: ${o.order_code}
   - Trạng thái: ${statusMap[o.status] || o.status}
   - Tổng tiền: ${Number(o.total_amount).toLocaleString('vi-VN')}đ
   - Ngày đặt: ${o.created_at.toLocaleDateString('vi-VN')}
   - Sản phẩm: ${o.items.map((it) => it.book.title).join(', ')}`,
  )
  .join('')}`;
  }

  async buildPromotionContext(): Promise<string> {
    const coupons = await this.prisma.coupon.findMany({
      where: {
        is_active: true,
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
      orderBy: { discount_value: 'desc' },
      take: 5,
    });

    if (coupons.length === 0)
      return 'Hiện chưa có mã giảm giá nào đang hoạt động.';

    const typeLabel = (type: string) =>
      type === 'percentage'
        ? '%'
        : type === 'fixed_amount'
          ? 'VNĐ'
          : 'Miễn phí vận chuyển';

    const valueLabel = (c: Coupon) => {
      const value = Number(c.discount_value);
      if (c.discount_type === 'percentage') return `${value}%`;
      if (c.discount_type === 'fixed_amount')
        return `${value.toLocaleString('vi-VN')}đ`;
      return 'Miễn phí vận chuyển';
    };

    return `🎁 MÃ GIẢM GIÁ ĐANG HOẠT ĐỘNG (${coupons.length}):
${coupons
  .map(
    (c, i) => `
${i + 1}. Mã: ${c.code}
   - Loại giảm: ${typeLabel(c.discount_type)}
   - Giá trị: ${valueLabel(c)}
   - Điều kiện: ${
     c.min_order_value != null && Number(c.min_order_value) > 0
       ? `Đơn tối thiểu ${Number(c.min_order_value).toLocaleString('vi-VN')}đ`
       : 'Không yêu cầu đơn tối thiểu'
   }
   - Hạn dùng: đến ${c.end_date.toLocaleDateString('vi-VN')}`,
  )
  .join('')}`;
  }

  async buildRecommendationContext(userId?: string): Promise<string> {
    let recentBookTitles: string[] = [];
    let recentCategoryIds: string[] = [];

    if (userId) {
      const purchases = await this.prisma.orderItem.findMany({
        where: {
          order: {
            user_id: userId,
            status: { in: ['delivered', 'confirmed', 'shipping'] },
          },
        },
        include: {
          book: {
            select: {
              title: true,
              book_id: true,
              book_categories: { select: { category_id: true }, take: 2 },
            },
          },
        },
        orderBy: { order: { created_at: 'desc' } },
        take: 5,
      });
      recentBookTitles = purchases.map((p) => p.book.title);
      recentCategoryIds = purchases
        .flatMap((p) => p.book.book_categories.map((bc) => bc.category_id))
        .filter((id, idx, arr) => arr.indexOf(id) === idx);
    }

    const trending = await this.prisma.book.findMany({
      where: {
        is_active: true,
        ...(recentCategoryIds.length > 0
          ? {
              book_categories: {
                some: { category_id: { in: recentCategoryIds } },
              },
            }
          : {}),
      },
      include: {
        book_categories: { include: { category: true }, take: 2 },
        book_authors: { include: { author: true }, take: 1 },
      },
      orderBy: [{ avg_rating: 'desc' }, { sold_count: 'desc' }],
      take: 8,
    });

    const trendingStr = trending
      .map(
        (b, i) =>
          `${i + 1}. "${b.title}" — ${Number(b.price).toLocaleString('vi-VN')}đ — ${Number(b.avg_rating).toFixed(1)}⭐ — ${b.book_categories?.map((bc: any) => bc.category.name).join(', ')} — ID: ${b.book_id}`,
      )
      .join('\n');

    return `${recentBookTitles.length > 0 ? `📖 SÁCH KHÁCH ĐÃ MUA GẦN ĐÂY: ${recentBookTitles.join(', ')}\n\n` : ''}📚 SÁCH GỢI Ý (dựa trên sở thích):\n${trendingStr}`;
  }

  // ── 4. LOCAL RAG FALLBACK ──

  private buildFallbackText(context: string, intent: string): string {
    switch (intent) {
      case 'book_search':
        return `📚 Đây là những cuốn sách phù hợp với bạn:\n\n${context}\n\nNếu bạn muốn tìm thêm, hãy mô tả rõ hơn nhé! 😊`;
      case 'order_tracking':
        return `📋 Tra cứu đơn hàng của bạn:\n\n${context}\n\nNếu đơn hàng có vấn đề, bạn có thể [đăng nhập](/login) để kiểm tra chi tiết hoặc liên hệ hỗ trợ nhé! 😊`;
      case 'recommendation':
        return `✨ Gợi ý dành riêng cho bạn:\n\n${context}`;
      case 'promotion':
        return `🎁 Các mã giảm giá đang hoạt động:\n\n${context}`;
      default:
        return `🏬 Chào mừng bạn đến với Modern Book — cửa hàng sách tiếng Việt với hàng nghìn đầu sách, giao hàng nhanh và hỗ trợ đổi trả trong 7 ngày.

Bạn có thể thử hỏi mình:
1. "Tìm sách lập trình dưới 200k"
2. "Gợi ý sách hay cho cuối tuần"
3. "Đơn hàng của tôi đang ở đâu?" — cần [đăng nhập](/login) để tra cứu đơn hàng nhé!`;
    }
  }

  private async *streamLocalFallback(
    context: string,
    intent: string,
  ): AsyncGenerator<string> {
    const text =
      this.buildFallbackText(context, intent) ||
      'Xin lỗi, mình chưa xử lý được yêu cầu này. Bạn thử diễn đạt lại nhé! 😊';

    const CHUNK_SIZE = 70;

    try {
      let remaining = text;
      while (remaining.length > 0) {
        let size = Math.min(CHUNK_SIZE, remaining.length);
        if (size < remaining.length) {
          const space = remaining.lastIndexOf(' ', size);
          if (space > 40) size = space;
        }
        yield remaining.slice(0, size);
        remaining = remaining.slice(size);
        if (remaining.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
    } catch {
      // Local RAG Fallback không bao giờ throw
    }
  }

  // ── 5. MAIN CHAT METHOD (Streaming) ──
  async *chat(
    message: string,
    conversationHistory: { role: string; content: string }[],
    userId?: string,
  ): AsyncGenerator<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // Step 1: Classify intent
    const intent = this.classifyIntent(message);
    this.logger.log(`Intent: ${intent} | Message: "${message.slice(0, 50)}"`);

    // Step 2: Build context
    let context = '';
    let contextFailed = false;
    try {
      switch (intent) {
        case 'book_search':
          context = await this.buildBookSearchContext(message);
          break;
        case 'order_tracking':
          if (!userId) {
            yield 'Bạn cần **đăng nhập** để tra cứu đơn hàng. Vui lòng [đăng nhập tại đây](/login) rồi hỏi lại nhé! 😊';
            return;
          }
          context = await this.buildOrderContext(userId);
          break;
        case 'recommendation':
          context = await this.buildRecommendationContext(userId);
          break;
        case 'promotion':
          context = await this.buildPromotionContext();
          break;
        default:
          context =
            'Đây là hệ thống bán sách trực tuyến Modern Book. Website bán sách online với hàng ngàn đầu sách đa dạng.';
      }
    } catch (err) {
      this.logger.error('Context build error:', err);
      contextFailed = true;
    }

    // Không có dữ liệu thật → trả lời cố định, tuyệt đối không để LLM tự bịa sách
    if (contextFailed) {
      yield 'Hiện mình chưa tải được dữ liệu sách từ hệ thống nên chưa thể tư vấn chính xác. Bạn thử lại sau ít phút, hoặc dùng thanh tìm kiếm ở đầu trang nhé! 😊';
      return;
    }
    if (intent === 'book_search' && context.startsWith('Không tìm thấy sách phù hợp')) {
      yield 'Mình chưa tìm thấy cuốn nào phù hợp trong hệ thống. Bạn thử từ khoá khác, hoặc dùng thanh tìm kiếm ở đầu trang để lọc theo danh mục và giá nhé! 😊';
      return;
    }

    // Step 3: Không có API key → trả lời bằng Local RAG Fallback
    if (!apiKey) {
      this.logger.warn('Chưa có DEEPSEEK_API_KEY, dùng Local RAG Fallback');
      yield* this.streamLocalFallback(context, intent);
      return;
    }

    // Step 4: Compose messages (system prompt trước để tận dụng context caching)
    const messages = [
      { role: 'system', content: this.buildSystemPrompt() },
      {
        role: 'system',
        content: `--- NGỮ CẢNH DỮ LIỆU HỆ THỐNG ---\n${context}\n--- KẾT THÚC NGỮ CẢNH ---\n\nNHẮC LẠI QUY TẮC:\n1. Chỉ nhắc tới sách/giá/khuyến mãi có trong ngữ cảnh trên.\n2. Link chi tiết phải copy nguyên văn dạng /book/<uuid> từ ngữ cảnh; không tự tạo link.\n3. Ngữ cảnh không có sách phù hợp thì nói chưa tìm thấy và hướng dẫn dùng thanh tìm kiếm.`,
      },
      ...conversationHistory.slice(-8), // Keep last 8 turns
      { role: 'user', content: message },
    ];

    // Step 5: Call DeepSeek API (streaming) — timeout + fallback khi lỗi
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );
    let response: Response;
    try {
      response = await fetch(this.DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages,
          stream: true,
          temperature: 0.3,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.warn('DeepSeek fetch error, dùng Local RAG Fallback:', err);
      yield* this.streamLocalFallback(context, intent);
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      this.logger.warn(`DeepSeek error ${response.status}: ${errText}`);
      yield* this.streamLocalFallback(context, intent);
      return;
    }

    // Step 6: Parse SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      this.logger.warn('Không thể đọc phản hồi từ AI, dùng Local RAG Fallback');
      yield* this.streamLocalFallback(context, intent);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
