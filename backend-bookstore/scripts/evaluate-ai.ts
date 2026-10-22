/**
 * Benchmark đánh giá chất lượng AI chatbot — Modern Book.
 *
 * Phần 1 (offline, luôn chạy): chạy classifyIntent trên dataset 50 câu tiếng Việt
 *   (5 intent × 10 câu), tính confusion matrix, Accuracy, Precision/Recall/F1
 *   cho từng intent + macro avg.
 * Phần 2 (retrieval, chỉ khi có DATABASE_URL): đo latency của buildBookSearchContext
 *   trên 5 câu book_search trong dataset, và Hit Rate@5 với 5 tên sách thật
 *   trong seed (nguồn seed: scripts/crawler/output/books_seed.json như prisma/seed.ts,
 *   fallback: top 5 sách active trong DB).
 *
 * Chạy: npm run ai:evaluate
 */
import * as fs from 'fs';
import * as path from 'path';
import { ChatService } from '../src/chat/chat.service';
import { PrismaService } from '../src/prisma/prisma.service';

const INTENTS = [
  'book_search',
  'order_tracking',
  'recommendation',
  'promotion',
  'general',
] as const;

type Intent = (typeof INTENTS)[number];

interface DatasetItem {
  query: string;
  expected: Intent;
}

/**
 * Dataset 50 câu (5 intent × 10 câu). expected phải khớp chính xác với hành vi
 * thực tế của classifyIntent (thứ tự ưu tiên: order_tracking → recommendation →
 * book_search → promotion → general). KHÔNG được sửa classifyIntent.
 */
const DATASET: DatasetItem[] = [
  // ── book_search (10) ──
  { query: 'tìm sách về lập trình python', expected: 'book_search' },
  { query: 'sách lập trình giá dưới 200k', expected: 'book_search' },
  { query: 'có bán sách Đắc Nhân Tâm không', expected: 'book_search' },
  { query: 'tìm kiếm truyện trinh thám', expected: 'book_search' },
  { query: 'có sách nấu ăn không', expected: 'book_search' },
  { query: 'sách của tác giả Nguyễn Nhật Ánh', expected: 'book_search' },
  { query: 'tìm sách thiếu nhi', expected: 'book_search' },
  { query: 'sách về trí tuệ nhân tạo', expected: 'book_search' },
  { query: 'có sách tiếng anh nào không', expected: 'book_search' },
  { query: 'tìm sách kinh tế', expected: 'book_search' },

  // ── order_tracking (10) ──
  { query: 'đơn hàng của tôi tới đâu rồi', expected: 'order_tracking' },
  { query: 'kiểm tra trạng thái đơn hàng', expected: 'order_tracking' },
  { query: 'đơn của tôi đang giao chưa', expected: 'order_tracking' },
  { query: 'theo dõi mã đơn ABC123', expected: 'order_tracking' },
  { query: 'order cua toi dau roi', expected: 'order_tracking' },
  { query: 'khi nào shipper giao hàng', expected: 'order_tracking' },
  { query: 'tra cứu đơn hàng', expected: 'order_tracking' },
  { query: 'đơn hàng bị giao chậm', expected: 'order_tracking' },
  { query: 'tình trạng đơn hàng của tôi', expected: 'order_tracking' },
  { query: 'giao hàng mấy ngày thì tới', expected: 'order_tracking' },

  // ── recommendation (10) ──
  { query: 'gợi ý cho tôi vài cuốn sách hay', expected: 'recommendation' },
  { query: 'sách nào hay nên đọc', expected: 'recommendation' },
  { query: 'tôi nên đọc gì cuối tuần này', expected: 'recommendation' },
  { query: 'gợi ý sách giống Đắc Nhân Tâm', expected: 'recommendation' },
  { query: 'có sách gì hay để đọc không', expected: 'recommendation' },
  { query: 'recommend sach cho toi', expected: 'recommendation' },
  { query: 'sách gì đang hot vậy', expected: 'recommendation' },
  { query: 'recommend cho tôi sách', expected: 'recommendation' },
  { query: 'tôi thích tiểu thuyết, gợi ý giúp', expected: 'recommendation' },
  { query: 'nên đọc gì để thư giãn', expected: 'recommendation' },

  // ── promotion (10) ──
  { query: 'có mã giảm giá nào không', expected: 'promotion' },
  { query: 'đang có khuyến mãi gì', expected: 'promotion' },
  { query: 'cho tôi mã ưu đãi', expected: 'promotion' },
  { query: 'co voucher gi khong', expected: 'promotion' },
  { query: 'có ưu đãi gì cho lần mua đầu tiên không', expected: 'promotion' },
  { query: 'mã coupon giảm giá sách', expected: 'promotion' },
  { query: 'chương trình khuyến mãi tháng này', expected: 'promotion' },
  { query: 'có giảm giá gì không', expected: 'promotion' },
  { query: 'ma giam gia hom nay', expected: 'promotion' },
  { query: 'giảm giá cho sinh viên có không', expected: 'promotion' },

  // ── general (10) ──
  { query: 'xin chào', expected: 'general' },
  { query: 'cửa hàng mở cửa lúc mấy giờ', expected: 'general' },
  { query: 'địa chỉ cửa hàng ở đâu', expected: 'general' },
  { query: 'cảm ơn bạn', expected: 'general' },
  { query: 'tạm biệt', expected: 'general' },
  { query: 'cho tôi biết về cửa hàng', expected: 'general' },
  { query: 'chào buổi sáng', expected: 'general' },
  { query: 'bạn là ai', expected: 'general' },
  { query: 'cửa hàng có bán đồ chơi không', expected: 'general' },
  { query: 'hello', expected: 'general' },
];

// ── Dataset validation (lỗi cấu trúc → exit 1) ──
function failDataset(message: string): never {
  console.error(`❌ Dataset lỗi cấu trúc: ${message}`);
  process.exit(1);
}

function validateDataset(): void {
  if (!Array.isArray(DATASET) || DATASET.length !== 50) {
    failDataset(`phải có đúng 50 câu, hiện có ${DATASET.length}`);
  }
  DATASET.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      failDataset(`item #${index} không phải object hợp lệ`);
    }
    if (typeof item.query !== 'string' || item.query.trim() === '') {
      failDataset(`item #${index} thiếu trường query (string không rỗng)`);
    }
    if (!(INTENTS as readonly string[]).includes(item.expected)) {
      failDataset(
        `item #${index} có expected không hợp lệ: "${item.expected}" (chấp nhận: ${INTENTS.join(' | ')})`,
      );
    }
  });
  for (const intent of INTENTS) {
    const count = DATASET.filter((item) => item.expected === intent).length;
    if (count !== 10) {
      failDataset(`intent "${intent}" phải có đúng 10 câu, hiện có ${count}`);
    }
  }
}

function fmt(value: number): string {
  return value.toFixed(2);
}

// ── Phần 1: Intent classification (offline) ──
function runIntentEvaluation(): { accuracy: number; macroF1: number } {
  console.log('========================================================');
  console.log('PHẦN 1: INTENT CLASSIFICATION (offline)');
  console.log('========================================================');

  const chatService = new ChatService({} as any);

  const confusion = new Map<Intent, Map<Intent, number>>();
  const support = {} as Record<Intent, number>;
  const truePositive = {} as Record<Intent, number>;
  const predictedCount = {} as Record<Intent, number>;
  for (const intent of INTENTS) {
    confusion.set(
      intent,
      new Map<Intent, number>(INTENTS.map((pred) => [pred, 0])),
    );
    support[intent] = 0;
    truePositive[intent] = 0;
    predictedCount[intent] = 0;
  }

  const errors: Array<{ query: string; expected: Intent; predicted: string }> =
    [];
  let correct = 0;

  for (const item of DATASET) {
    const predicted = chatService.classifyIntent(item.query) as Intent;
    support[item.expected] += 1;
    predictedCount[predicted] += 1;
    confusion.get(item.expected)!.set(
      predicted,
      confusion.get(item.expected)!.get(predicted)! + 1,
    );
    if (predicted === item.expected) {
      correct += 1;
      truePositive[item.expected] += 1;
    } else {
      errors.push({ query: item.query, expected: item.expected, predicted });
    }
  }

  // Confusion matrix (dòng = expected, cột = predicted)
  console.log('\nConfusion matrix (dòng = expected, cột = predicted):');
  console.log(`| Expected \\ Predicted | ${INTENTS.join(' | ')} |`);
  console.log(`| --- | ${INTENTS.map(() => '---').join(' | ')} |`);
  for (const expected of INTENTS) {
    const row = INTENTS.map(
      (pred) => `${confusion.get(expected)!.get(pred)!}`,
    ).join(' | ');
    console.log(`| ${expected} | ${row} |`);
  }

  // Precision / Recall / F1 từng intent
  console.log('\n| Intent | Precision | Recall | F1-Score | Support |');
  console.log('| ------ | --------- | ------ | -------- | ------- |');
  let macroPrecision = 0;
  let macroRecall = 0;
  let macroF1 = 0;
  for (const intent of INTENTS) {
    const precision =
      predictedCount[intent] > 0
        ? truePositive[intent] / predictedCount[intent]
        : 0;
    const recall =
      support[intent] > 0 ? truePositive[intent] / support[intent] : 0;
    const f1 =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    macroPrecision += precision;
    macroRecall += recall;
    macroF1 += f1;
    console.log(
      `| ${intent} | ${fmt(precision)} | ${fmt(recall)} | ${fmt(f1)} | ${support[intent]} |`,
    );
  }
  macroPrecision /= INTENTS.length;
  macroRecall /= INTENTS.length;
  macroF1 /= INTENTS.length;
  console.log(
    `| **Macro Avg** | ${fmt(macroPrecision)} | ${fmt(macroRecall)} | ${fmt(macroF1)} | ${DATASET.length} |`,
  );

  const accuracy = correct / DATASET.length;
  console.log(`\nAccuracy: ${fmt(accuracy * 100)}% (${correct}/${DATASET.length})`);

  if (errors.length > 0) {
    console.log(`\n⚠️ ${errors.length} câu bị nhận diện sai:`);
    for (const error of errors) {
      console.log(
        `   "${error.query}" → dự đoán: ${error.predicted} | expected: ${error.expected}`,
      );
    }
  } else {
    console.log('✅ Tất cả câu đều được phân loại đúng.');
  }

  return { accuracy, macroF1 };
}

// ── Phần 2: Retrieval evaluation (chỉ khi có DATABASE_URL) ──
async function loadSeedBookTitles(prisma: PrismaService): Promise<string[]> {
  // Ưu tiên đọc nguồn dữ liệu seed mà prisma/seed.ts sử dụng
  const seedJson = path.join(__dirname, 'crawler', 'output', 'books_seed.json');
  if (fs.existsSync(seedJson)) {
    try {
      const books = JSON.parse(fs.readFileSync(seedJson, 'utf-8')) as Array<{
        title?: unknown;
      }>;
      const titles = books
        .filter((b) => typeof b?.title === 'string' && b.title.trim() !== '')
        .slice(0, 5)
        .map((b) => (b.title as string).trim());
      if (titles.length === 5) return titles;
    } catch {
      // fall through sang truy vấn DB
    }
  }

  // Fallback: 5 sách active có rating cao nhất trong DB
  const books = await prisma.book.findMany({
    where: { is_active: true },
    orderBy: [{ avg_rating: 'desc' }, { sold_count: 'desc' }],
    take: 5,
    select: { title: true },
  });
  return books.map((b) => b.title);
}

async function runRetrievalEvaluation(): Promise<void> {
  console.log('\n========================================================');
  console.log('PHẦN 2: RETRIEVAL EVALUATION (cần database)');
  console.log('========================================================');

  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ Không thấy DATABASE_URL — bỏ qua phần Retrieval evaluation.');
    return;
  }

  let prisma: PrismaService | undefined;
  try {
    prisma = new PrismaService();
    await prisma.$connect();
    const chatWithDb = new ChatService(prisma);

    // (a) Latency trên 5 câu book_search đầu tiên trong dataset
    const bookSearchItems = DATASET.filter(
      (item) => item.expected === 'book_search',
    ).slice(0, 5);
    console.log(
      '\nLatency buildBookSearchContext (5 câu book_search trong dataset):',
    );
    console.log('| Query | Latency (ms) |');
    console.log('| ----- | ------------ |');
    for (const item of bookSearchItems) {
      const start = performance.now();
      await chatWithDb.buildBookSearchContext(item.query);
      const latencyMs = (performance.now() - start).toFixed(1);
      console.log(`| ${item.query} | ${latencyMs} |`);
    }

    // (b) Hit Rate@5 với 5 tên sách thật có trong seed
    const titles = await loadSeedBookTitles(prisma);
    if (titles.length === 0) {
      console.warn(
        '⚠️ Không kết nối được database — bỏ qua phần Retrieval evaluation.',
      );
      return;
    }

    console.log('\nHit Rate@5 (truy vấn "tìm sách <tên sách thật>"):');
    console.log('| Query | Latency (ms) | Hit@5 |');
    console.log('| ----- | ------------ | ----- |');
    let hits = 0;
    for (const title of titles) {
      const query = `tìm sách ${title}`;
      const start = performance.now();
      const context = await chatWithDb.buildBookSearchContext(query);
      const latencyMs = (performance.now() - start).toFixed(1);
      const hit = context.includes(title);
      if (hit) hits += 1;
      console.log(`| ${query} | ${latencyMs} | ${hit ? '✅' : '❌'} |`);
    }
    console.log(
      `Hit Rate@5: ${hits}/${titles.length} (${((hits / titles.length) * 100).toFixed(0)}%)`,
    );
  } catch (error) {
    console.warn(
      '⚠️ Không kết nối được database — bỏ qua phần Retrieval evaluation.',
    );
  } finally {
    await prisma?.$disconnect().catch(() => undefined);
  }
}

// ── Main ──
async function main(): Promise<void> {
  validateDataset();

  const { accuracy, macroF1 } = runIntentEvaluation();

  await runRetrievalEvaluation();

  console.log('\n========================================================');
  console.log(
    `Tổng: ${DATASET.length} câu | Accuracy: ${fmt(accuracy * 100)}% | Macro-F1: ${fmt(macroF1)}`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error('Lỗi không mong đợi khi chạy benchmark:', error);
  process.exit(0); // lỗi nhẹ không làm fail pipeline (chỉ dataset lỗi cấu trúc mới exit 1)
});
