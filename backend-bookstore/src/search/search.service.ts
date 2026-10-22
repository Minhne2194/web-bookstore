import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { PrismaService } from '../prisma/prisma.service';

type SearchFilters = {
  q?: string;
  ids?: string;
  sort?: string;
  category?: string;
  author?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  rating?: string | number;
  lang?: string;
  page?: string | number;
  limit?: string | number;
};

type SearchDocument = {
  book_id: string;
  isbn?: string | null;
  slug: string;
  title: string;
  authors: string[];
  author_ids: string[];
  publisher?: string | null;
  description?: string | null;
  categories: string[];
  category_ids: string[];
  category_slugs: string[];
  category_facets: string[];
  category_objects: { category_id: string; name: string; slug: string }[];
  price: number;
  compare_price?: number | null;
  avg_rating: number;
  rating_count: number;
  sold_count: number;
  stock_qty: number;
  language: string;
  cover_url?: string | null;
  is_active: boolean;
  created_at: string;
};

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = process.env.ELASTICSEARCH_INDEX || 'books_v1';
  private readonly client = new Client({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  });
  private indexReady = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureIndex();
    } catch (error) {
      this.logger.warn(
        `Elasticsearch is unavailable on startup. PostgreSQL fallback will be used. ${this.errorMessage(error)}`,
      );
    }
  }

  async indexBook(bookId: string) {
    try {
      await this.ensureIndex();
      const book = await this.prisma.book.findUnique({
        where: { book_id: bookId },
        include: this.bookInclude(),
      });

      if (!book || !book.is_active) {
        await this.removeBook(bookId);
        return { indexed: false };
      }

      await this.client.index({
        index: this.indexName,
        id: bookId,
        document: this.toDocument(book),
        refresh: true,
      });

      return { indexed: true };
    } catch (error) {
      this.logger.warn(
        `Could not index book ${bookId}. ${this.errorMessage(error)}`,
      );
      return { indexed: false };
    }
  }

  async removeBook(bookId: string) {
    try {
      await this.ensureIndex();
      await this.client.delete({
        index: this.indexName,
        id: bookId,
        refresh: true,
      });
      return { removed: true };
    } catch (error) {
      if (!this.isNotFound(error)) {
        this.logger.warn(
          `Could not remove book ${bookId} from search index. ${this.errorMessage(error)}`,
        );
      }
      return { removed: false };
    }
  }

  async bulkIndex() {
    try {
      await this.recreateIndex();

      const batchSize = 250;
      let indexed = 0;
      let page = 0;

      while (true) {
        const books = await this.prisma.book.findMany({
          where: { is_active: true },
          orderBy: { book_id: 'asc' },
          skip: page * batchSize,
          take: batchSize,
          include: this.bookInclude(),
        });

        if (books.length === 0) break;

        const operations = books.flatMap((book) => [
          { index: { _index: this.indexName, _id: book.book_id } },
          this.toDocument(book),
        ]);

        const response = await this.client.bulk({
          refresh: false,
          operations,
        });

        if ((response as any).errors) {
          this.logger.warn('Some books failed during Elasticsearch bulk index.');
        }

        indexed += books.length;
        page += 1;
      }

      await this.client.indices.refresh({ index: this.indexName });

      return {
        success: true,
        indexed,
        index: this.indexName,
      };
    } catch (error) {
      this.logger.warn(`Reindex failed. ${this.errorMessage(error)}`);
      return {
        success: false,
        indexed: 0,
        index: this.indexName,
        message: 'Elasticsearch is unavailable. PostgreSQL search fallback remains active.',
      };
    }
  }

  async search(filters: SearchFilters = {}) {
    const page = this.positiveInt(filters.page, 1);
    const limit = Math.min(this.positiveInt(filters.limit, 20), 100);
    const queryText = filters.q?.trim();

    try {
      await this.ensureIndex();
      if (!(await this.hasIndexedDocuments())) {
        return this.postgresSearch(filters, page, limit);
      }

      const response = await this.client.search<SearchDocument>({
        index: this.indexName,
        from: (page - 1) * limit,
        size: limit,
        track_total_hits: true,
        query: this.buildElasticsearchQuery(filters),
        sort: this.buildElasticsearchSort(filters.sort, queryText),
        aggs: this.buildAggregations(),
        highlight: queryText ? this.buildHighlight() : undefined,
        suggest: queryText ? this.buildCorrectionSuggest(queryText) : undefined,
      } as any);

      return this.formatElasticsearchResult(response, page, limit, queryText);
    } catch (error) {
      this.logger.warn(
        `Search fallback to PostgreSQL. ${this.errorMessage(error)}`,
      );
      return this.postgresSearch(filters, page, limit);
    }
  }

  async suggest(q: string) {
    const queryText = q?.trim();
    if (!queryText) return { data: [], meta: { total: 0 } };

    try {
      await this.ensureIndex();
      if (!(await this.hasIndexedDocuments())) {
        return this.postgresSuggest(queryText);
      }

      const response = await this.client.search<SearchDocument>({
        index: this.indexName,
        size: 8,
        query: {
          bool: {
            filter: [{ term: { is_active: true } }],
            should: [
              {
                match: {
                  'title.autocomplete': {
                    query: queryText,
                    boost: 4,
                  },
                },
              },
              {
                match_phrase_prefix: {
                  title: {
                    query: queryText,
                    boost: 3,
                  },
                },
              },
              {
                multi_match: {
                  query: queryText,
                  fields: ['authors^2', 'publisher'],
                  fuzziness: 'AUTO',
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        sort: [{ sold_count: { order: 'desc' } }],
      } as any);

      const data = response.hits.hits.map((hit) =>
        this.formatSuggestion(hit._source),
      );

      return { data, meta: { total: data.length, source: 'elasticsearch' } };
    } catch (error) {
      this.logger.warn(
        `Suggest fallback to PostgreSQL. ${this.errorMessage(error)}`,
      );
      return this.postgresSuggest(queryText);
    }
  }

  private async ensureIndex() {
    if (this.indexReady) return;

    await this.client.ping();
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (!exists) {
      await this.createIndex();
    }

    this.indexReady = true;
  }

  private async recreateIndex() {
    try {
      await this.client.indices.delete({ index: this.indexName });
    } catch (error) {
      if (!this.isNotFound(error)) throw error;
    }

    this.indexReady = false;
    await this.ensureIndex();
  }

  private async hasIndexedDocuments() {
    const response = await this.client.count({
      index: this.indexName,
      query: { term: { is_active: true } },
    });
    return response.count > 0;
  }

  private async createIndex() {
    const icuDefinition = this.indexDefinition(true);

    try {
      await this.client.indices.create({
        index: this.indexName,
        ...icuDefinition,
      } as any);
      return;
    } catch (error) {
      if (!this.looksLikeMissingIcu(error)) throw error;
      this.logger.warn(
        'analysis-icu plugin is not available. Creating index with standard Vietnamese accent folding analyzer.',
      );
    }

    await this.client.indices.create({
      index: this.indexName,
      ...this.indexDefinition(false),
    } as any);
  }

  private indexDefinition(useIcu: boolean) {
    const foldFilter = useIcu ? 'icu_folding' : 'asciifolding';
    const viTokenizer = useIcu ? 'icu_tokenizer' : 'standard';

    return {
      settings: {
        analysis: {
          analyzer: {
            vi_analyzer: {
              type: 'custom',
              tokenizer: viTokenizer,
              filter: ['lowercase', foldFilter],
            },
            autocomplete_analyzer: {
              type: 'custom',
              tokenizer: 'edge_ngram_tokenizer',
              filter: ['lowercase', foldFilter],
            },
          },
          tokenizer: {
            edge_ngram_tokenizer: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 15,
              token_chars: ['letter', 'digit'],
            },
          },
        },
      },
      mappings: {
        dynamic: false,
        properties: {
          book_id: { type: 'keyword' },
          isbn: { type: 'keyword' },
          slug: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'vi_analyzer',
            fields: {
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
                search_analyzer: 'vi_analyzer',
              },
              keyword: { type: 'keyword' },
            },
          },
          authors: { type: 'text', analyzer: 'vi_analyzer' },
          author_ids: { type: 'keyword' },
          publisher: { type: 'text', analyzer: 'vi_analyzer' },
          description: { type: 'text', analyzer: 'vi_analyzer' },
          categories: { type: 'keyword' },
          category_ids: { type: 'keyword' },
          category_slugs: { type: 'keyword' },
          category_facets: { type: 'keyword' },
          category_objects: {
            properties: {
              category_id: { type: 'keyword' },
              name: { type: 'keyword' },
              slug: { type: 'keyword' },
            },
          },
          price: { type: 'float' },
          compare_price: { type: 'float' },
          avg_rating: { type: 'float' },
          rating_count: { type: 'integer' },
          sold_count: { type: 'integer' },
          stock_qty: { type: 'integer' },
          language: { type: 'keyword' },
          cover_url: { type: 'keyword', index: false },
          is_active: { type: 'boolean' },
          created_at: { type: 'date' },
        },
      },
    };
  }

  private buildElasticsearchQuery(filters: SearchFilters) {
    const filter: any[] = [{ term: { is_active: true } }];
    const queryText = filters.q?.trim();
    const ids = this.splitCsv(filters.ids);
    const category = filters.category?.trim();
    const author = filters.author?.trim();
    const minPrice = this.optionalNumber(filters.minPrice);
    const maxPrice = this.optionalNumber(filters.maxPrice);
    const rating = this.optionalNumber(filters.rating);

    if (ids.length) filter.push({ terms: { book_id: ids } });
    if (filters.lang) filter.push({ term: { language: filters.lang } });
    if (author) filter.push({ term: { author_ids: author } });
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.push({
        range: {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        },
      });
    }
    if (rating !== undefined) {
      filter.push({ range: { avg_rating: { gte: rating } } });
    }
    if (category) {
      filter.push({
        bool: {
          should: [
            { term: { category_ids: category } },
            { term: { category_slugs: category } },
            { term: { categories: category } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (!queryText) {
      return { bool: { filter, must: [{ match_all: {} }] } };
    }

    return {
      bool: {
        filter,
        must: [
          {
            multi_match: {
              query: queryText,
              fields: ['title^3', 'authors^2', 'publisher^1.5', 'description'],
              fuzziness: 'AUTO',
              minimum_should_match: '70%',
            },
          },
        ],
        should: [
          {
            match_phrase_prefix: {
              title: {
                query: queryText,
                boost: 4,
              },
            },
          },
        ],
      },
    };
  }

  private buildElasticsearchSort(sort?: string, queryText?: string) {
    if (!sort || sort === 'relevance') return queryText ? undefined : [{ created_at: { order: 'desc' } }];
    if (sort === 'bestseller') return [{ sold_count: { order: 'desc' } }];
    if (sort === 'newest') return [{ created_at: { order: 'desc' } }];
    if (sort === 'price_asc') return [{ price: { order: 'asc' } }];
    if (sort === 'price_desc') return [{ price: { order: 'desc' } }];
    if (sort === 'rating') return [{ avg_rating: { order: 'desc' } }];
    return queryText ? undefined : [{ created_at: { order: 'desc' } }];
  }

  private buildAggregations() {
    return {
      categories: {
        terms: {
          field: 'category_facets',
          size: 50,
        },
      },
      price_ranges: {
        range: {
          field: 'price',
          ranges: [
            { key: 'under_50', to: 50000 },
            { key: '50_100', from: 50000, to: 100000 },
            { key: '100_200', from: 100000, to: 200000 },
            { key: 'over_200', from: 200000 },
          ],
        },
      },
      rating_ranges: {
        range: {
          field: 'avg_rating',
          ranges: [
            { key: 'rating_5', from: 5 },
            { key: 'rating_4', from: 4 },
            { key: 'rating_3', from: 3 },
          ],
        },
      },
    };
  }

  private buildHighlight() {
    return {
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
      fields: {
        title: { number_of_fragments: 0 },
        authors: { number_of_fragments: 0 },
        description: { fragment_size: 140, number_of_fragments: 1 },
      },
    };
  }

  private buildCorrectionSuggest(queryText: string) {
    return {
      did_you_mean: {
        text: queryText,
        phrase: {
          field: 'title',
          size: 1,
          direct_generator: [{ field: 'title', suggest_mode: 'popular' }],
        },
      },
    };
  }

  private formatElasticsearchResult(
    response: any,
    page: number,
    limit: number,
    queryText?: string,
  ) {
    const totalValue = response.hits?.total;
    const total =
      typeof totalValue === 'number' ? totalValue : (totalValue?.value ?? 0);

    const data = response.hits.hits.map((hit: any) => ({
      ...this.formatSource(hit._source),
      highlights: this.normalizeHighlight(hit.highlight),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        source: 'elasticsearch',
      },
      facets: this.formatAggregations(response.aggregations),
      correction: this.extractCorrection(response.suggest, queryText),
    };
  }

  private async postgresSearch(
    filters: SearchFilters,
    page: number,
    limit: number,
  ) {
    const where = this.buildPrismaWhere(filters);
    const orderBy = this.buildPrismaOrderBy(filters.sort);
    const skip = (page - 1) * limit;

    // Run count + page query in parallel (no more 5000-row facet scan)
    const [total, books] = await Promise.all([
      this.prisma.book.count({ where }),
      this.prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.bookInclude(),
      }),
    ]);

    // Lightweight facets via raw SQL aggregations
    const facets = await this.buildPostgresFacetsRaw(filters);

    return {
      data: books.map((book) => this.formatPrismaBook(book)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        source: 'postgres',
      },
      facets,
      correction: null,
    };
  }

  private async buildPostgresFacetsRaw(filters: SearchFilters) {
    const minPrice = this.optionalNumber(filters.minPrice);
    const maxPrice = this.optionalNumber(filters.maxPrice);
    const rating = this.optionalNumber(filters.rating);
    const langFilter = filters.lang || null;
    const categoryFilter = filters.category || null;
    const queryText = filters.q?.trim() || null;

    // Build base WHERE clause compatible with raw SQL
    const conditions: string[] = ['b.is_active = true'];
    if (langFilter) conditions.push(`b.language = '${langFilter.replace(/'/g, "''")}'`);
    if (minPrice !== undefined) conditions.push(`b.price >= ${minPrice}`);
    if (maxPrice !== undefined) conditions.push(`b.price <= ${maxPrice}`);
    if (rating !== undefined) conditions.push(`b.avg_rating >= ${rating}`);
    if (categoryFilter) {
      const escapedCategory = categoryFilter.replace(/'/g, "''");
      conditions.push(`EXISTS (
        SELECT 1 FROM book_categories bc2
        JOIN categories cat2 ON bc2.category_id = cat2.category_id
        WHERE bc2.book_id = b.book_id
          AND (
            cat2.category_id::text = '${escapedCategory}'
            OR cat2.slug = '${escapedCategory}'
            OR lower(cat2.name) = lower('${escapedCategory}')
          )
      )`);
    }
    if (queryText) {
      const escaped = queryText.replace(/'/g, "''");
      conditions.push(`(b.title ILIKE '%${escaped}%' OR b.description ILIKE '%${escaped}%')`);
    }
    const baseWhere = conditions.join(' AND ');

    try {
      // 1. Category facets
      const catRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT c.category_id::text AS id, c.slug, c.name, COUNT(DISTINCT b.book_id)::int AS count
        FROM books b
        JOIN book_categories bc ON b.book_id = bc.book_id
        JOIN categories c ON bc.category_id = c.category_id
        WHERE ${baseWhere}
        GROUP BY c.category_id, c.slug, c.name
        ORDER BY count DESC
        LIMIT 30
      `);

      // 2. Price range facets
      const priceRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT
          SUM(CASE WHEN b.price < 50000 THEN 1 ELSE 0 END)::int AS under_50,
          SUM(CASE WHEN b.price >= 50000 AND b.price < 100000 THEN 1 ELSE 0 END)::int AS p50_100,
          SUM(CASE WHEN b.price >= 100000 AND b.price < 200000 THEN 1 ELSE 0 END)::int AS p100_200,
          SUM(CASE WHEN b.price >= 200000 THEN 1 ELSE 0 END)::int AS over_200
        FROM books b
        WHERE ${baseWhere}
      `);

      // 3. Rating facets
      const ratingRows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT
          SUM(CASE WHEN b.avg_rating >= 3 THEN 1 ELSE 0 END)::int AS r3,
          SUM(CASE WHEN b.avg_rating >= 4 THEN 1 ELSE 0 END)::int AS r4,
          SUM(CASE WHEN b.avg_rating >= 5 THEN 1 ELSE 0 END)::int AS r5
        FROM books b
        WHERE ${baseWhere}
      `);

      const pr = priceRows[0] || {};
      const rr = ratingRows[0] || {};

      return {
        categories: catRows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, count: r.count })),
        priceRanges: [
          { key: 'under_50', to: 50000, count: pr.under_50 || 0 },
          { key: '50_100', from: 50000, to: 100000, count: pr.p50_100 || 0 },
          { key: '100_200', from: 100000, to: 200000, count: pr.p100_200 || 0 },
          { key: 'over_200', from: 200000, count: pr.over_200 || 0 },
        ],
        ratings: [
          { key: 'rating_3', from: 3, count: rr.r3 || 0 },
          { key: 'rating_4', from: 4, count: rr.r4 || 0 },
          { key: 'rating_5', from: 5, count: rr.r5 || 0 },
        ],
      };
    } catch {
      return { categories: [], priceRanges: [], ratings: [] };
    }
  }


  private async postgresSuggest(queryText: string) {
    const terms = this.queryTerms(queryText);
    const books = await this.prisma.book.findMany({
      where: {
        is_active: true,
        AND: terms.map((term) => ({
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { isbn: { contains: term, mode: 'insensitive' } },
            {
              book_authors: {
                some: {
                  author: { name: { contains: term, mode: 'insensitive' } },
                },
              },
            },
          ],
        })),
      },
      take: 8,
      include: this.bookInclude(),
      orderBy: { sold_count: 'desc' },
    });

    const data = books.map((book) => this.formatSuggestionFromPrisma(book));
    return { data, meta: { total: data.length, source: 'postgres' } };
  }

  private buildPrismaWhere(filters: SearchFilters) {
    const where: any = { is_active: true };
    const and: any[] = [];
    const ids = this.splitCsv(filters.ids);
    const minPrice = this.optionalNumber(filters.minPrice);
    const maxPrice = this.optionalNumber(filters.maxPrice);
    const rating = this.optionalNumber(filters.rating);

    if (ids.length) where.book_id = { in: ids };
    if (filters.lang) where.language = filters.lang;
    if (filters.author) {
      where.book_authors = { some: { author_id: filters.author } };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }
    if (filters.category) {
      const category = filters.category.trim();
      const categoryConditions: any[] = [
        { slug: category },
        { name: { equals: category, mode: 'insensitive' } },
      ];
      if (this.isUuid(category)) {
        categoryConditions.unshift({ category_id: category });
      }

      where.book_categories = {
        some: {
          category: {
            OR: categoryConditions,
          },
        },
      };
    }
    if (rating !== undefined) {
      where.avg_rating = { gte: rating };
    }

    const terms = this.queryTerms(filters.q);
    if (terms.length) {
      and.push(
        ...terms.map((term) => ({
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { isbn: { contains: term, mode: 'insensitive' } },
            {
              book_authors: {
                some: {
                  author: { name: { contains: term, mode: 'insensitive' } },
                },
              },
            },
            {
              publisher: {
                is: { name: { contains: term, mode: 'insensitive' } },
              },
            },
          ],
        })),
      );
    }

    if (and.length) where.AND = and;
    return where;
  }

  private buildPrismaOrderBy(sort?: string): any {
    if (sort === 'bestseller') return { sold_count: 'desc' };
    if (sort === 'price_asc') return { price: 'asc' };
    if (sort === 'price_desc') return { price: 'desc' };
    if (sort === 'rating') return { avg_rating: 'desc' };
    return { created_at: 'desc' };
  }

  private bookInclude() {
    return {
      book_categories: {
        include: { category: { include: { parent: true } } },
      },
      book_authors: { include: { author: true } },
      publisher: true,
    };
  }

  private toDocument(book: any): SearchDocument {
    const categoryObjects =
      book.book_categories?.map((bc: any) => ({
        category_id: bc.category.category_id,
        name: bc.category.name,
        slug: bc.category.slug,
      })) ?? [];
    const authors = book.book_authors?.map((ba: any) => ba.author.name) ?? [];

    return {
      book_id: book.book_id,
      isbn: book.isbn,
      slug: book.slug,
      title: book.title,
      authors,
      author_ids: book.book_authors?.map((ba: any) => ba.author_id) ?? [],
      publisher: book.publisher?.name ?? null,
      description: book.description,
      categories: categoryObjects.map((category) => category.name),
      category_ids: categoryObjects.map((category) => category.category_id),
      category_slugs: categoryObjects.map((category) => category.slug),
      category_facets: categoryObjects.map(
        (category) =>
          `${category.category_id}|||${category.slug}|||${category.name}`,
      ),
      category_objects: categoryObjects,
      price: Number(book.price ?? 0),
      compare_price:
        book.compare_price === null || book.compare_price === undefined
          ? null
          : Number(book.compare_price),
      avg_rating: Number(book.avg_rating ?? 0),
      rating_count: Number(book.rating_count ?? 0),
      sold_count: Number(book.sold_count ?? 0),
      stock_qty: Number(book.stock_qty ?? 0),
      language: book.language,
      cover_url: book.cover_url,
      is_active: book.is_active,
      created_at: book.created_at.toISOString(),
    };
  }

  private formatSource(source?: SearchDocument) {
    if (!source) return null;
    return {
      book_id: source.book_id,
      isbn: source.isbn,
      slug: source.slug,
      title: source.title,
      description: source.description,
      price: source.price,
      compare_price: source.compare_price,
      stock_qty: source.stock_qty,
      sold_count: source.sold_count,
      avg_rating: source.avg_rating,
      rating_count: source.rating_count,
      language: source.language,
      cover_url: source.cover_url,
      created_at: source.created_at,
      category: source.categories?.[0] ?? 'Tat ca',
      categories: source.category_objects ?? [],
      author: source.authors?.join(', ') || 'Khuyet danh',
      authors: source.authors?.map((name) => ({ name })) ?? [],
      publisher: source.publisher || 'Dang cap nhat',
    };
  }

  private formatPrismaBook(book: any) {
    const { book_categories, book_authors, publisher, ...rest } = book;
    const primaryCat = book_categories?.[0]?.category;
    const rootCategory =
      primaryCat?.parent?.name || primaryCat?.name || 'Tat ca';
    return {
      ...rest,
      category: rootCategory,
      categories: book_categories?.map((bc: any) => bc.category) ?? [],
      author:
        book_authors?.map((ba: any) => ba.author.name).join(', ') ||
        'Khuyet danh',
      authors: book_authors?.map((ba: any) => ba.author) ?? [],
      publisher: publisher?.name || 'Dang cap nhat',
      publisher_id: publisher?.publisher_id,
    };
  }

  private formatSuggestion(source?: SearchDocument | null) {
    return {
      book_id: source?.book_id,
      slug: source?.slug,
      title: source?.title,
      author: source?.authors?.join(', ') || 'Khuyet danh',
      price: source?.price ?? 0,
      cover_url: source?.cover_url ?? null,
    };
  }

  private formatSuggestionFromPrisma(book: any) {
    return {
      book_id: book.book_id,
      slug: book.slug,
      title: book.title,
      author:
        book.book_authors?.map((ba: any) => ba.author.name).join(', ') ||
        'Khuyet danh',
      price: Number(book.price ?? 0),
      cover_url: book.cover_url,
    };
  }

  private normalizeHighlight(highlight?: Record<string, string[]>) {
    if (!highlight) return {};
    return {
      title: highlight.title?.[0],
      author: highlight.authors?.[0],
      description: highlight.description?.[0],
    };
  }

  private formatAggregations(aggregations: any) {
    const categoryBuckets = aggregations?.categories?.buckets ?? [];
    const priceBuckets = aggregations?.price_ranges?.buckets ?? [];
    const ratingBuckets = aggregations?.rating_ranges?.buckets ?? [];

    return {
      categories: categoryBuckets.map((bucket: any) => {
        const [id, slug, name] = String(bucket.key).split('|||');
        return {
          id,
          slug,
          name,
          count: bucket.doc_count,
        };
      }),
      priceRanges: priceBuckets.map((bucket: any) => ({
        key: bucket.key,
        from: bucket.from,
        to: bucket.to,
        count: bucket.doc_count,
      })),
      ratings: ratingBuckets.map((bucket: any) => ({
        key: bucket.key,
        from: bucket.from,
        count: bucket.doc_count,
      })),
    };
  }

  private buildPostgresFacets(books: any[]) {
    const categories = new Map<
      string,
      { id: string; slug: string; name: string; count: number }
    >();
    const priceRanges = [
      { key: 'under_50', to: 50000, count: 0 },
      { key: '50_100', from: 50000, to: 100000, count: 0 },
      { key: '100_200', from: 100000, to: 200000, count: 0 },
      { key: 'over_200', from: 200000, count: 0 },
    ];
    const ratings = [
      { key: 'rating_5', from: 5, count: 0 },
      { key: 'rating_4', from: 4, count: 0 },
      { key: 'rating_3', from: 3, count: 0 },
    ];

    for (const book of books) {
      for (const bc of book.book_categories ?? []) {
        const category = bc.category;
        if (!category) continue;
        const existing = categories.get(category.category_id);
        if (existing) existing.count += 1;
        else {
          categories.set(category.category_id, {
            id: category.category_id,
            slug: category.slug,
            name: category.name,
            count: 1,
          });
        }
      }

      const price = Number(book.price ?? 0);
      if (price < 50000) priceRanges[0].count += 1;
      else if (price < 100000) priceRanges[1].count += 1;
      else if (price < 200000) priceRanges[2].count += 1;
      else priceRanges[3].count += 1;

      const avgRating = Number(book.avg_rating ?? 0);
      if (avgRating >= 5) ratings[0].count += 1;
      if (avgRating >= 4) ratings[1].count += 1;
      if (avgRating >= 3) ratings[2].count += 1;
    }

    return {
      categories: Array.from(categories.values()).sort(
        (left, right) => right.count - left.count,
      ),
      priceRanges,
      ratings,
    };
  }

  private extractCorrection(suggest: any, queryText?: string) {
    const text = suggest?.did_you_mean?.[0]?.options?.[0]?.text;
    if (!text || !queryText) return null;
    return text.toLowerCase() === queryText.toLowerCase() ? null : text;
  }

  private queryTerms(q?: string) {
    return (q ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((term) => term.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  private splitCsv(value?: string) {
    return (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private positiveInt(value: unknown, fallback: number) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue < 1) return fallback;
    return numberValue;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private isNotFound(error: any) {
    return error?.meta?.statusCode === 404 || error?.statusCode === 404;
  }

  private looksLikeMissingIcu(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('icu') ||
      message.includes('unknown tokenizer') ||
      message.includes('unknown filter')
    );
  }
}
