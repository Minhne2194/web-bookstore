import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

const originalApiKey = process.env.DEEPSEEK_API_KEY;

const mockBook = {
  book_id: 'book-1',
  title: 'Lập trình Python cơ bản',
  price: 150000,
  avg_rating: 4.5,
  rating_count: 120,
  book_categories: [{ category: { name: 'Công nghệ' } }],
  book_authors: [{ author: { name: 'Nguyễn Văn A' } }],
};

const mockCoupon = {
  coupon_id: 'cp-1',
  code: 'SALE10',
  discount_type: 'percentage',
  discount_value: 10,
  min_order_value: 200000,
  start_date: new Date('2025-01-01'),
  end_date: new Date('2030-12-31'),
  is_active: true,
};

async function collectChunks(
  gen: AsyncGenerator<string>,
): Promise<{ chunks: string[]; text: string }> {
  const chunks: string[] = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return { chunks, text: chunks.join('') };
}

describe('ChatService', () => {
  let service: ChatService;
  let mockPrisma: {
    book: { findMany: jest.Mock };
    coupon: { findMany: jest.Mock };
  };

  beforeEach(() => {
    mockPrisma = {
      book: { findMany: jest.fn() },
      coupon: { findMany: jest.fn() },
    };
    service = new ChatService(mockPrisma as unknown as PrismaService);
    process.env.DEEPSEEK_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalApiKey;
  });

  describe('classifyIntent', () => {
    // classifyIntent không dùng prisma → mock bằng object rỗng
    const classifier = new ChatService({} as unknown as PrismaService);

    const cases: Array<[string, string]> = [
      ['đơn hàng của tôi đang ở đâu?', 'order_tracking'],
      ['don hang cua toi dau roi', 'order_tracking'],
      ['có mã giảm giá nào không?', 'promotion'],
      ['co ma giam gia khong', 'promotion'],
      ['tìm sách giảm giá', 'promotion'],
      ['sách lập trình dưới 200k', 'book_search'],
      ['tim sach lap trinh', 'book_search'],
      ['mua sách giá dưới 100k', 'book_search'],
      ['gợi ý sách hay', 'recommendation'],
      ['sach nao hay nhat', 'recommendation'],
      ['xin chào', 'general'],
      ['bạn là ai', 'general'],
    ];

    it.each(cases)('classifies "%s" as %s', (message, expected) => {
      expect(classifier.classifyIntent(message)).toBe(expected);
    });
  });

  describe('buildBookSearchContext', () => {
    it('trả về context chứa tên sách, link [Xem chi tiết](/book/ và giá VNĐ', async () => {
      mockPrisma.book.findMany.mockResolvedValue([mockBook]);

      const context = await service.buildBookSearchContext(
        'sách lập trình dưới 200k',
      );

      expect(context).toContain('Lập trình Python cơ bản');
      expect(context).toContain('[Xem chi tiết](/book/book-1)');
      expect(context).toContain('150.000đ');
      expect(context).toContain('4.5⭐');
      expect(context).toContain('Công nghệ');
      expect(context).toContain('Nguyễn Văn A');
    });

    it('truyền price.lte + OR mở rộng (title, description, tác giả, thể loại) vào query', async () => {
      mockPrisma.book.findMany.mockResolvedValue([]);

      await service.buildBookSearchContext('tìm sách Python dưới 200k');

      const query = mockPrisma.book.findMany.mock.calls[0][0];
      expect(query.where.price).toEqual({ lte: 200000 });
      expect(query.where.OR).toHaveLength(4);
      expect(query.where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: { contains: 'Python', mode: 'insensitive' },
          }),
          expect.objectContaining({
            book_authors: {
              some: {
                author: {
                  name: { contains: 'Python', mode: 'insensitive' },
                },
              },
            },
          }),
          expect.objectContaining({
            book_categories: {
              some: {
                category: {
                  name: { contains: 'Python', mode: 'insensitive' },
                },
              },
            },
          }),
        ]),
      );
    });

    it('hỗ trợ "trên Xk" (gte) và "khoảng X-Y" (gte + lte)', async () => {
      mockPrisma.book.findMany.mockResolvedValue([]);

      await service.buildBookSearchContext('sách trên 50k');
      expect(mockPrisma.book.findMany.mock.calls[0][0].where.price).toEqual({
        gte: 50000,
      });

      // mock trả sách để lần gọi sau không vào nhánh fallback (không phát sinh thêm query)
      mockPrisma.book.findMany.mockResolvedValue([mockBook]);
      await service.buildBookSearchContext('sách khoảng 100k-200k');
      expect(mockPrisma.book.findMany.mock.calls[2][0].where.price).toEqual({
        gte: 100000,
        lte: 200000,
      });
    });
  });

  describe('buildPromotionContext', () => {
    it('trả về context chứa mã coupon khi có coupon đang hoạt động', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([mockCoupon]);

      const context = await service.buildPromotionContext();

      const query = mockPrisma.coupon.findMany.mock.calls[0][0];
      expect(query.where.is_active).toBe(true);
      expect(query.where.start_date).toBeDefined();
      expect(query.where.end_date).toBeDefined();

      expect(context).toContain('SALE10');
      expect(context).toContain('10%');
      expect(context).toContain('Đơn tối thiểu 200.000đ');
      expect(context).toContain('Hạn dùng');
    });

    it('trả về thông báo khi không có coupon nào', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([]);

      const context = await service.buildPromotionContext();

      expect(context).toContain('Hiện chưa có mã giảm giá nào đang hoạt động.');
    });
  });

  describe('chat', () => {
    it('không có DEEPSEEK_API_KEY → Local RAG Fallback, không gọi fetch', async () => {
      mockPrisma.book.findMany.mockResolvedValue([mockBook]);
      delete process.env.DEEPSEEK_API_KEY;
      const fetchSpy = jest.spyOn(globalThis, 'fetch');

      const { chunks, text } = await collectChunks(
        service.chat('sách lập trình dưới 200k', [], undefined),
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(text).toContain('Xem chi tiết');
      expect(text).toContain('Lập trình Python cơ bản');
    });

    it('có key + fetch trả SSE → yield nội dung AI (system prompt đứng trước)', async () => {
      mockPrisma.book.findMany.mockResolvedValue([mockBook]);
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"Xin chào"}}]}\n\ndata: [DONE]\n\n',
            ),
          );
          controller.close();
        },
      });
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(body, { status: 200 }));

      const { text } = await collectChunks(
        service.chat('xin chào', [], undefined),
      );

      expect(text).toBe('Xin chào');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      const fetchArgs = (globalThis.fetch as jest.Mock).mock.calls[0];
      const bodyArg = JSON.parse(fetchArgs[1].body);
      expect(bodyArg.messages[0].role).toBe('system');
      expect(bodyArg.messages[0].content).toContain('Modern Book');
      expect(bodyArg.messages[1].role).toBe('system');
      expect(bodyArg.messages.at(-1)).toEqual({
        role: 'user',
        content: 'xin chào',
      });
    });

    it('fetch lỗi mạng → fallback vẫn yield chunks hữu ích (không có ❌)', async () => {
      mockPrisma.book.findMany.mockResolvedValue([mockBook]);
      jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new TypeError('Network down'));

      const { chunks, text } = await collectChunks(
        service.chat('tìm sách lập trình', [], undefined),
      );

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(text).not.toContain('❌');
      expect(text).toContain('Xem chi tiết');
      expect(text).toContain('Lập trình Python cơ bản');
    });

    it('fetch treo quá timeout → abort → fallback', async () => {
      jest.setTimeout(15000);
      mockPrisma.book.findMany.mockResolvedValue([mockBook]);
      (service as any).requestTimeoutMs = 100; // rút ngắn để test chạy nhanh
      jest.spyOn(globalThis, 'fetch').mockImplementation(
        (_url: any, init: any) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(
                new DOMException('The operation was aborted.', 'AbortError'),
              ),
            );
          }),
      );

      const { text } = await collectChunks(
        service.chat('tìm sách lập trình', [], undefined),
      );

      expect(text).toContain('Xem chi tiết');
      expect(text).not.toContain('❌');
    });

    it('build context lỗi (DB down) → trả lời cố định, không gọi LLM để tránh bịa sách', async () => {
      mockPrisma.book.findMany.mockRejectedValue(new Error('DB down'));
      const fetchSpy = jest.spyOn(globalThis, 'fetch');

      const { text } = await collectChunks(
        service.chat('tìm sách lập trình', [], undefined),
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(text).toContain('chưa tải được dữ liệu sách');
      expect(text).not.toContain('/book/');
    });

    it('không có sách nào khớp → trả lời cố định, không gọi LLM', async () => {
      mockPrisma.book.findMany.mockResolvedValue([]);
      const fetchSpy = jest.spyOn(globalThis, 'fetch');

      const { text } = await collectChunks(
        service.chat('tìm sách lập trình', [], undefined),
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(text).toContain('chưa tìm thấy cuốn nào phù hợp');
    });
  });
});
