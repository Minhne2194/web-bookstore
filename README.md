# 📚 Hệ Thống Bán Sách Trực Tuyến — E-commerce Book Store

Đồ án xây dựng website thương mại điện tử chuyên về sách, cho phép người dùng tìm kiếm, mua sách trực tuyến và quản lý đơn hàng. Hệ thống cung cấp phân hệ khách hàng (storefront) và phân hệ quản trị viên (admin panel).

> 🌐 **Bản đang chạy thật**
> - Frontend (Vercel): **https://frontend-bookstore.vercel.app**
> - Backend API (Render): **https://bookstore-api-xquk.onrender.com** — health check `/health`
> - Tài khoản demo: `admin@bookstore.com` / `admin123` · `customer@bookstore.com` / `customer123`
>
> ⏳ Backend dùng Render free nên **ngủ sau 15 phút** không có request; lần truy cập đầu có thể chậm 30–50 giây (UptimeRobot ping `/health` mỗi 5 phút để giữ ấm).

---

## ⚡ Chạy Nhanh (1 Lệnh)

Từ **thư mục gốc** của dự án, chọn 1 trong 2 cách:

### Cách A — Chạy bằng Node (cần PostgreSQL / Redis / Elasticsearch chạy sẵn)

```bash
npm install && npm run dev
```

`npm install` ở root sẽ tự cài dependencies cho cả `backend-bookstore` và `frontend-bookstore` (qua `postinstall`). `npm run dev` chạy song song backend (`http://localhost:3000`) và frontend (`http://localhost:5173`).

> Cần hạ tầng đang chạy trước: PostgreSQL `5433`, Redis `6379`, Elasticsearch `9200`. Nếu chưa có, khởi động bằng Docker:
> ```bash
> docker compose up -d postgres redis elasticsearch
> ```
> (Chỉ 3 service hạ tầng. Nếu chạy `npm run docker:up` / `docker compose up -d` **không kèm tên service** thì Docker sẽ dựng cả backend + frontend trong container — xem Cách B.)
> Và cần có `backend-bookstore/.env` (xem [Biến Môi Trường](#5-biến-môi-trường)).

### Cách B — Chạy toàn bộ bằng Docker (không cần cài Node)

```bash
docker compose up --build
```

Lệnh này dựng **toàn bộ stack** trong container:

| Service | Địa chỉ | Ghi chú |
|---|---|---|
| `postgres` | `localhost:5433` | PostgreSQL 16-alpine |
| `redis` | `localhost:6379` | Redis 7-alpine |
| `elasticsearch` | `localhost:9200` | ES 8.13.0, single-node, security off |
| `backend` | `localhost:3000` | NestJS API (build từ `backend-bookstore/Dockerfile`) |
| `frontend` | `localhost:5173` | React build → phục vụ qua nginx (port 80 trong container) |

Biến môi trường cho container backend được inject trực tiếp trong `docker-compose.yml` (`DATABASE_URL`, `REDIS_HOST`, `ELASTICSEARCH_NODE`, `FRONTEND_URL`, `PORT`, `DEEPSEEK_API_KEY`). Có thể override bằng biến shell, ví dụ: `DEEPSEEK_API_KEY=sk-... docker compose up --build`.

> Chạy nền: thêm `-d`. Xem log: `docker compose logs -f backend`.
>
> ℹ️ `frontend-bookstore/Dockerfile` build tĩnh rồi phục vụ bằng nginx và **không** truyền build arg `VITE_API_URL`, nên bundle trong image dùng giá trị mặc định `http://localhost:3000` (đúng khi chạy local vì browser gọi vào port backend đã expose). Muốn trỏ domain khác thì thêm build arg cho `VITE_API_URL` hoặc dùng Cách A.

---

## 📋 Mục Lục

- [Chạy Nhanh](#-chạy-nhanh-1-lệnh)
- [Tổng Quan](#-tổng-quan)
- [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
- [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
- [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Hướng Dẫn Cài Đặt](#-hướng-dẫn-cài-đặt)
- [Chạy Ứng Dụng](#-chạy-ứng-dụng)
- [Tính Năng](#-tính-năng)
- [API Endpoints](#-api-endpoints)
- [Cơ Sở Dữ Liệu](#-cơ-sở-dữ-liệu)
- [Thanh Toán Online](#-thanh-toán-online)
- [Scripts](#-scripts-hữu-ích)
- [Validation & Xử Lý Lỗi](#-validation--xử-lý-lỗi)
- [Đánh Giá AI](#-đánh-giá-ai-benchmark)
- [CI/CD & Triển Khai](#-cicd--triển-khai)
- [Kiểm Thử](#-kiểm-thử-testing)
- [Tác Giả](#-tác-giả)

---

## 🎯 Tổng Quan

| Thông tin | Chi tiết |
|---|---|
| **Tên đồ án** | Hệ thống bán sách trực tuyến |
| **Loại** | Full-stack Web Application |
| **Kiến trúc** | Modular Monolith — Client-Server — RESTful API |
| **Frontend** | React 19 + TypeScript 6.x + Vite 8.x + TailwindCSS 4 |
| **Backend** | NestJS 11 + Prisma ORM + PostgreSQL 17 |
| **Search Engine** | Elasticsearch 8 (với PostgreSQL fallback) |
| **Cache/Session** | Redis 7 (giỏ hàng, session, message queue) — deploy: Redis Cloud free 30MB |
| **AI Chatbot** | DeepSeek AI — trợ lý mua sắm tích hợp |
| **Thanh toán** | COD + **PayOS (VietQR)** — 1 cổng cho cả Momo / VNPay / chuyển khoản |
| **Triển khai** | Frontend **Vercel** · Backend **Render** · PostgreSQL **Render** · Redis **Redis Cloud** |

### Đối tượng sử dụng

- **Khách hàng**: Tìm kiếm, duyệt sách, thêm giỏ hàng, đặt hàng, thanh toán online, nhận gợi ý AI, quản lý tài khoản.
- **Quản trị viên (Admin)**: Dashboard thống kê, quản lý sách/đơn hàng/người dùng/danh mục/tác giả/NXB/mã giảm giá, duyệt đánh giá, reindex dữ liệu tìm kiếm.

---

## 🛠 Công Nghệ Sử Dụng

### Frontend

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| React | 19.x | UI Framework |
| TypeScript | 6.x | Type Safety |
| Vite | 8.x | Build Tool & Dev Server |
| TailwindCSS | 4.x | Utility-first CSS |
| React Router | 7.x | Client-side Routing |
| Lucide React | 1.x | Icon Library |
| Framer Motion | 12.x | Animation |
| canvas-confetti | 1.x | Hiệu ứng confetti |

### Backend

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| NestJS | 11.x | Backend Framework |
| Prisma | 7.x | ORM — Database Access |
| PostgreSQL | 17 | Cơ sở dữ liệu chính |
| Elasticsearch | 8.x | Full-text search engine |
| Redis | 7 | Cache, Giỏ hàng, Message Queue |
| Argon2 | 0.44 | Mã hóa mật khẩu |
| JWT | — | Xác thực người dùng |
| Multer | 2.x | Upload file/ảnh |
| BullMQ | 5.x | Message queue (email) |
| Nodemailer | 8.x | Gửi email (welcome, invoice) |
| Axios | 1.x | HTTP Client (Payment Gateway) |
| Puppeteer | 24.x | Web crawler (Fahasa) |

### Infrastructure

| Công cụ | Vai trò |
|---|---|
| Docker Compose | PostgreSQL + Redis + Elasticsearch containers (local) |
| Prisma Migrate | Database migration |
| Prisma Seed | Dữ liệu mẫu (organic + synthetic) |
| Ethereal | Email test account (dev) |
| **Vercel** | Host frontend (SPA tĩnh), auto-deploy mỗi push |
| **Render** | Host backend (Docker) + PostgreSQL, auto-deploy mỗi push |
| **Redis Cloud** | Redis free 30MB cho deploy (Render không còn Redis free) |
| **UptimeRobot** | Ping `/health` mỗi 5 phút, giữ instance Render free không ngủ |

---

## 🏗 Kiến Trúc Hệ Thống

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT LAYER           [Vercel]        │
│   [React SPA — Vite]           [Admin Dashboard]          │
│   Port: 5173                   Route: /admin/*            │
│   + ChatWidget (DeepSeek AI)                              │
└─────────────┬──────────────────────┬─────────────────────┘
              │        HTTP          │
┌─────────────▼──────────────────────▼─────────────────────┐
│      API SERVER (NestJS — Port 3000)      [Render]        │
│   Auth · Books · Cart · Orders · Payment · Reviews        │
│   Users · Categories · Admin · Upload · Search            │
│   Recommendation · Behavior · Email · Chat               │
└──┬────────────┬──────────────┬───────────────┬───────────┘
   │            │              │               │
┌──▼──────┐ ┌──▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
│PostgreSQL│ │  Redis  │ │Elasticsearch│ │  Uploads   │
│ Port:5433│ │Port:6379│ │ Port:9200  │ │  /uploads   │
│ [Render] │ │[Cloud]  │ │ (local)    │ └─────────────┘
└─────────┘ └─────────┘ └────────────┘

Dịch vụ ngoài: PayOS (tạo VietQR + webhook) · DeepSeek (RAG chatbot) · SMTP (email)
```

> Trên bản deploy Render free **không chạy Elasticsearch** (không đủ RAM) → toàn bộ tìm kiếm dùng nhánh fallback PostgreSQL. Redis trên deploy là **Redis Cloud free 30MB** (`REDIS_HOST/PORT/USERNAME/PASSWORD/TLS`).

---

## 📁 Cấu Trúc Thư Mục

```
Project-BookShop-2026/
│
├── package.json                # Scripts gốc: dev, build, test, ai:evaluate, docker:*
├── docker-compose.yml          # Full stack: PostgreSQL + Redis + Elasticsearch + backend + frontend
├── render.yaml                 # Deploy backend (Docker/Node) + Postgres lên Render
│
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions: backend-test + frontend-build
│
├── backend-bookstore/          # NestJS Backend API
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (16 models)
│   │   ├── migrations/         # SQL migrations
│   │   ├── seed.ts             # Seed catalog từ JSON crawler (organic)
│   │   └── seed-synthetic.ts   # Seed dữ liệu tổng hợp (users/orders/reviews/events)
│   ├── seed-coupon.ts          # Seed mã giảm giá
│   ├── prisma.config.ts        # Cấu hình Prisma 7 (seed command, datasource)
│   ├── src/
│   │   ├── admin/              # Module quản trị (thống kê, CRUD)
│   │   ├── auth/               # JWT authentication + guards
│   │   ├── behavior/           # Tracking hành vi người dùng
│   │   ├── books/              # CRUD sách + tìm kiếm cơ bản
│   │   ├── cart/               # Giỏ hàng (Redis-backed)
│   │   ├── categories/         # Quản lý thể loại sách
│   │   ├── chat/               # AI Chatbot (DeepSeek SSE)
│   │   ├── common/filters/     # AllExceptionsFilter (chuẩn hóa lỗi)
│   │   ├── email/              # Email queue (BullMQ + Nodemailer)
│   │   ├── orders/             # Quy trình đặt hàng
│   │   ├── payment/            # PayOS (VietQR + webhook) + cron hủy đơn quá 15 phút
│   │   ├── prisma/             # Prisma service (singleton)
│   │   ├── recommendation/     # Gợi ý sách cá nhân hóa
│   │   ├── reviews/            # Đánh giá & bình luận
│   │   ├── search/             # Full-text search (Elasticsearch + PG fallback)
│   │   ├── upload/             # Upload ảnh bìa sách
│   │   ├── users/              # Đăng ký, profile, địa chỉ, CRUD
│   │   ├── app.module.ts       # Root module
│   │   └── main.ts             # Bootstrap (CORS, ValidationPipe, ExceptionFilter)
│   ├── test/                   # E2E test (Jest + Supertest)
│   ├── uploads/                # Thư mục lưu ảnh upload
│   ├── scripts/                # Crawler Fahasa + evaluate-ai.ts + sample-catalog.ts (10% cho deploy)
│   ├── Dockerfile              # Image production cho backend
│   ├── docker-compose.yml      # PostgreSQL + Redis + Elasticsearch (backend local dev)
│   ├── package.json
│   ├── .env                    # Biến môi trường (không commit)
│   └── .env.render.txt         # DATABASE_URL của DB Render — dùng khi seed từ local (không commit)
│
├── frontend-bookstore/         # React Frontend SPA
│   ├── src/
│   │   ├── components/         # Header, Footer, Toast, SafeImage, ChatWidget, PromoBanner
│   │   ├── config/api.ts       # API_BASE_URL (đọc VITE_API_URL)
│   │   ├── context/            # AuthContext, CartContext
│   │   ├── pages/              # 12 trang storefront + Admin
│   │   │   ├── Home.tsx        # Trang chủ (PromoBanner, For You, Trending)
│   │   │   ├── Search.tsx      # Tìm kiếm + lọc + facets
│   │   │   ├── BookDetail.tsx  # Chi tiết sách + reviews + sách tương tự
│   │   │   ├── Cart.tsx        # Giỏ hàng + mã giảm giá
│   │   │   ├── Checkout.tsx    # Đặt hàng (COD, bank, MoMo, VNPay → 3 online sinh VietQR PayOS)
│   │   │   ├── PaymentProcess.tsx # Màn QR PayOS: polling 4s + đổi phương thức + hủy đơn
│   │   │   ├── Admin.tsx       # Admin Dashboard (full CRUD + quản lý coupon)
│   │   │   ├── Account.tsx     # Tài khoản cá nhân + lịch sử đơn hàng
│   │   │   ├── Login.tsx       # Đăng nhập
│   │   │   ├── Register.tsx    # Đăng ký
│   │   │   ├── PaymentResult.tsx # Kết quả thanh toán
│   │   │   ├── NewBooks.tsx    # Sách mới
│   │   │   └── BestSellers.tsx # Sách bán chạy
│   │   ├── utils/              # Helpers (orderStatus)
│   │   ├── App.tsx             # Routes + Layout (StoreLayout + ChatWidget)
│   │   └── main.tsx            # Entry point
│   ├── e2e/                    # Playwright system test
│   ├── Dockerfile              # Build + serve bằng nginx
│   ├── vercel.json             # SPA rewrite cho Vercel
│   ├── .env.example            # VITE_API_URL mẫu
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                       # Báo cáo đồ án, biên bản họp
├── .gitignore
└── README.md                   # ← Bản gốc
```

---

## 💻 Yêu Cầu Hệ Thống

| Phần mềm | Phiên bản tối thiểu |
|---|---|
| **Node.js** | 18.x trở lên (khuyến nghị 20+) |
| **npm** | 9.x trở lên |
| **Docker** + **Docker Compose** | Mới nhất |
| **Git** | 2.x |

---

## 🚀 Hướng Dẫn Cài Đặt

### 1. Clone dự án

```bash
git clone <repo-url>
cd Project-BookShop-2026
```

### 2. Khởi động Database (PostgreSQL + Redis + Elasticsearch)

```bash
# Từ thư mục gốc dự án (dùng chung docker-compose)
docker compose up -d
```

Lệnh trên dựng hạ tầng theo `docker-compose.yml` ở **root**:
- **PostgreSQL 16** tại `localhost:5433` (mặc định user `postgres` / password `postgres` / db `bookstore`; override bằng `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`)
- **Redis 7** tại `localhost:6379`
- **Elasticsearch 8.13** tại `localhost:9200`

> `backend-bookstore/docker-compose.yml` là biến thể riêng cho dev backend — **PostgreSQL 17** với user `root` / password `secretpassword` / db `bookstore_db`:
> ```bash
> cd backend-bookstore
> docker compose up -d
> ```
> Chọn file compose nào thì `DATABASE_URL` trong `.env` phải khớp user/password/db của file đó.

### 3. Cấu hình Backend

> 💡 Cài dependencies cho **cả hai** phần từ root chỉ bằng 1 lệnh: `npm install` (root chạy `postinstall` → cài cho `backend-bookstore` và `frontend-bookstore`). Nếu đã làm vậy, có thể bỏ qua bước `npm install` bên dưới.

```bash
cd backend-bookstore

# Cài đặt dependencies
npm install

# Tạo file .env (copy từ mẫu hoặc tạo mới)
# Xem mục "Biến Môi Trường" bên dưới

# Khởi tạo database schema
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# (Tuỳ chọn) Seed catalog sách từ JSON crawler (cần chạy `npm run catalog:fetch` trước
# nếu chưa có scripts/crawler/output/*.json) — 5.263 sách / 2.967 tác giả / 157 danh mục
npm run catalog:seed

# (Tuỳ chọn) Seed dữ liệu tổng hợp: user, đơn, review, behavior event
npm run db:seed:synthetic

# (Tuỳ chọn) Reindex dữ liệu vào Elasticsearch
curl -X POST http://localhost:3000/search/reindex-dev 
  -H "x-dev-secret: dev-reindex-2026"
```

#### Seed dữ liệu — 2 lớp, có tham số

**Lớp 1 — catalog thật (crawler Fahasa):** `backend-bookstore/prisma/seed.ts` đọc JSON trong
`scripts/crawler/output/`, upsert `Category` → `Author` → `Publisher` → `Book` (idempotent, chạy lại
nhiều lần không nhân bản dữ liệu).

```bash
# 1. Cào dữ liệu (Puppeteer, có checkpoint — dừng giữa chừng vẫn tiếp tục được)
npm run catalog:fetch            # 1 trang
npm run catalog:fetch:full       # 10 trang
npm run catalog:refresh          # cào + seed trong 1 lệnh

# 2. Seed vào DB
npm run catalog:seed             # = npx prisma db seed (đọc prisma.config.ts)
```

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SEED_BOOKS_FILE` | `books_seed.json` | File sách nguồn trong `scripts/crawler/output/` |
| `SEED_CATEGORIES_FILE` | `categories_seed.json` | File danh mục nguồn |
| `SAMPLE_PERCENT` | `10` | Tỉ lệ lấy mẫu khi chạy `sample-catalog` |

**Lớp 2 — dữ liệu tổng hợp (faker):** `prisma/seed-synthetic.ts` sinh user, đơn hàng theo
state machine, review có trọng số và behavior event.

```bash
npm run db:seed:synthetic
```

| Biến | Mặc định |
|---|---|
| `SEED_USER_COUNT` | `500` |
| `SEED_ORDER_COUNT` | `10_000` |
| `SEED_REVIEW_COUNT` | `50_000` |
| `SEED_EVENT_COUNT` | `200_000` |

Ví dụ bản nhẹ: `SEED_USER_COUNT=50 SEED_ORDER_COUNT=500 npm run db:seed:synthetic`

**Lớp 3 — bản rút gọn cho deploy:** Render free không đủ chỗ cho full catalog, nên
`scripts/sample-catalog.ts` tạo bộ **10% sách nhưng giữ nguyên toàn bộ danh mục** (chọn mẫu
deterministic theo ISBN, không random).

```bash
npx ts-node scripts/sample-catalog.ts          # → books_seed_10pct.json + categories_seed_10pct.json
SAMPLE_PERCENT=20 npx ts-node scripts/sample-catalog.ts   # đổi tỉ lệ
```

Seed DB Render từ máy local (dùng pattern `.env.render` — file `backend-bookstore/.env.render.txt`
chứa `DATABASE_URL` của Render, **không commit**, đã nằm trong `.gitignore`):

```bash
cd backend-bookstore
SEED_BOOKS_FILE=books_seed_10pct.json \
SEED_CATEGORIES_FILE=categories_seed_10pct.json \
DATABASE_URL="$(grep DATABASE_URL .env.render.txt | cut -d'"' -f2)" \
npm run catalog:seed
```

### 4. Cấu hình Frontend

```bash
cd ../frontend-bookstore

# Cài đặt dependencies
npm install

# Tạo file .env cho frontend (copy từ mẫu)
cp .env.example .env
```

`frontend-bookstore/.env` chỉ có **1 biến**:

```env
VITE_API_URL="http://localhost:3000"
```

- Được đọc tại `frontend-bookstore/src/config/api.ts` → base URL cho toàn bộ request API.
- Không khai báo thì mặc định là `http://localhost:3000`.
- Dấu `/` ở cuối URL tự động được cắt bỏ; khi deploy (VD Vercel) trỏ về domain backend thật.
- Vite chỉ đọc biến `VITE_*` tại thời điểm **build**, nên đổi giá trị phải restart dev server hoặc build lại.

### 5. Biến Môi Trường

Tạo file `backend-bookstore/.env` từ file mẫu:

```bash
cp backend-bookstore/.env.example backend-bookstore/.env
```

Nội dung tham khảo:

```env
# Database
DATABASE_URL="postgresql://root:secretpassword@localhost:5433/bookstore_db?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN_DAYS=7

# Redis
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"

# Elasticsearch
ELASTICSEARCH_NODE="http://localhost:9200"
ELASTICSEARCH_INDEX="books_v1"

# Application
PORT=3000
FRONTEND_URL="http://localhost:5173"
PAYMENT_RESULT_URL="http://localhost:5173/payment/result"
DEV_SECRET="dev-reindex-2026"

# DeepSeek AI Chat (tuỳ chọn)
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-chat"

# SMTP Email (tuỳ chọn — nếu không có sẽ dùng Ethereal test account)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""

# MoMo / VNPay Sandbox (tuỳ chọn — CHỈ dùng cho endpoint legacy /payment/momo/*, /payment/vnpay/*.
# UI hiện tại KHÔNG gọi 2 nhóm này: mọi lựa chọn online đều đi qua PayOS bên dưới.)
MOMO_PARTNER_CODE="MOMOBKUN20180810"
MOMO_ACCESS_KEY="klm05673644177"
MOMO_SECRET_KEY="at67qH6mk8w5Y1n71y"
MOMO_RETURN_URL="http://localhost:5173/payment/result"
MOMO_NOTIFY_URL="https://<your-ngrok>.ngrok-free.dev/payment/momo/callback"

VNPAY_TMN_CODE="2QX1X6YX"
VNPAY_HASH_SECRET="CHXFTSLDRNNDSZMZSXWIXLXNMDHOHSTZ"
VNPAY_URL="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
VNPAY_RETURN_URL="http://localhost:5173/payment/result"
VNPAY_NOTIFY_URL="https://<your-ngrok>.ngrok-free.dev/payment/vnpay/callback"

# PayOS (cổng thanh toán DUY NHẤT cho mọi phương thức online — sinh VietQR)
# Lấy 3 key tại https://my.payos.vn → Kênh thanh toán → Thông tin tích hợp
PAYOS_CLIENT_ID=""
PAYOS_API_KEY=""
PAYOS_CHECKSUM_KEY=""
PAYOS_RETURN_URL="http://localhost:5173/payment/result"   # trình duyệt quay về khi trả tiền xong
PAYOS_CANCEL_URL="http://localhost:5173/payment/result"   # trình duyệt quay về khi bấm hủy
PAYOS_WEBHOOK_URL="https://<your-backend-domain>/payment/payos/callback"
```

> ⚠️ **Lưu ý**: File `.env` **không được commit** lên Git (đã có trong `.gitignore`).

#### Các biến quan trọng

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | Chuỗi kết nối PostgreSQL (phải khớp user/password/db của container đang chạy) |
| `JWT_SECRET` | ✅ | Khóa ký JWT — đổi giá trị khi lên production |
| `JWT_EXPIRES_IN` | — | Thời hạn access token, mặc định **`15m`** (`auth.module.ts`). Frontend tự refresh khi gặp 401 |
| `JWT_REFRESH_EXPIRES_IN_DAYS` | — | Số ngày sống của `refresh_token` (bảng `user_sessions`), mặc định `7` |
| `REDIS_HOST` / `REDIS_PORT` | ✅ | Redis dùng cho **giỏ hàng** (`cart.service.ts`), **queue email BullMQ** (`app.module.ts`) và orders. Mặc định `127.0.0.1` / `6379` |
| `REDIS_USERNAME` / `REDIS_PASSWORD` / `REDIS_TLS` | — | Chỉ cần khi dùng Redis Cloud (deploy). Đặt qua dashboard Render; local để trống |
| `ELASTICSEARCH_NODE` / `ELASTICSEARCH_INDEX` | — | Thiếu/hỏng ES thì search tự fallback sang PostgreSQL |
| `PORT` | — | Cổng backend, mặc định `3000` |
| `FRONTEND_URL` | — | **CORS origin(s)** cho backend. Nhiều origin thì cách nhau bằng **dấu phẩy**, khoảng trắng được tự cắt. VD: `http://localhost:5173,https://your-app.vercel.app`. Không khai báo → mặc định `http://localhost:5173` + `http://localhost:3000`. Đọc tại `backend-bookstore/src/main.ts` |
| `PAYMENT_RESULT_URL` | — | Trang kết quả thanh toán phía frontend |
| `DEEPSEEK_API_KEY` | — | Khóa DeepSeek cho AI chatbot. **Không có** → chatbot tự dùng Local RAG Fallback (tìm sách bằng DB, không gọi API ngoài) |
| `DEEPSEEK_MODEL` | — | Model DeepSeek, mặc định `deepseek-chat` |
| `DEV_SECRET` | — | Secret cho endpoint `POST /search/reindex-dev` (header `x-dev-secret`) |
| `SMTP_*` | — | Thiếu thì dùng Ethereal test account |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | — (✅ nếu muốn bật thanh toán online) | Bộ 3 khoá PayOS, đọc trong constructor `PaymentService`. **Thiếu → `this.payOS = null`**, API trả `"Không thể kết nối đến cổng thanh toán PayOS"` và đơn COD vẫn chạy bình thường |
| `PAYOS_RETURN_URL` | — | Trình duyệt quay về sau khi thanh toán xong. Mặc định `http://localhost:5173/payment/result`. Deploy: `https://frontend-bookstore.vercel.app/payment/result` |
| `PAYOS_CANCEL_URL` | — | Trình duyệt quay về khi bấm hủy trên trang PayOS. Mặc định như trên |
| `PAYOS_WEBHOOK_URL` | — | URL công khai để PayOS gọi webhook, dạng `<backend>/payment/payos/callback`. Deploy: `https://bookstore-api-xquk.onrender.com/payment/payos/callback` (khai báo URL này trong dashboard PayOS) |
| `SEED_BOOKS_FILE` / `SEED_CATEGORIES_FILE` | — | Chọn file JSON nguồn khi seed catalog (mặc định `books_seed.json` / `categories_seed.json`) |
| `SEED_USER_COUNT` / `SEED_ORDER_COUNT` / `SEED_REVIEW_COUNT` / `SEED_EVENT_COUNT` | — | Số lượng bản ghi `db:seed:synthetic` sinh ra (mặc định 500 / 10.000 / 50.000 / 200.000) |
| `MOMO_*`, `VNPAY_*` | — | **Legacy**: chỉ phục vụ `/payment/momo/*` và `/payment/vnpay/*`. UI hiện không dùng — mọi phương thức online đều qua PayOS |

Danh sách đầy đủ luôn nằm trong `backend-bookstore/.env.example` — nên copy từ đó và chỉ sửa giá trị.

---

## ▶️ Chạy Ứng Dụng

Mở **2 terminal** riêng biệt:

**Terminal 1 — Backend (NestJS)**:
```bash
cd backend-bookstore
npm run start:dev
```
→ API chạy tại: `http://localhost:3000`

**Terminal 2 — Frontend (Vite + React)**:
```bash
cd frontend-bookstore
npm run dev
```
→ Web chạy tại: `http://localhost:5173`

### Cách nhanh — 1 lệnh từ root

```bash
npm install && npm run dev
```

Lệnh này gộp 2 terminal ở trên thành 1: `concurrently` chạy song song `backend:start:dev` (NestJS watch mode) và `frontend:dev` (Vite), log được gắn nhãn `BACKEND` / `FRONTEND` và tô màu khác nhau. `Ctrl+C` để dừng cả hai.

> Điều kiện: PostgreSQL, Redis, Elasticsearch đã chạy (`npm run docker:up` nếu dùng Docker) và `backend-bookstore/.env` đã có.

### Cách khác — toàn bộ bằng Docker

```bash
docker compose up --build
```

Xem bảng port và biến môi trường ở mục [Chạy Nhanh](#-chạy-nhanh-1-lệnh).

---

## ✨ Tính Năng

### Phân Hệ Khách Hàng (Storefront)

| Tính năng | Mô tả |
|---|---|
| 🏠 **Trang chủ** | Promo banner slideshow, flash sale countdown, promo cards, mã giảm giá, sách đề xuất |
| 🔍 **Tìm kiếm nâng cao** | Full-text search (Elasticsearch + PG fallback), autocomplete suggest, facets (giá, rating, thể loại), đánh dấu từ khóa, gợi ý sửa lỗi chính tả |
| 🏷️ **Bộ lọc** | Lọc theo thể loại, khoảng giá, đánh giá, ngôn ngữ, sắp xếp (bestseller, mới nhất, giá, rating) |
| 📖 **Chi tiết sách** | Thông tin đầy đủ, ảnh bìa, đánh giá & bình luận, sách tương tự |
| 🛒 **Giỏ hàng** | Thêm/xóa/sửa số lượng, Redis-backed, mã giảm giá |
| 💳 **Thanh toán** | COD + 3 phương thức online (Chuyển khoản, MoMo, VNPay) đều sinh **một mã VietQR qua PayOS**; trang QR có polling 4s, đổi phương thức, hủy đơn |
| 👤 **Tài khoản** | Đăng ký/đăng nhập, chỉnh sửa profile, quản lý địa chỉ, lịch sử đơn hàng, email xác nhận |
| ⭐ **Đánh giá** | Rating 1–5 sao, viết bình luận, vote hữu ích |
| 🤖 **AI Chatbot** | Trợ lý mua sắm DeepSeek AI (SSE streaming), gợi ý sách, tra cứu đơn hàng |
| 🎯 **Gợi ý cá nhân** | For You (cá nhân hóa), Trending, "Vì bạn đã mua", sách tương tự |
| 🛡️ **Tracking hành vi** | Theo dõi view, add_to_cart, purchase để cá nhân hóa |

### Phân Hệ Quản Trị (Admin Panel — `/admin`)

| Tính năng | Mô tả |
|---|---|
| 📊 **Dashboard** | Tổng quan doanh thu, đơn hàng, sản phẩm, biểu đồ theo tháng |
| 📦 **QL Sản phẩm** | CRUD sách, upload ảnh bìa, quản lý giá & tồn kho, gán tác giả/NXB/danh mục |
| 📋 **QL Đơn hàng** | Xem danh sách, cập nhật trạng thái (pending → delivered) |
| 👥 **QL Người dùng** | Tìm kiếm/lọc user, Ban/Unban, xem lịch sử mua hàng từng KH |
| 🗂️ **QL Danh mục** | CRUD thể loại sách (cây 3 cấp) |
| ✍️ **QL Tác giả** | Thêm/sửa tác giả |
| 🏢 **QL NXB** | Thêm/sửa nhà xuất bản |
| 🎫 **QL Mã giảm giá** | CRUD coupon (%, fixed, freeship), giới hạn sử dụng, thời hạn |
| ⭐ **Duyệt Reviews** | Duyệt/từ chối đánh giá của người dùng |
| 🔄 **Reindex Search** | Reindex toàn bộ sách vào Elasticsearch |

---

## 🔌 API Endpoints

Base URL mặc định: `http://localhost:3000`

### Health Check

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/` | Trả về chuỗi chào của service | ❌ |
| `GET` | `/health` | Health check cho load balancer / Render healthcheck — trả `{ "status": "ok", "timestamp": "..." }` | ❌ |

### Auth & Users

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/auth/login` | Đăng nhập | ❌ |
| `POST` | `/users/register` | Đăng ký tài khoản | ❌ |
| `GET` | `/users/profile` | Lấy thông tin cá nhân | ✅ |
| `PUT` | `/users/profile` | Cập nhật profile | ✅ |
| `DELETE` | `/users/profile` | Xóa tài khoản | ✅ |

### Books

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/books` | Danh sách sách (filter, sort, pagination) | ❌ |
| `GET` | `/books/search?q=...` | Tìm kiếm nhanh (PostgreSQL) | ❌ |
| `GET` | `/books/:id` | Chi tiết 1 sách | ❌ |
| `GET` | `/books/by-slug/:slug` | Lấy sách theo slug (SEO) | ❌ |
| `POST` | `/books` | Tạo sách mới | 🔒 Admin |
| `PUT` | `/books/:id` | Cập nhật sách | 🔒 Admin |
| `DELETE` | `/books/:id` | Xóa sách | 🔒 Admin |

### Search (Elasticsearch — nâng cao)

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/search/suggest?q=...` | Gợi ý autocomplete (top 8) | ❌ |
| `GET` | `/search/full` | Full-text search + filters + facets + highlights + spell correction | ❌ |
| `POST` | `/search/reindex` | Reindex toàn bộ sách vào ES | 🔒 Admin |
| `POST` | `/search/reindex-dev` | Reindex (dev mode, x-dev-secret header) | 🔑 Dev Secret |

### Recommendation

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/recommendations/for-you?limit=12` | Gợi ý cá nhân (nếu login) hoặc trending (anonymous) | ⚡ Optional |
| `GET` | `/recommendations/similar/:bookId?limit=8` | Sách tương tự | ❌ |
| `GET` | `/recommendations/trending?limit=12` | Sách trending | ❌ |
| `GET` | `/recommendations/because-you-bought?limit=8` | "Vì bạn đã mua" | ✅ |

### Chat (AI)

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/chat/message` | Gửi tin nhắn — SSE streaming response | ⚡ Optional |
| `GET` | `/chat/suggestions` | Gợi ý câu hỏi nhanh | ❌ |

### Behavior Tracking

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/behavior/track` | Ghi nhận sự kiện hành vi (view, cart, purchase, search) | ⚡ Optional |

### Cart & Orders

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/cart` | Lấy giỏ hàng | ✅ |
| `POST` | `/cart/add` | Thêm sách vào giỏ | ✅ |
| `PUT` | `/cart/update` | Cập nhật số lượng | ✅ |
| `DELETE` | `/cart/remove/:bookId` | Xóa sách khỏi giỏ | ✅ |
| `POST` | `/orders/checkout` | Đặt hàng. Online payment → trả `requiresPayment: true` kèm `order.order_id` | ✅ |
| `GET` | `/orders/my-orders` | Lịch sử đơn hàng | ✅ |
| `GET` | `/orders/:id/payment-info` | Trạng thái thanh toán của 1 đơn — frontend polling 4 giây tại `/payment/process/:orderId` | ✅ |
| `POST` | `/orders/:id/change-payment` | Đổi phương thức thanh toán của đơn đang `pending` (body `{"payment_method":"cod"}`) — **không** tạo đơn mới | ✅ |
| `POST` | `/orders/:id/cancel` | Hủy đơn chờ thanh toán (`status: cancelled` + `payment_status: failed`) + **hoàn kho**. Chỉ áp dụng cho đơn còn `pending` | ✅ |

### Payment

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/payment/payos/create` | **Cổng chính** — tạo mã VietQR PayOS cho đơn (body `{ orderId, amount }`), trả `payUrl`, `qrCode`, `paymentLinkId`, `orderCode` | ✅ |
| `POST` | `/payment/payos/callback` | **Webhook PayOS** gọi về — verify chữ ký HMAC rồi cập nhật `payment_status: paid` | ❌ (verify chữ ký) |
| `POST` | `/payment/reconcile` | Đối soát thủ công: hủy đơn online treo + hoàn kho | 🔒 Admin |
| `GET` | `/payment/result` | Redirect về trang kết quả thanh toán phía frontend | ❌ |
| `POST` | `/payment/momo/create` | *Legacy* — tạo link MoMo trực tiếp (UI không dùng) | ✅ |
| `GET` | `/payment/momo/query/:orderId` | *Legacy* — truy vấn trạng thái MoMo | ✅ |
| `POST` | `/payment/momo/callback` | *Legacy* — MoMo IPN callback | ❌ |
| `POST` | `/payment/vnpay/create` | *Legacy* — tạo link VNPay trực tiếp (UI không dùng) | ✅ |
| `GET` | `/payment/vnpay/callback` | *Legacy* — VNPay IPN callback | ❌ |

### Reviews

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/reviews/book/:bookId` | Lấy reviews theo sách | ❌ |
| `POST` | `/reviews` | Tạo đánh giá | ✅ |
| `PUT` | `/reviews/:id/helpful` | Vote hữu ích | ✅ |
| `GET` | `/reviews/pending` | Reviews chờ duyệt | 🔒 Admin |
| `PUT` | `/reviews/:id/status` | Duyệt/từ chối review | 🔒 Admin |

### Admin

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `GET` | `/admin/stats` | Thống kê tổng quan | 🔒 Admin |
| `GET` | `/admin/stats/revenue` | Doanh thu theo tháng | 🔒 Admin |
| `GET` | `/admin/stats/top-books` | Top sách bán chạy | 🔒 Admin |
| `GET` | `/admin/users` | Danh sách user (search, filter) | 🔒 Admin |
| `GET` | `/admin/users/:id/orders` | Lịch sử đơn hàng theo user | 🔒 Admin |
| `PUT` | `/admin/users/:id/status` | Ban/Unban user | 🔒 Admin |
| `GET/POST/PUT` | `/admin/authors` | CRUD tác giả | 🔒 Admin |
| `GET/POST/PUT` | `/admin/publishers` | CRUD nhà xuất bản | 🔒 Admin |
| `GET/POST/PUT/DELETE` | `/admin/categories` | CRUD thể loại | 🔒 Admin |
| `GET/POST/PUT/DELETE` | `/admin/coupons` | CRUD mã giảm giá | 🔒 Admin |

---

## 🗄 Cơ Sở Dữ Liệu

### Sơ đồ ERD (các bảng chính)

```
users ─────────┐
  │            │
  ├── user_profiles
  │
  ├── user_sessions
  │
  ├── user_addresses
  │
  ├── orders ──┤── order_items ── books
  │            │                   │
  ├── reviews ─┘                   ├── book_authors ── authors
  │                                │
  └── user_behavior_events         ├── book_categories ── categories
                                   │
                                   └── publishers

coupons (độc lập — áp dụng khi checkout)
```

### Danh sách Models (Prisma Schema — 16 models)

| Model | Mô tả |
|---|---|
| `User` | Người dùng (customer, admin, moderator) |
| `UserProfile` | Metadata cá nhân hóa (sở thích, ngôn ngữ, reading level) |
| `UserSession` | Phiên đăng nhập |
| `UserAddress` | Địa chỉ giao hàng (nhiều địa chỉ/user) |
| `Book` | Sách (giá, tồn kho, rating, SEO slug, metadata) |
| `Author` | Tác giả |
| `Publisher` | Nhà xuất bản |
| `Category` | Thể loại sách (cây 3 cấp, self-referencing) |
| `BookAuthor` | Many-to-many: Sách ↔ Tác giả (có role: author, translator, editor, illustrator) |
| `BookCategory` | Many-to-many: Sách ↔ Thể loại (có primary flag) |
| `Order` | Đơn hàng (trạng thái, thanh toán, coupon_code) |
| `OrderItem` | Chi tiết đơn hàng |
| `Review` | Đánh giá sách (1–5 sao, pending/approved/rejected) |
| `ReviewVote` | Vote hữu ích cho review |
| `UserBehaviorEvent` | Tracking hành vi người dùng (view, add_to_cart, wishlist, purchase, search) |
| `Coupon` | Mã giảm giá (percentage, fixed_amount, free_shipping) |

### Dữ liệu thực tế trong hệ thống

| Nguồn | Nội dung | Quy mô |
|---|---|---|
| **Crawler Fahasa** (Puppeteer, có checkpoint) | Catalog sách thật: sách, tác giả, NXB, danh mục, giá, ảnh bìa | **5.263 sách · 2.967 tác giả · 157 danh mục** (đã vượt mục tiêu 5.000+) |
| **Seed synthetic** (faker) | User, đơn hàng theo state machine, review có trọng số, behavior event | **500 users · 10.000 đơn · 50.000 review · 200.000 event** |
| **Bản deploy Render** | Catalog rút gọn 10% (`scripts/sample-catalog.ts`) | **504 sách**, giữ nguyên toàn bộ 157 danh mục |

Local chạy **full catalog + full synthetic**; Render chỉ nạp **10% catalog** vì DB free giới hạn dung lượng.

### Enums

| Enum | Giá trị |
|---|---|
| `Role` | customer, admin, moderator |
| `UserStatus` | active, banned, unverified |
| `ReadingLevel` | casual, moderate, heavy |
| `AuthorRole` | author, translator, editor, illustrator |
| `OrderStatus` | pending, confirmed, shipping, delivered, cancelled, refunded |
| `PaymentMethod` | cod, bank_transfer, momo, vnpay, payos |
| `PaymentStatus` | pending, paid, failed, refunded |
| `ReviewStatus` | pending, approved, rejected |
| `EventType` | view, add_to_cart, wishlist, purchase, search |
| `DiscountType` | percentage, fixed_amount, free_shipping |

---

## 💳 Thanh Toán Online

### 4 lựa chọn — 1 cổng duy nhất (PayOS)

| Lựa chọn trên UI | Giá trị enum | Cách xử lý |
|---|---|---|
| **Thanh toán khi nhận hàng (COD)** | `cod` | Tạo đơn → trừ tồn kho → xong. Không gọi cổng nào |
| **Chuyển khoản ngân hàng** | `bank_transfer` | Đơn `pending` → sinh **VietQR qua PayOS** |
| **Momo** | `momo` | Đơn `pending` → sinh **VietQR qua PayOS** |
| **VNPay** | `vnpay` | Đơn `pending` → sinh **VietQR qua PayOS** |

> **Điểm cốt lõi:** 3 lựa chọn online **không gọi API Momo/VNPay trực tiếp**. Cả ba đều đi qua
> `POST /payment/payos/create` và nhận về **cùng một mã VietQR** (PayOS gói Momo, VNPay và
> ngân hàng sau một API). Nhờ vậy chỉ cần **một merchant, một bộ khoá, một webhook, một luồng đối soát**.
> Nhãn Momo/VNPay vẫn giữ trong UI vì đó là thứ người mua quen nhìn.

### Luồng thanh toán

```
Chọn phương thức ở /checkout
        │
        ▼
POST /orders/checkout  ──►  đơn tạo trong transaction (pending, payment_status: pending)
        │                   tồn kho trừ ngay; trả requiresPayment: true
        ▼
/payment/process/:orderId  ──►  POST /payment/payos/create  ──►  PayOS trả payUrl + qrCode
        │                        (mã VietQR + số tiền + nội dung)
        │
        ├── Người dùng quét QR / mở payUrl ──► thanh toán
        │
        ▼
PayOS gọi POST /payment/payos/callback
        │
        ├── payOS.webhooks.verify(body)  ── sai chữ ký ──► trả 400, không cập nhật đơn
        ├── code !== '00' ──► payment_status: failed + status: cancelled + HOÀN KHO
        └── code === '00' ──► payment_status: paid + status: confirmed
        │
        ▼
Trang /payment/process polling /orders/:id/payment-info mỗi 4 giây ──► tự đổi sang "Đã thanh toán"
```

> Thanh toán thành công không chỉ đổi `payment_status` mà còn đẩy `status` sang **`confirmed`**;
> thanh toán thất bại thì `payment_status: failed` + `status: cancelled` + **hoàn kho ngay**
> (`handlePaymentFailure()`), không chờ cron.

### Trang `/payment/process/:orderId`

- Hiển thị **mã VietQR** + số tiền + nội dung chuyển khoản, kèm nút mở `payUrl`.
- **Polling 4 giây** gọi `GET /orders/:id/payment-info` — không cần F5 khi webhook về.
- **Đổi phương thức** (`POST /orders/:id/change-payment`): đổi `payment_method` trên **cùng đơn** rồi sinh QR mới; chọn COD thì chuyển sang xác nhận luôn, **không tạo đơn mới**.
- **Hủy đơn** (`POST /orders/:id/cancel`): `status: cancelled` + `payment_status: failed` + **hoàn kho**; chỉ cho phép khi đơn còn `pending`.

### Đơn bỏ ngang — cron tự dọn

`PaymentService.onModuleInit()` chạy `reconcileAbandonedPayments()` **mỗi 60 giây**:

- Tìm đơn có `payment_status: pending`, `status: pending`, `payment_method IN (momo, vnpay, payos, bank_transfer)` và `created_at` quá **15 phút**.
- Gọi `handlePaymentFailure()` cho từng đơn: `payment_status: failed` + `status: cancelled`, **hoàn lại `stock_qty`** và giảm `sold_count` cho từng item.
- Timer được `unref()` nên không giữ process sống (không ảnh hưởng shutdown/CI).
- Có thể gọi tay: `POST /payment/reconcile` (admin) — trả `{ reconciled, orderIds }`.

### Cấu hình PayOS

```env
PAYOS_CLIENT_ID="..."
PAYOS_API_KEY="..."
PAYOS_CHECKSUM_KEY="..."
PAYOS_RETURN_URL="http://localhost:5173/payment/result"
PAYOS_CANCEL_URL="http://localhost:5173/payment/result"
PAYOS_WEBHOOK_URL="https://<backend-domain>/payment/payos/callback"
```

- Lấy 3 khoá tại **https://my.payos.vn** → Kênh thanh toán → Thông tin tích hợp.
- **Khai báo webhook URL** trong dashboard PayOS trỏ về `<backend>/payment/payos/callback`. Trên bản deploy: `https://bookstore-api-xquk.onrender.com/payment/payos/callback`.
- Thiếu 3 khoá → `PaymentService` log cảnh báo và đặt `this.payOS = null`; gọi API tạo thanh toán sẽ trả **400** `"Không thể kết nối đến cổng thanh toán PayOS"`, còn đơn COD hoạt động bình thường.

### Test webhook ở local

PayOS cần URL công khai nên phải expose localhost:

```bash
ngrok http 3000
# rồi khai báo https://<your-ngrok>.ngrok-free.dev/payment/payos/callback trong dashboard PayOS
```

Đơn online chưa thanh toán **quá 15 phút** sẽ bị cron tự hủy và hoàn kho — khi test cần thanh toán trong 15 phút.

> ⚠️ PayOS đang ở môi trường **sandbox**: đã tạo QR thật trên bản deploy nhưng **chưa có hoàn tiền tự động** (hoàn tiền phải làm tay trên dashboard PayOS).

---

## 📝 Scripts Hữu Ích

### Root (chạy từ thư mục gốc dự án)

Tất cả script dưới đây khai báo trong `package.json` ở root và gọi xuống 2 package con:

| Lệnh | Việc nó làm |
|---|---|
| `npm install` | Cài dependencies root + tự cài cho `backend-bookstore` và `frontend-bookstore` (qua `postinstall`) |
| `npm run dev` | Chạy song song backend (`start:dev`, watch mode) và frontend (`vite`) bằng `concurrently`, log gắn nhãn `BACKEND`/`FRONTEND` |
| `npm run build` | Build production: `nest build` (backend) rồi `tsc -b && vite build` (frontend) |
| `npm test` | Chạy unit test backend (`jest`) rồi E2E test backend (`jest --config ./test/jest-e2e.json`) |
| `npm run ai:evaluate` | Chạy benchmark đánh giá AI chatbot — xem [Đánh Giá AI](#-đánh-giá-ai-benchmark) |
| `npm run docker:up` | `docker compose up -d` — dựng **toàn bộ** stack ở chế độ nền, không ép build lại image (dùng cache/lần build trước) |
| `npm run docker:build` | `docker compose up -d --build` — dựng toàn bộ stack và **build lại** image backend/frontend |
| `npm run docker:up -- postgres redis elasticsearch` | Chỉ dựng 3 service hạ tầng (dùng khi chạy app bằng Node ở local) |

> Script con vẫn chạy trực tiếp được, VD: `npm --prefix backend-bookstore run start:dev`.

### Backend

```bash
# Khởi động dev server (hot reload)
npm run start:dev

# Build production
npm run build

# Chạy migration
npx prisma migrate deploy

# Tạo migration mới
npx prisma migrate dev --name <tên_migration>

# Seed catalog sách từ JSON crawler (organic — upsert idempotent)
npm run catalog:seed

# Seed dữ liệu tổng hợp (synthetic — users/orders/reviews/events)
npm run db:seed:synthetic
SEED_USER_COUNT=50 SEED_ORDER_COUNT=500 npm run db:seed:synthetic   # bản nhẹ

# Tạo bộ catalog 10% cho deploy (giữ nguyên toàn bộ danh mục)
npx ts-node scripts/sample-catalog.ts

# Seed DB Render bằng bộ 10% (dùng DATABASE_URL trong .env.render.txt)
SEED_BOOKS_FILE=books_seed_10pct.json npm run catalog:seed

# Seed mã giảm giá
npx ts-node seed-coupon.ts

# Crawl dữ liệu sách từ Fahasa (Puppeteer, có checkpoint)
npm run catalog:fetch            # 1 trang
npm run catalog:fetch:batch      # 1 trang (explicit)
npm run catalog:fetch:full       # 10 trang

# Crawl + seed trong 1 lệnh
npm run catalog:refresh

# Mở Prisma Studio (GUI quản lý DB)
npx prisma studio

# Reindex Elasticsearch
curl -X POST http://localhost:3000/search/reindex-dev -H "x-dev-secret: dev-reindex-2026"

# Lint + Format
npm run lint
npm run format

# Test
npm test
npm run test:cov
npm run test:e2e
```

### Frontend

```bash
# Khởi động dev server
npm run dev

# Build production (có type-check)
npm run build

# Preview bản build
npm run preview

# Lint
npm run lint
```

---

## 🛡 Validation & Xử Lý Lỗi

### Validation DTO (class-validator)

- Mỗi request body/query có DTO riêng, khai báo bằng decorator `class-validator`, đặt trong thư mục `dto/` của từng module — VD `backend-bookstore/src/books/dto/create-book.dto.ts`, `src/orders/dto/create-order.dto.ts`, `src/auth/dto/login.dto.ts`.
- `ValidationPipe` được đăng ký **global** trong `backend-bookstore/src/main.ts`:
  - `whitelist: true` — loại bỏ field không có trong DTO,
  - `transform: true` — tự ép kiểu (string → number, boolean…).
- Dữ liệu sai → `400 Bad Request`, `message` là mảng lỗi theo từng field (nhờ `AllExceptionsFilter` bên dưới).

### AllExceptionsFilter — format lỗi thống nhất

`backend-bookstore/src/common/filters/all-exceptions.filter.ts`, đăng ký global trong `main.ts`. **Mọi** lỗi trả về cùng một JSON:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Dữ liệu trùng lặp ở trường: email",
  "path": "/users/register",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

| Loại lỗi | HTTP | `message` |
|---|---|---|
| `HttpException` (kể cả lỗi validation) | status gốc | giữ nguyên message/mảng message |
| Prisma `P2002` (vi phạm unique) | **409 Conflict** | `Dữ liệu trùng lặp ở trường: <các field>` |
| Prisma `P2025` (record không tồn tại) | **404 Not Found** | `Không tìm thấy bản ghi yêu cầu` |
| `PrismaClientValidationError` | 400 Bad Request | `Dữ liệu gửi lên không hợp lệ` |
| Lỗi khác / Prisma code chưa map | 500 Internal Server Error | `Lỗi máy chủ nội bộ` (log stack ra console) |

Nhờ vậy frontend chỉ cần đọc `statusCode` + `message`, không phải xử lý riêng từng kiểu lỗi.

### Health check

`GET /health` → `{ "status": "ok", "timestamp": "..." }` (không cần auth), dùng cho load balancer / Render healthcheck.

---

## 📊 Đánh Giá AI (Benchmark)

```bash
npm run ai:evaluate          # từ root
# tương đương: npm --prefix backend-bookstore run ai:evaluate
#              → ts-node scripts/evaluate-ai.ts
```

Script `backend-bookstore/scripts/evaluate-ai.ts` chạy 2 phần:

**Phần 1 — Intent Classification (offline, luôn chạy)**

- Dataset cố định **50 câu tiếng Việt**, 5 intent × 10 câu: `book_search`, `order_tracking`, `recommendation`, `promotion`, `general`.
- Gọi `ChatService.classifyIntent()` trên từng câu, in ra:
  - **Confusion matrix** (dòng = expected, cột = predicted),
  - **Precision / Recall / F1** cho từng intent + **Macro Avg**,
  - **Accuracy** tổng,
  - Danh sách các câu bị phân loại sai (nếu có).
- Không cần `DEEPSEEK_API_KEY`, không gọi mạng → chạy được trong CI.

**Phần 2 — Retrieval (chỉ khi có `DATABASE_URL`)**

- **Latency** của `buildBookSearchContext()` trên 5 câu `book_search` trong dataset (ms/câu).
- **Hit Rate@5**: truy vấn `tìm sách <tên sách thật>` với 5 tựa sách lấy từ `backend-bookstore/scripts/crawler/output/books_seed.json` (fallback: top 5 sách `is_active` có rating cao nhất trong DB), kiểm tra tên sách có nằm trong context trả về không.
- Không kết nối được DB → in cảnh báo và bỏ qua phần này, **không** làm fail lệnh.

**Exit code**: dataset sai cấu trúc (sai số câu, thiếu `query`, `expected` lạ) → exit `1`; các lỗi khác → exit `0`.

Kết quả dùng để so sánh trước/sau khi tinh chỉnh `classifyIntent` và tốc độ truy hồi sách của chatbot.

---

## 🔁 CI/CD & Triển Khai

### GitHub Actions

Workflow: `.github/workflows/ci.yml` — trigger khi **push lên `main`/`master`** và **mọi pull request**. Gồm 2 job chạy song song:

| Job | Runner | Các bước |
|---|---|---|
| **backend-test** | `ubuntu-latest`, Node 22 (cache npm) | `npm ci` → `npx prisma generate` → `npm test` → `npm run test:e2e` → `npm run build` (working-directory: `backend-bookstore`) |
| **frontend-build** | `ubuntu-latest`, Node 22 (cache npm) | `npm ci` → `npm run build` (`tsc -b && vite build`, working-directory: `frontend-bookstore`) |

Job fail → PR bị chặn, nên cần chạy `npm test` / `npm run build` ở local trước khi push.

### Deploy — 2 URL đang chạy thật

| Phần | Nền tảng | URL / File cấu hình | Ghi chú |
|---|---|---|---|
| **Frontend** | **Vercel** | **https://frontend-bookstore.vercel.app** · `frontend-bookstore/vercel.json` | Rewrite `/(.*)` → `/index.html` để React Router hoạt động khi refresh/deep-link. `VITE_API_URL` = domain backend (**nhúng lúc build**, đổi phải redeploy) |
| **Backend** | **Render** | **https://bookstore-api-xquk.onrender.com** · `render.yaml` | Node runtime, `rootDir: backend-bookstore`, plan free. Build `npm ci && npx prisma generate && npm run build`, start `npx prisma db push && node dist/src/main.js`, health check `/health` |
| **Database** | **Render Postgres** | `bookstore-db` (plan free) | `DATABASE_URL` lấy từ service con. Free chỉ giữ **30 ngày** → phải tạo lại DB và seed lại khi hết hạn |
| **Redis** | **Redis Cloud** | `REDIS_HOST` / `REDIS_PORT` / `REDIS_USERNAME` / `REDIS_PASSWORD` / `REDIS_TLS` | Free **30MB** (Render không còn Redis free). Điền qua dashboard Render, `sync: false` |
| **Giữ ấm** | **UptimeRobot** | Ping `https://bookstore-api-xquk.onrender.com/health` mỗi **5 phút** | Render free ngủ sau 15 phút không có request; ping định kỳ tránh cold start 30–50 giây |

### Auto-deploy mỗi push (3 lớp)

```
git push origin main
        │
        ├─► GitHub Actions (ci.yml) ── backend-test (150 unit + 43 e2e + build)
        │                             frontend-build (tsc -b && vite build)
        │
        ├─► Vercel Git integration ─── build & deploy frontend (kèm preview URL cho mỗi PR)
        │
        └─► Render blueprint ───────── rebuild backend + `prisma db push`
```

Cả 2 job CI đang **xanh**. Thứ tự triển khai lần đầu: deploy backend (Render) → lấy domain → điền `FRONTEND_URL` (CORS, nhiều origin cách nhau dấu phẩy) + `PAYOS_WEBHOOK_URL` → deploy frontend (Vercel) với `VITE_API_URL` trỏ về domain đó → khai báo webhook URL trong dashboard PayOS.

### Seed dữ liệu cho bản deploy (10%)

```bash
# 1. Tạo bộ 10% từ catalog đầy đủ (giữ nguyên toàn bộ danh mục)
cd backend-bookstore && npx ts-node scripts/sample-catalog.ts

# 2. Seed thẳng vào DB Render (DATABASE_URL nằm trong .env.render.txt — không commit)
SEED_BOOKS_FILE=books_seed_10pct.json \
SEED_CATEGORIES_FILE=categories_seed_10pct.json \
DATABASE_URL="$(grep DATABASE_URL .env.render.txt | cut -d'"' -f2)" \
npm run catalog:seed
```

Local chạy **full catalog**, Render chạy **10%** để vừa giới hạn dung lượng DB free.

---

## 🔒 Xác Thực & Phân Quyền

- **JWT Token** được trả về sau khi đăng nhập thành công.
- Gửi token qua header: `Authorization: Bearer <token>`
- Có 3 role: `customer`, `admin`, `moderator`
- Guard `AuthGuard` kiểm tra token hợp lệ.
- Guard `RolesGuard` + decorator `@Roles('admin')` kiểm tra quyền.
- `OptionalAuthGuard` cho phép truy cập cả khi không có token (dùng cho recommendation, chat, behavior).
- Mật khẩu được mã hóa bằng **Argon2id**.

---

## 🤖 AI Chatbot (DeepSeek)

Hệ thống tích hợp chatbot AI sử dụng DeepSeek API:

- **Widget nổi** góc phải màn hình, luôn sẵn sàng
- **SSE Streaming** — phản hồi hiển thị theo thời gian thực
- **Markdown** — hỗ trợ in đậm, link, xuống dòng
- **Gợi ý nhanh** — các câu hỏi phổ biến (tìm sách, tra cứu đơn hàng, gợi ý)
- **Cá nhân hóa** — gửi kèm lịch sử chat và user context khi đã đăng nhập
- **Dừng được** — nút stop khi đang streaming

Yêu cầu: `DEEPSEEK_API_KEY` trong `.env`; tên model đổi được qua `DEEPSEEK_MODEL` (mặc định `deepseek-chat`). Không có `DEEPSEEK_API_KEY` thì chatbot **không lỗi** — nó chuyển sang **Local RAG Fallback** (truy hồi sách trong DB rồi trả lời cục bộ, không gọi API ngoài).

Chất lượng phân loại intent và tốc độ truy hồi của chatbot được đo bằng benchmark: xem [Đánh Giá AI](#-đánh-giá-ai-benchmark) (`npm run ai:evaluate`).

---

## 🔍 Tìm Kiếm Nâng Cao (Elasticsearch)

- **Full-text search** với Vietnamese analyzer (ICU folding hoặc ASCII folding fallback)
- **Autocomplete suggest** (edge ngram) — gõ vài chữ là có gợi ý
- **Facets aggregation** — lọc theo thể loại, khoảng giá, rating
- **Highlight** — đánh dấu từ khóa trong kết quả
- **Spell correction** — gợi ý sửa lỗi chính tả ("did you mean?")
- **Fallback PostgreSQL** — tự động chuyển về PG khi Elasticsearch không khả dụng
- **Reindex** — admin có thể reindex toàn bộ catalog

> ⚠️ **Trạng thái trên bản deploy:** Render free không đủ RAM cho Elasticsearch nên production **không chạy ES** — toàn bộ tìm kiếm đang đi nhánh fallback PostgreSQL (vẫn đúng kết quả, nhưng mất facets/highlight nâng cao). Local chạy đủ ES.

---

## 🧪 Kiểm Thử (Testing)

Dự án được triển khai kiểm thử toàn diện ở 3 cấp độ:

| Cấp Độ | Công Cụ | Số lượng | Phạm Vi |
|---|---|---|---|
| **Unit Test** | Jest | **18 bộ / 150 test** ✅ | Từng service/controller: auth, books, cart, orders, **payment (PayOS)**, chat, recommendation, search, reviews, admin... (Prisma mock) |
| **Integration Test** (API E2E) | Supertest + Jest | **5 bộ / 43 test** ✅ | `app`, `auth`, `books`, `cart`, `orders` — status code, shape response, phân quyền |
| **System Test** (E2E UI) | Playwright | `e2e/navigation.spec.ts`, `e2e/purchase-flow.spec.ts` | Mô phỏng người dùng thực tế (tìm kiếm, giỏ hàng, checkout) trên trình duyệt |

> Cả **150 unit + 43 e2e** đều chạy trong CI ở mỗi push/PR — job `backend-test` trong `.github/workflows/ci.yml`.

### Hướng Dẫn Chạy Test

**1. Unit Test & Báo Cáo Coverage (Backend)**
```bash
cd backend-bookstore
npm test

# Chạy test và tạo báo cáo HTML (Coverage)
npm run test:cov
# Báo cáo được tạo tại: backend-bookstore/coverage/lcov-report/index.html
```

**2. Integration Test / API E2E (Backend)**
```bash
cd backend-bookstore
npm run test:e2e
```

**3. System Test / E2E UI (Frontend)**
*(Yêu cầu Backend và Frontend đang chạy)*
```bash
cd frontend-bookstore
npx playwright install   # Chạy 1 lần duy nhất để tải trình duyệt
npx playwright test

# Hiển thị báo cáo HTML (với hình ảnh/video nếu có lỗi)
npx playwright show-report
```

> Ở **root** có `npm test` = unit test backend + E2E test backend (`npm --prefix backend-bookstore test && npm --prefix backend-bookstore run test:e2e`). Nó **không** chạy Playwright — E2E UI vẫn phải chạy riêng như trên. Đây cũng chính là bộ test mà job `backend-test` trong CI thực thi.

---

## 🙋 Tác Giả

**Dương Công Minh** - 22010009
* GitHub: [@Minhne2194](https://github.com/Minhne2194)

---

## 📄 License

Dự án này được cấp phép theo [MIT License](https://opensource.org/licenses/MIT).

---

> 🎓 *Lưu ý: Đây là dự án phục vụ mục đích học tập. Các API key thanh toán trong tài liệu đều là Sandbox/Test key.*
