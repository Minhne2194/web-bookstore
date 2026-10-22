import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ScoredBook {
  book_id: string;
  score: number;
  signal: string;
}

export interface BookWithScore {
  book_id: string;
  title: string;
  price: number;
  cover_url: string | null;
  avg_rating: number;
  author: string;
  score: number;
  reasons: string[];
}

@Injectable()
export class RecommendationService {
  constructor(private prisma: PrismaService) {}

  // ── 1. Collaborative Filtering ──
  // "Người mua sách X cũng mua sách Y"
  async getCollaborativeScores(userId: string, limit = 50): Promise<ScoredBook[]> {
    const result: any[] = await this.prisma.$queryRaw`
      WITH user_books AS (
        SELECT DISTINCT oi.book_id
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        WHERE o.user_id = ${userId}
          AND o.status IN ('delivered', 'confirmed', 'shipping')
      ),
      co_purchased AS (
        SELECT oi2.book_id, COUNT(DISTINCT oi1.order_id)::float AS frequency
        FROM order_items oi1
        JOIN order_items oi2 ON oi1.order_id = oi2.order_id
          AND oi1.book_id != oi2.book_id
        WHERE oi1.book_id IN (SELECT book_id FROM user_books)
          AND oi2.book_id NOT IN (SELECT book_id FROM user_books)
        GROUP BY oi2.book_id
      )
      SELECT
        book_id::text,
        CASE WHEN MAX(frequency) OVER() > 0
          THEN frequency / MAX(frequency) OVER()
          ELSE 0
        END AS score
      FROM co_purchased
      ORDER BY frequency DESC
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      book_id: r.book_id,
      score: parseFloat(r.score) || 0,
      signal: 'collaborative',
    }));
  }

  // ── 2. Content-Based ──
  // Gợi ý sách cùng thể loại/tác giả với sách user đã mua/xem
  async getContentBasedScores(userId: string, limit = 50): Promise<ScoredBook[]> {
    const result: any[] = await this.prisma.$queryRaw`
      WITH user_categories AS (
        SELECT DISTINCT bc.category_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN book_categories bc ON oi.book_id = bc.book_id
        WHERE o.user_id = ${userId}
      ),
      user_authors AS (
        SELECT DISTINCT ba.author_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN book_authors ba ON oi.book_id = ba.book_id
        WHERE o.user_id = ${userId}
      ),
      user_bought AS (
        SELECT DISTINCT oi.book_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.user_id = ${userId}
      ),
      scored AS (
        SELECT
          b.book_id::text,
          (
            CASE WHEN EXISTS(
              SELECT 1 FROM book_categories bc2
              WHERE bc2.book_id = b.book_id
                AND bc2.category_id IN (SELECT category_id FROM user_categories)
            ) THEN 0.6 ELSE 0 END
            +
            CASE WHEN EXISTS(
              SELECT 1 FROM book_authors ba2
              WHERE ba2.book_id = b.book_id
                AND ba2.author_id IN (SELECT author_id FROM user_authors)
            ) THEN 0.8 ELSE 0 END
          ) AS raw_score
        FROM books b
        WHERE b.is_active = true
          AND b.book_id NOT IN (SELECT book_id FROM user_bought)
      )
      SELECT book_id, raw_score / 1.4 AS score
      FROM scored
      WHERE raw_score > 0
      ORDER BY raw_score DESC, RANDOM()
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      book_id: r.book_id,
      score: parseFloat(r.score) || 0,
      signal: 'content',
    }));
  }

  // ── 3. Rating Signal ──
  // Tìm "taste neighbors" (users rated cùng sách tương tự) → lấy sách họ rate cao
  async getRatingSignalScores(userId: string, limit = 50): Promise<ScoredBook[]> {
    const result: any[] = await this.prisma.$queryRaw`
      WITH my_ratings AS (
        SELECT book_id, rating
        FROM reviews
        WHERE user_id = ${userId}
      ),
      taste_neighbors AS (
        SELECT r2.user_id, COUNT(*) AS common_books,
               AVG(ABS(r2.rating - mr.rating)) AS avg_diff
        FROM my_ratings mr
        JOIN reviews r2 ON r2.book_id = mr.book_id
          AND r2.user_id != ${userId}
        GROUP BY r2.user_id
        HAVING AVG(ABS(r2.rating - mr.rating)) <= 1.5
        ORDER BY common_books DESC, avg_diff ASC
        LIMIT 100
      ),
      neighbor_highly_rated AS (
        SELECT r.book_id::text, AVG(r.rating) AS avg_neighbor_rating, COUNT(*) AS vote_count
        FROM reviews r
        JOIN taste_neighbors tn ON r.user_id = tn.user_id
        WHERE r.rating >= 4
          AND r.book_id NOT IN (SELECT book_id FROM my_ratings)
        GROUP BY r.book_id
      )
      SELECT
        book_id,
        (avg_neighbor_rating / 5.0) AS score
      FROM neighbor_highly_rated
      WHERE vote_count >= 1
      ORDER BY avg_neighbor_rating DESC, vote_count DESC
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      book_id: r.book_id,
      score: parseFloat(r.score) || 0,
      signal: 'rating',
    }));
  }

  // ── 4. Behavioral ──
  // Sách có engagement cao từ similar users
  async getBehavioralScores(userId: string, limit = 50): Promise<ScoredBook[]> {
    const result: any[] = await this.prisma.$queryRaw`
      WITH user_bought AS (
        SELECT DISTINCT oi.book_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.user_id = ${userId}
      ),
      weighted_events AS (
        SELECT
          book_id::text,
          SUM(
            CASE
              WHEN event_type = 'purchase' THEN 5
              WHEN event_type = 'wishlist' THEN 4
              WHEN event_type = 'add_to_cart' THEN 3
              WHEN event_type = 'view' THEN 1
              ELSE 0
            END
          )::float AS weighted_score
        FROM user_behavior_events
        WHERE book_id IS NOT NULL
          AND book_id NOT IN (SELECT book_id FROM user_bought)
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY book_id
      )
      SELECT
        book_id,
        CASE WHEN MAX(weighted_score) OVER() > 0
          THEN weighted_score / MAX(weighted_score) OVER()
          ELSE 0
        END AS score
      FROM weighted_events
      ORDER BY weighted_score DESC
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      book_id: r.book_id,
      score: parseFloat(r.score) || 0,
      signal: 'behavioral',
    }));
  }

  // ── 5. Trending ──
  // Hot sách 7 ngày qua: sold_count × avg_rating
  async getTrendingScores(limit = 50): Promise<ScoredBook[]> {
    const result: any[] = await this.prisma.$queryRaw`
      SELECT
        b.book_id::text,
        (
          COALESCE(recent.sold_7d, 0)::float / GREATEST(MAX(COALESCE(recent.sold_7d, 0)) OVER(), 1)
        ) * (COALESCE(b.avg_rating, 0)::float / 5.0) AS score
      FROM books b
      LEFT JOIN (
        SELECT oi.book_id, SUM(oi.quantity) AS sold_7d
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.created_at > NOW() - INTERVAL '7 days'
          AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY oi.book_id
      ) recent ON b.book_id = recent.book_id
      WHERE b.is_active = true
      ORDER BY score DESC NULLS LAST
      LIMIT ${limit}
    `;

    return result.map((r) => ({
      book_id: r.book_id,
      score: parseFloat(r.score) || 0,
      signal: 'trending',
    }));
  }

  // ── 6. Combined Recommendation (Main API) ──
  // Kết hợp 5 signals theo Proposal weights
  async getPersonalizedRecommendations(
    userId: string,
    limit = 12,
  ): Promise<BookWithScore[]> {
    const [cfScores, cbScores, rsScores, bhScores, trScores] = await Promise.all([
      this.getCollaborativeScores(userId, 50),
      this.getContentBasedScores(userId, 50),
      this.getRatingSignalScores(userId, 50),
      this.getBehavioralScores(userId, 50),
      this.getTrendingScores(50),
    ]);

    // Merge scores with weights: CF=0.35, CB=0.25, RS=0.20, BH=0.15, TR=0.05
    const scoreMap = new Map<string, { score: number; signals: Set<string> }>();

    const addScores = (
      books: ScoredBook[],
      weight: number,
    ) => {
      books.forEach((b) => {
        const existing = scoreMap.get(b.book_id);
        if (existing) {
          existing.score += b.score * weight;
          existing.signals.add(b.signal);
        } else {
          scoreMap.set(b.book_id, {
            score: b.score * weight,
            signals: new Set([b.signal]),
          });
        }
      });
    };

    addScores(cfScores, 0.35);
    addScores(cbScores, 0.25);
    addScores(rsScores, 0.20);
    addScores(bhScores, 0.15);
    addScores(trScores, 0.05);

    // Sort by combined score and take top limit*2 for enrichment
    const sortedIds = Array.from(scoreMap.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit * 2)
      .map(([id]) => id);

    if (sortedIds.length === 0) {
      // Fallback to trending books
      return this.getTrendingBooks(limit);
    }

    // Enrich with book details
    const books = await this.prisma.book.findMany({
      where: {
        book_id: { in: sortedIds },
        is_active: true,
      },
      include: {
        book_authors: { include: { author: true }, take: 1 },
      },
      take: limit,
    });

    return books
      .map((book) => {
        const entry = scoreMap.get(book.book_id)!;
        const reasons = this.buildReasons(entry.signals);
        return {
          book_id: book.book_id,
          title: book.title,
          price: Number(book.price),
          cover_url: book.cover_url,
          avg_rating: Number(book.avg_rating) || 0,
          author: book.book_authors[0]?.author?.name || 'Đang cập nhật',
          score: entry.score,
          reasons,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ── 7. Similar Books ──
  // Cho trang BookDetail: sách tương tự dựa trên category + author + co-purchase
  async getSimilarBooks(bookId: string, limit = 8): Promise<any[]> {
    const result: any[] = await this.prisma.$queryRaw`
      WITH book_cats AS (
        SELECT category_id FROM book_categories WHERE book_id = ${bookId}::uuid
      ),
      book_auths AS (
        SELECT author_id FROM book_authors WHERE book_id = ${bookId}::uuid
      ),
      co_bought AS (
        SELECT oi2.book_id, COUNT(*) AS co_count
        FROM order_items oi1
        JOIN order_items oi2 ON oi1.order_id = oi2.order_id
          AND oi1.book_id != oi2.book_id
        WHERE oi1.book_id = ${bookId}::uuid
        GROUP BY oi2.book_id
        LIMIT 20
      ),
      scored AS (
        SELECT
          b.book_id::text,
          (
            CASE WHEN EXISTS(
              SELECT 1 FROM book_categories bc2
              WHERE bc2.book_id = b.book_id AND bc2.category_id IN (SELECT category_id FROM book_cats)
            ) THEN 0.6 ELSE 0 END
            +
            CASE WHEN EXISTS(
              SELECT 1 FROM book_authors ba2
              WHERE ba2.book_id = b.book_id AND ba2.author_id IN (SELECT author_id FROM book_auths)
            ) THEN 0.8 ELSE 0 END
            +
            COALESCE((SELECT co_count::float / 10.0 FROM co_bought cb WHERE cb.book_id = b.book_id), 0)
          ) AS raw_score
        FROM books b
        WHERE b.is_active = true
          AND b.book_id != ${bookId}::uuid
      )
      SELECT book_id
      FROM scored
      WHERE raw_score > 0
      ORDER BY raw_score DESC, RANDOM()
      LIMIT ${limit}
    `;

    const ids = result.map((r) => r.book_id);
    if (ids.length === 0) return [];

    const books = await this.prisma.book.findMany({
      where: { book_id: { in: ids }, is_active: true },
      include: { book_authors: { include: { author: true }, take: 1 } },
    });

    return books.map((book) => ({
      book_id: book.book_id,
      title: book.title,
      price: Number(book.price),
      cover_url: book.cover_url,
      avg_rating: Number(book.avg_rating) || 0,
      author: book.book_authors[0]?.author?.name || 'Đang cập nhật',
    }));
  }

  // ── Trending Books (public, no userId) ──
  async getTrendingBooks(limit = 12): Promise<BookWithScore[]> {
    const trScores = await this.getTrendingScores(limit * 2);
    const ids = trScores.map((r) => r.book_id).slice(0, limit * 2);

    if (ids.length === 0) {
      const books = await this.prisma.book.findMany({
        where: { is_active: true },
        include: { book_authors: { include: { author: true }, take: 1 } },
        orderBy: { avg_rating: 'desc' },
        take: limit,
      });
      return books.map((book) => ({
        book_id: book.book_id,
        title: book.title,
        price: Number(book.price),
        cover_url: book.cover_url,
        avg_rating: Number(book.avg_rating) || 0,
        author: book.book_authors[0]?.author?.name || 'Đang cập nhật',
        score: 0,
        reasons: ['Đang thịnh hành'],
      }));
    }

    const books = await this.prisma.book.findMany({
      where: { book_id: { in: ids }, is_active: true },
      include: { book_authors: { include: { author: true }, take: 1 } },
      take: limit,
    });

    const scoreMap = new Map(trScores.map((r) => [r.book_id, r.score]));
    return books
      .map((book) => ({
        book_id: book.book_id,
        title: book.title,
        price: Number(book.price),
        cover_url: book.cover_url,
        avg_rating: Number(book.avg_rating) || 0,
        author: book.book_authors[0]?.author?.name || 'Đang cập nhật',
        score: scoreMap.get(book.book_id) || 0,
        reasons: ['Đang thịnh hành'],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ── Because You Bought ──
  async getBecauseYouBought(userId: string, limit = 8): Promise<BookWithScore[]> {
    const cfScores = await this.getCollaborativeScores(userId, limit * 2);
    const ids = cfScores.map((r) => r.book_id).slice(0, limit * 2);

    if (ids.length === 0) return [];

    const books = await this.prisma.book.findMany({
      where: { book_id: { in: ids }, is_active: true },
      include: { book_authors: { include: { author: true }, take: 1 } },
      take: limit,
    });

    const scoreMap = new Map(cfScores.map((r) => [r.book_id, r.score]));
    return books
      .map((book) => ({
        book_id: book.book_id,
        title: book.title,
        price: Number(book.price),
        cover_url: book.cover_url,
        avg_rating: Number(book.avg_rating) || 0,
        author: book.book_authors[0]?.author?.name || 'Đang cập nhật',
        score: scoreMap.get(book.book_id) || 0,
        reasons: ['Người mua sách giống bạn cũng mua'],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private buildReasons(signals: Set<string>): string[] {
    const reasons: string[] = [];
    if (signals.has('collaborative')) reasons.push('Người mua sách giống bạn cũng mua');
    if (signals.has('content')) reasons.push('Cùng thể loại hoặc tác giả yêu thích');
    if (signals.has('rating')) reasons.push('Được đánh giá cao bởi độc giả giống bạn');
    if (signals.has('behavioral')) reasons.push('Được nhiều người quan tâm');
    if (signals.has('trending')) reasons.push('Đang thịnh hành');
    return reasons.length > 0 ? reasons : ['Gợi ý dành riêng cho bạn'];
  }
}
