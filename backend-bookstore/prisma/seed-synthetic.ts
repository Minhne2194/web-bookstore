/**
 * Seed Synthetic Data Script
 *
 * Tạo dữ liệu tổng hợp cho:
 *   - Users (fake, ~500)
 *   - Orders + OrderItems (10,000+)
 *   - Reviews (50,000+)
 *   - UserBehaviorEvents (200,000+)
 *
 * Yêu cầu: Đã chạy `catalog:seed` để có sách trong DB trước.
 * Chạy:  npx ts-node prisma/seed-synthetic.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import 'dotenv/config';
import { createPgPool } from '../src/prisma/create-pg-pool';

// ──────────────────────── DB Connection ────────────────────────

const pool = createPgPool();
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ──────────────────────── Config ────────────────────────

const CONFIG = {
  FAKE_USER_COUNT: 500,
  ORDER_COUNT: 10_000,
  REVIEW_COUNT: 50_000,
  EVENT_COUNT: 200_000,
  BATCH_SIZE: 500,
  ORDER_DAYS_SPREAD: 180,
  EVENT_DAYS_SPREAD: 90,
};

// ──────────────────────── Vietnamese Data ────────────────────────

const VI_LAST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ',
  'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Mai',
  'Trịnh', 'Đoàn', 'La', 'Tạ', 'Tô', 'Đàm', 'Lưu', 'Tăng',
];

const VI_MIDDLE_NAMES = [
  'Văn', 'Thị', 'Minh', 'Thanh', 'Ngọc', 'Hữu', 'Đức', 'Quang',
  'Thế', 'Hải', 'Xuân', 'Hồng', 'Kim', 'Anh', 'Bích', 'Diệu',
  'Cẩm', 'Thúy', 'Mỹ', 'Tuyết', 'Hoài', 'Thu', 'Hạ', 'Đông',
];

const VI_FIRST_NAMES_MALE = [
  'An', 'Bảo', 'Bình', 'Cường', 'Dũng', 'Dương', 'Đạt', 'Đức',
  'Giang', 'Hà', 'Hải', 'Hiếu', 'Hoàng', 'Hùng', 'Huy', 'Khánh',
  'Khoa', 'Lâm', 'Long', 'Luân', 'Mạnh', 'Minh', 'Nam', 'Nghĩa',
  'Phong', 'Phúc', 'Quân', 'Quang', 'Quý', 'Sơn', 'Tài', 'Thắng',
  'Thành', 'Thịnh', 'Tiến', 'Trung', 'Tuấn', 'Tùng', 'Việt', 'Vinh',
];

const VI_FIRST_NAMES_FEMALE = [
  'Anh', 'Châu', 'Chi', 'Diệp', 'Dung', 'Giang', 'Hà', 'Hạnh',
  'Hoa', 'Hồng', 'Hương', 'Khánh', 'Lan', 'Linh', 'Ly', 'Mai',
  'My', 'Na', 'Nga', 'Ngân', 'Ngọc', 'Nhi', 'Oanh', 'Phương',
  'Quỳnh', 'Thảo', 'Thanh', 'Thúy', 'Thương', 'Trang', 'Trâm', 'Tú',
  'Vân', 'Vy', 'Xuân', 'Yến',
];

const VI_CITIES: Array<{ province: string; districts: string[] }> = [
  { province: 'TP. Hồ Chí Minh', districts: ['Quận 1', 'Quận 3', 'Quận 5', 'Quận 7', 'Quận 10', 'Quận Bình Thạnh', 'Quận Gò Vấp', 'Quận Tân Bình', 'Quận Phú Nhuận', 'TP. Thủ Đức'] },
  { province: 'Hà Nội', districts: ['Quận Ba Đình', 'Quận Hoàn Kiếm', 'Quận Đống Đa', 'Quận Cầu Giấy', 'Quận Thanh Xuân', 'Quận Hoàng Mai', 'Quận Long Biên', 'Quận Hà Đông'] },
  { province: 'Đà Nẵng', districts: ['Quận Hải Châu', 'Quận Thanh Khê', 'Quận Sơn Trà', 'Quận Ngũ Hành Sơn', 'Quận Liên Chiểu', 'Quận Cẩm Lệ'] },
  { province: 'Cần Thơ', districts: ['Quận Ninh Kiều', 'Quận Bình Thủy', 'Quận Cái Răng', 'Quận Ô Môn'] },
  { province: 'Hải Phòng', districts: ['Quận Hồng Bàng', 'Quận Lê Chân', 'Quận Ngô Quyền', 'Quận Kiến An'] },
  { province: 'Bình Dương', districts: ['TP. Thủ Dầu Một', 'TP. Dĩ An', 'TP. Thuận An', 'Huyện Bến Cát'] },
  { province: 'Đồng Nai', districts: ['TP. Biên Hòa', 'TP. Long Khánh', 'Huyện Nhơn Trạch', 'Huyện Trảng Bom'] },
  { province: 'Khánh Hòa', districts: ['TP. Nha Trang', 'TP. Cam Ranh', 'Huyện Diên Khánh'] },
];

const VI_STREET_PREFIXES = ['Đường', 'Phố', 'Hẻm', 'Ngõ', 'Đại lộ', 'Xa lộ'];

const VI_STREET_NAMES = [
  'Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Hai Bà Trưng',
  'Lý Thường Kiệt', 'Nguyễn Trãi', 'Quang Trung', 'Phan Chu Trinh',
  'Hoàng Diệu', 'Điện Biên Phủ', 'Cách Mạng Tháng Tám', 'Võ Văn Tần',
  'Nguyễn Đình Chiểu', 'Phạm Ngũ Lão', 'Bùi Viện', 'Đề Thám',
  'Trường Sa', 'Hoàng Sa', 'Nguyễn Văn Trỗi', 'Nam Kỳ Khởi Nghĩa',
  'Lê Văn Sỹ', 'Phan Xích Long', 'Nguyễn Kiệm', 'Phạm Văn Đồng',
];

// ──────────────────────── Vietnamese Review Templates ────────────────────────

const REVIEW_TITLES_POSITIVE = [
  'Sách rất hay!', 'Đáng mua', 'Tuyệt vời', 'Rất hài lòng',
  'Xuất sắc', 'Đọc không thể bỏ xuống', 'Sách chất lượng cao',
  'Rất đáng tiền', 'Mua ngay kẻo hết', 'Quá tuyệt!',
  'Hay hơn mong đợi', 'Đọc say mê', 'Sách đẹp, nội dung hay',
  'Đóng gói cẩn thận', 'Giao hàng nhanh, sách đẹp',
];

const REVIEW_TITLES_NEUTRAL = [
  'Tạm ổn', 'Bình thường', 'Ổn', 'Cũng được',
  'Không tệ', 'Đọc giải trí cũng được', 'Trung bình',
];

const REVIEW_TITLES_NEGATIVE = [
  'Không hay lắm', 'Thất vọng', 'Không như mong đợi',
  'Chất lượng kém', 'Sách bị lỗi', 'Không đáng tiền',
  'Nội dung nhạt', 'Dịch không tốt',
];

const REVIEW_BODIES_5_STAR = [
  'Sách rất hay, nội dung sâu sắc và bổ ích. Mình đã học được rất nhiều điều từ cuốn sách này. Bìa sách đẹp, giấy in chất lượng cao, chữ rõ ràng dễ đọc. Rất đáng để mua và giữ trong tủ sách.',
  'Một cuốn sách tuyệt vời! Tác giả viết rất cuốn hút, mình đọc một mạch không dừng lại được. Nội dung được trình bày logic, dễ hiểu. Giao hàng nhanh, đóng gói cẩn thận.',
  'Đây là một trong những cuốn sách hay nhất mình từng đọc. Kiến thức trong sách rất thực tế và áp dụng được ngay. Sách được in ấn đẹp, không bị lỗi trang. Rất hài lòng!',
  'Sách đẹp từ bìa đến nội dung. Dịch thuật tốt, văn phong mượt mà. Mình rất thích cách trình bày của cuốn sách này. Mua về làm quà tặng cũng rất ý nghĩa.',
  'Quá xuất sắc! Nội dung chất lượng, giấy in đẹp, bìa cứng cáp. Giao hàng siêu nhanh, sách còn nguyên seal. Rất đáng đồng tiền bát gạo.',
  'Mình đã đọc rất nhiều sách cùng chủ đề nhưng cuốn này thực sự nổi bật. Cách viết dễ hiểu, nhiều ví dụ minh họa thực tế. Sẽ mua thêm các cuốn khác của tác giả.',
];

const REVIEW_BODIES_4_STAR = [
  'Sách khá hay, nội dung bổ ích. Tuy nhiên có một vài chỗ dịch chưa được mượt lắm. Nhìn chung vẫn đáng đọc và đáng mua.',
  'Nội dung tốt, trình bày đẹp. Giao hàng hơi chậm một chút nhưng sách vẫn còn nguyên vẹn. Sẽ ủng hộ thêm.',
  'Sách rất hữu ích, nhiều kiến thức hay. Chỉ tiếc là bìa sách hơi mỏng, dễ bị cong. Hy vọng nhà xuất bản cải thiện.',
  'Đọc rất thú vị, nhiều thông tin mới mẻ. Điểm trừ nhỏ là chữ hơi nhỏ với mình. Nội dung thì khỏi bàn, rất chất lượng.',
  'Sách hay, đóng gói cẩn thận. Chỉ là giá hơi cao so với mặt bằng chung. Nhưng bù lại chất lượng nội dung rất tốt.',
];

const REVIEW_BODIES_3_STAR = [
  'Sách ở mức trung bình, nội dung không có gì đặc sắc. Đọc để giải trí thì được chứ không có nhiều kiến thức mới.',
  'Tạm ổn. Sách in đẹp nhưng nội dung hơi lan man, không tập trung vào chủ đề chính. Có thể đọc tham khảo.',
  'Nội dung cũng được, nhưng cách trình bày chưa thực sự cuốn hút. Mình phải cố gắng lắm mới đọc hết.',
  'Sách bình thường, không có gì nổi bật. Giá này thì có thể tìm được cuốn khác hay hơn.',
];

const REVIEW_BODIES_2_STAR = [
  'Khá thất vọng với cuốn sách này. Nội dung không như mô tả, nhiều chỗ lan man, thiếu chiều sâu.',
  'Sách bị lỗi ở một số trang, chữ in bị mờ. Nội dung cũng không được như kỳ vọng.',
  'Không hay như quảng cáo. Dịch thuật kém, nhiều câu tối nghĩa. Bìa sách cũng bị trầy xước.',
  'Chất lượng giấy kém, chữ in không sắc nét. Nội dung cũng không có gì mới.',
];

const REVIEW_BODIES_1_STAR = [
  'Rất thất vọng! Sách đến tay đã bị rách bìa, gáy sách bị gãy. Nội dung cũng không có giá trị. Yêu cầu đổi trả.',
  'Tệ! In ấn kém chất lượng, nhiều trang bị thiếu chữ. Nội dung sơ sài, không đáng một phần giá tiền.',
  'Không khuyến khích mua. Sách như hàng tồn kho, cũ và bẩn. Nội dung lỗi thời, không còn phù hợp.',
];

// ──────────────────────── Helpers ────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPicks<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

function generateOrderCode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${ts}-${rand}`;
}

function generateVietnameseName(): string {
  const lastName = randomPick(VI_LAST_NAMES);
  const middleName = randomPick(VI_MIDDLE_NAMES);
  const isFemale =
    middleName === 'Thị' ||
    [
      'Anh', 'Châu', 'Hoa', 'Hồng', 'Lan', 'Ly', 'Mai',
      'Nga', 'Ngọc', 'Nhi', 'Phương', 'Thảo', 'Thúy', 'Vy', 'Yến',
    ].includes(middleName);
  const firstNames = isFemale ? VI_FIRST_NAMES_FEMALE : VI_FIRST_NAMES_MALE;
  const firstName = randomPick(firstNames);
  return `${lastName} ${middleName} ${firstName}`;
}

function generateVietnamesePhone(): string {
  const prefixes = [
    '086', '096', '097', '098', '090', '093', '091', '094',
    '088', '039', '038', '037', '036', '035', '034', '033', '032',
  ];
  const prefix = randomPick(prefixes);
  const suffix = String(randomInt(0, 99_999_999)).padStart(7, '0');
  return `${prefix}${suffix}`;
}

function generateShippingAddress(
  receiverName: string,
  phone: string,
): Record<string, unknown> {
  const city = randomPick(VI_CITIES);
  const district = randomPick(city.districts);
  const streetPrefix = randomPick(VI_STREET_PREFIXES);
  const streetName = randomPick(VI_STREET_NAMES);
  const streetNumber = randomInt(1, 999);

  return {
    receiver_name: receiverName,
    phone,
    province: city.province,
    district,
    ward: `Phường ${randomInt(1, 28)}`,
    street: `${streetNumber} ${streetPrefix} ${streetName}`,
  };
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

function getReviewContent(rating: number): { title: string; body: string } {
  switch (rating) {
    case 5:
      return {
        title: randomPick(REVIEW_TITLES_POSITIVE),
        body: randomPick(REVIEW_BODIES_5_STAR),
      };
    case 4:
      return {
        title: randomPick(REVIEW_TITLES_POSITIVE),
        body: randomPick(REVIEW_BODIES_4_STAR),
      };
    case 3:
      return {
        title: randomPick(REVIEW_TITLES_NEUTRAL),
        body: randomPick(REVIEW_BODIES_3_STAR),
      };
    case 2:
      return {
        title: randomPick(REVIEW_TITLES_NEGATIVE),
        body: randomPick(REVIEW_BODIES_2_STAR),
      };
    default:
      return {
        title: randomPick(REVIEW_TITLES_NEGATIVE),
        body: randomPick(REVIEW_BODIES_1_STAR),
      };
  }
}

// ──────────────────────── Main ────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  SEED SYNTHETIC DATA');
  console.log('═══════════════════════════════════════════');

  // ─── 1. Fetch existing books and users ───
  console.log('[1/6] Fetching existing books & users from DB...');

  const existingBooks = await prisma.book.findMany({
    select: { book_id: true, title: true, price: true },
  });
  const existingUsers = await prisma.user.findMany({
    select: { user_id: true, email: true, full_name: true },
  });

  console.log(`  • Books: ${existingBooks.length}`);
  console.log(`  • Users: ${existingUsers.length}`);

  if (existingBooks.length === 0) {
    console.error('❌ No books found in DB. Run catalog:seed first!');
    process.exit(1);
  }

  // ─── 2. Generate fake users ───
  console.log(`
[2/6] Generating up to ${CONFIG.FAKE_USER_COUNT} fake users...`);

  let allUsers = [...existingUsers];
  const neededUsers = Math.max(0, CONFIG.FAKE_USER_COUNT - existingUsers.length);

  if (neededUsers > 0) {
    const passwordHash = await argon2.hash('password123');

    for (
      let batch = 0;
      batch < Math.ceil(neededUsers / CONFIG.BATCH_SIZE);
      batch++
    ) {
      const batchSize = Math.min(
        CONFIG.BATCH_SIZE,
        neededUsers - batch * CONFIG.BATCH_SIZE,
      );

      const userRecords: Array<{
        email: string;
        password_hash: string;
        full_name: string;
        phone: string;
        role: 'customer' | 'admin';
        status: 'active';
        email_verified: boolean;
        last_login_at: Date;
      }> = [];

      for (let i = 0; i < batchSize; i++) {
        const fullName = generateVietnameseName();
        const email = faker.internet
          .email({ firstName: fullName })
          .toLowerCase();
        userRecords.push({
          email,
          password_hash: passwordHash,
          full_name: fullName,
          phone: generateVietnamesePhone(),
          role: weightedRandom(
            ['customer', 'admin'] as const,
            [95, 5],
          ),
          status: 'active',
          email_verified: true,
          last_login_at: randomDate(30),
        });
      }

      await prisma.user.createMany({ data: userRecords });

      // Fetch newly created users to add to allUsers
      const created = await prisma.user.findMany({
        where: { email: { in: userRecords.map((u) => u.email) } },
        select: { user_id: true, email: true, full_name: true },
      });
      allUsers.push(...created);
    }

    console.log(`  • Created ~${neededUsers} new users`);
  }

  console.log(`  • Total users available: ${allUsers.length}`);

  // ─── 3. Generate Orders ───
  console.log(`
[3/6] Generating ${CONFIG.ORDER_COUNT} orders...`);

  const userIds = allUsers.map((u) => u.user_id);
  const bookIds = existingBooks.map((b) => b.book_id);

  // Track delivered items for review generation
  const deliveredItems: Array<{
    order_id: string;
    user_id: string;
    book_id: string;
  }> = [];

  const orderStatuses = [
    'pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'refunded',
  ] as const;
  const orderStatusWeights = [5, 10, 20, 55, 5, 5];

  const paymentMethods = [
    'cod', 'bank_transfer', 'momo', 'vnpay', 'payos',
  ] as const;
  const paymentMethodWeights = [35, 30, 15, 10, 10];

  for (
    let batch = 0;
    batch < Math.ceil(CONFIG.ORDER_COUNT / CONFIG.BATCH_SIZE);
    batch++
  ) {
    const batchSize = Math.min(
      CONFIG.BATCH_SIZE,
      CONFIG.ORDER_COUNT - batch * CONFIG.BATCH_SIZE,
    );

    const ordersData: Array<{
      order_code: string;
      user_id: string;
      status: (typeof orderStatuses)[number];
      subtotal: number;
      discount_amount: number;
      shipping_fee: number;
      total_amount: number;
      payment_method: (typeof paymentMethods)[number];
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
      shipping_address: any;
      note: string | null;
      created_at: Date;
      updated_at: Date;
    }> = [];

    // Map: order_code → items
    const itemsByOrderCode = new Map<
      string,
      Array<{
        book_id: string;
        quantity: number;
        unit_price: number;
        discount: number;
      }>
    >();

    const batchOrderCodes: string[] = [];

    for (let i = 0; i < batchSize; i++) {
      const orderCode = generateOrderCode();
      const userId = randomPick(userIds);
      const user = allUsers.find((u) => u.user_id === userId);
      const userName = user?.full_name ?? 'Khách hàng';
      const userPhone = generateVietnamesePhone();

      const status = weightedRandom([...orderStatuses], orderStatusWeights);
      const paymentMethod = weightedRandom(
        [...paymentMethods],
        paymentMethodWeights,
      );
      const orderDate = randomDate(CONFIG.ORDER_DAYS_SPREAD);

      let paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' = 'pending';
      if (status === 'delivered') {
        paymentStatus = 'paid';
      } else if (status === 'shipping') {
        paymentStatus = paymentMethod === 'cod' ? 'pending' : 'paid';
      } else if (status === 'cancelled') {
        paymentStatus = 'failed';
      } else if (status === 'refunded') {
        paymentStatus = 'refunded';
      }

      // 1-5 items per order
      const itemCount = randomInt(1, 5);
      const pickedBooks = randomPicks(bookIds, itemCount);
      const shippingAddress = generateShippingAddress(userName, userPhone);

      let subtotal = 0;
      const items: typeof itemsByOrderCode extends Map<
        string,
        infer T
      >
        ? T
        : never = [];

      for (const bookId of pickedBooks) {
        const book = existingBooks.find((b) => b.book_id === bookId);
        const unitPrice = book
          ? Number(book.price)
          : randomInt(50_000, 500_000);
        const quantity = randomInt(1, 3);
        const discount =
          Math.random() < 0.2
            ? Math.round((unitPrice * quantity * randomInt(5, 20)) / 100)
            : 0;

        subtotal += unitPrice * quantity;

        items.push({
          book_id: bookId,
          quantity,
          unit_price: unitPrice,
          discount,
        });
      }

      const shippingFee =
        subtotal > 300_000 ? 0 : randomInt(15_000, 40_000);
      const discountAmount =
        Math.random() < 0.15
          ? Math.round((subtotal * randomInt(5, 15)) / 100)
          : 0;
      const totalAmount = subtotal - discountAmount + shippingFee;

      ordersData.push({
        order_code: orderCode,
        user_id: userId,
        status,
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        shipping_address: shippingAddress,
        note: Math.random() < 0.1 ? faker.lorem.sentence() : null,
        created_at: orderDate,
        updated_at: orderDate,
      });

      itemsByOrderCode.set(orderCode, items);
      batchOrderCodes.push(orderCode);

      // Track delivered items for review generation
      if (status === 'delivered') {
        for (const item of items) {
          deliveredItems.push({
            order_id: orderCode,
            user_id: userId,
            book_id: item.book_id,
          });
        }
      }
    }

    // Insert orders
    await prisma.order.createMany({ data: ordersData });

    // Fetch inserted orders to get real IDs
    const insertedOrders = await prisma.order.findMany({
      where: { order_code: { in: batchOrderCodes } },
      select: { order_id: true, order_code: true },
    });

    const codeToId = new Map(
      insertedOrders.map((o) => [o.order_code, o.order_id]),
    );

    // Insert order items with real order IDs
    const allOrderItems: Array<{
      order_id: string;
      book_id: string;
      quantity: number;
      unit_price: number;
      discount: number;
    }> = [];

    for (const [code, items] of itemsByOrderCode) {
      const realOrderId = codeToId.get(code);
      if (!realOrderId) continue;
      for (const item of items) {
        allOrderItems.push({ ...item, order_id: realOrderId });
      }
    }

    await prisma.orderItem.createMany({ data: allOrderItems });

    // Resolve delivered item order IDs
    for (const di of deliveredItems) {
      const realId = codeToId.get(di.order_id);
      if (realId) di.order_id = realId;
    }

    console.log(`  • Batch ${batch + 1}: ${batchSize} orders`);
  }

  console.log(`  • Total delivered items: ${deliveredItems.length}`);

  // ─── 4. Generate Reviews ───
  console.log(`
[4/6] Generating ${CONFIG.REVIEW_COUNT} reviews...`);

  const usedKeys = new Set<string>();

  // Part A: Verified purchase reviews (~35%)
  const verifiedTarget = Math.min(
    deliveredItems.length,
    Math.floor(CONFIG.REVIEW_COUNT * 0.35),
  );
  const shuffledDelivered = deliveredItems.sort(
    () => Math.random() - 0.5,
  );
  const selectedForReview = shuffledDelivered.slice(0, verifiedTarget);

  for (
    let batch = 0;
    batch < Math.ceil(selectedForReview.length / CONFIG.BATCH_SIZE);
    batch++
  ) {
    const batchItems = selectedForReview.slice(
      batch * CONFIG.BATCH_SIZE,
      (batch + 1) * CONFIG.BATCH_SIZE,
    );

    const reviews: Array<{
      book_id: string;
      user_id: string;
      order_id: string;
      rating: number;
      title: string;
      body: string;
      status: 'approved' | 'pending' | 'rejected';
      helpful_count: number;
      created_at: Date;
    }> = [];

    for (const item of batchItems) {
      const key = `${item.user_id}|${item.book_id}|${item.order_id}`;
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);

      const rating = weightedRandom([5, 4, 3, 2, 1], [40, 30, 15, 10, 5]);
      const content = getReviewContent(rating);
      const status = weightedRandom(
        ['approved', 'pending', 'rejected'] as const,
        [90, 8, 2],
      );

      reviews.push({
        book_id: item.book_id,
        user_id: item.user_id,
        order_id: item.order_id,
        rating,
        title: content.title,
        body: content.body,
        status,
        helpful_count: randomInt(0, rating >= 4 ? 50 : 5),
        created_at: randomDate(CONFIG.ORDER_DAYS_SPREAD),
      });
    }

    if (reviews.length > 0) {
      await prisma.review.createMany({ data: reviews });
    }
  }

  console.log(`  • Verified reviews: ${selectedForReview.length}`);

  // Part B: Reviews without order link (~65%)
  const unlinkedTarget = CONFIG.REVIEW_COUNT - selectedForReview.length;

  for (
    let batch = 0;
    batch < Math.ceil(unlinkedTarget / CONFIG.BATCH_SIZE);
    batch++
  ) {
    const batchSize = Math.min(
      CONFIG.BATCH_SIZE,
      unlinkedTarget - batch * CONFIG.BATCH_SIZE,
    );

    const reviews: Array<{
      book_id: string;
      user_id: string;
      rating: number;
      title: string;
      body: string;
      status: 'approved' | 'pending' | 'rejected';
      helpful_count: number;
      created_at: Date;
    }> = [];

    for (let i = 0; i < batchSize; i++) {
      const bookId = randomPick(bookIds);
      const userId = randomPick(userIds);
      const key = `${userId}|${bookId}|nolink`;
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);

      const rating = weightedRandom([5, 4, 3, 2, 1], [35, 35, 15, 10, 5]);
      const content = getReviewContent(rating);
      const status = weightedRandom(
        ['approved', 'pending', 'rejected'] as const,
        [90, 8, 2],
      );

      reviews.push({
        book_id: bookId,
        user_id: userId,
        rating,
        title: content.title,
        body: content.body,
        status,
        helpful_count: randomInt(0, rating >= 4 ? 40 : 5),
        created_at: randomDate(365),
      });
    }

    if (reviews.length > 0) {
      await prisma.review.createMany({ data: reviews });
    }

    if ((batch + 1) % 20 === 0) {
      console.log(
        `  • Unlinked batch ${batch + 1}: ~${(batch + 1) * CONFIG.BATCH_SIZE} reviews`,
      );
    }
  }

  console.log(`  • Total reviews: ${usedKeys.size}`);

  // ─── 5. Update book rating stats ───
  console.log('[5/6] Updating book avg_rating & rating_count...');

  const allBooks = await prisma.book.findMany({
    select: { book_id: true },
  });

  for (let i = 0; i < allBooks.length; i += 100) {
    const chunk = allBooks.slice(i, i + 100);
    for (const book of chunk) {
      const stats = await prisma.review.aggregate({
        where: { book_id: book.book_id, status: 'approved' },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.book.update({
        where: { book_id: book.book_id },
        data: {
          avg_rating: stats._avg.rating ?? 0,
          rating_count: stats._count.rating,
        },
      });
    }
  }

  console.log('  • Book ratings updated');

  // ─── 6. Generate UserBehaviorEvents ───
  console.log(`
[6/6] Generating ${CONFIG.EVENT_COUNT} events...`);

  const eventTypes = [
    'view', 'add_to_cart', 'wishlist', 'purchase', 'search',
  ] as const;
  const eventWeights = [55, 12, 10, 8, 15];

  const searchQueries = [
    'sách kinh tế', 'tiểu thuyết', 'sách thiếu nhi', 'sách kỹ năng sống',
    'truyện tranh', 'sách học ngoại ngữ', 'sách văn học', 'sách khoa học',
    'manga', 'sách nấu ăn', 'sách lập trình', 'sách lịch sử',
    'sách tâm lý', 'sách kinh doanh', 'sách marketing',
  ];

  for (
    let batch = 0;
    batch < Math.ceil(CONFIG.EVENT_COUNT / CONFIG.BATCH_SIZE);
    batch++
  ) {
    const batchSize = Math.min(
      CONFIG.BATCH_SIZE,
      CONFIG.EVENT_COUNT - batch * CONFIG.BATCH_SIZE,
    );

    const events: Array<{
      user_id: string | null;
      session_id: string;
      event_type: (typeof eventTypes)[number];
      book_id: string | null;
      search_query: string | null;
      duration_sec: number | null;
      metadata: any;
      created_at: Date;
    }> = [];

    for (let i = 0; i < batchSize; i++) {
      const eventType = weightedRandom([...eventTypes], eventWeights);
      const isAnonymous = Math.random() < 0.3;
      const userId = isAnonymous ? null : randomPick(userIds);
      const sessionId = crypto.randomUUID();
      const eventDate = randomDate(CONFIG.EVENT_DAYS_SPREAD);
      const bookId =
        eventType === 'search' ? null : randomPick(bookIds);
      const searchQuery =
        eventType === 'search' ? randomPick(searchQueries) : null;
      const durationSec =
        eventType === 'view' ? randomInt(5, 600) : null;

      events.push({
        user_id: userId,
        session_id: sessionId,
        event_type: eventType,
        book_id: bookId,
        search_query: searchQuery,
        duration_sec: durationSec,
        metadata: {
          source: weightedRandom(
            ['direct', 'search', 'social', 'email'],
            [60, 30, 7, 3],
          ),
          device: weightedRandom(
            ['mobile', 'desktop', 'tablet'],
            [65, 30, 5],
          ),
        },
        created_at: eventDate,
      });
    }

    await prisma.userBehaviorEvent.createMany({ data: events });

    if ((batch + 1) % 20 === 0) {
      console.log(
        `  • Batch ${batch + 1}: ~${(batch + 1) * CONFIG.BATCH_SIZE} events`,
      );
    }
  }

  console.log(`  • Total events: ${CONFIG.EVENT_COUNT}`);

  // ─── Done ───
  console.log('═══════════════════════════════════════════');
  console.log('  ✅ SEED SYNTHETIC DATA COMPLETE');
  console.log('═══════════════════════════════════════════');

  const final = {
    users: await prisma.user.count(),
    books: await prisma.book.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    reviews: await prisma.review.count(),
    events: await prisma.userBehaviorEvent.count(),
  };

  console.log('📊 Final counts:');
  console.log(`   Users:           ${final.users}`);
  console.log(`   Books:           ${final.books}`);
  console.log(`   Orders:          ${final.orders}`);
  console.log(`   Order Items:     ${final.orderItems}`);
  console.log(`   Reviews:         ${final.reviews}`);
  console.log(`   Behavior Events: ${final.events}`);
  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
