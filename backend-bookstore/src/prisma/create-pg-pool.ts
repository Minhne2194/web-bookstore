import { Pool, type PoolConfig } from 'pg';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shouldUseSsl(databaseUrl: string): boolean {
  const explicitSsl = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (explicitSsl === 'true') return true;
  if (explicitSsl === 'false') return false;

  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
  if (sslMode === 'disable') return false;
  if (sslMode === 'require' || url.searchParams.get('ssl') === 'true') {
    return true;
  }

  return !['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

export function createPgPool(config: PoolConfig = {}): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const ssl = shouldUseSsl(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;

  return new Pool({
    connectionString,
    ssl,
    max: parsePositiveInt(process.env.DATABASE_POOL_MAX, 5),
    connectionTimeoutMillis: parsePositiveInt(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS,
      10000,
    ),
    idleTimeoutMillis: parsePositiveInt(
      process.env.DATABASE_IDLE_TIMEOUT_MS,
      30000,
    ),
    ...config,
  });
}
