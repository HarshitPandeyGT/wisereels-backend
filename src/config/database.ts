import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'wisereels',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed', error);
      throw error;
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    try {
      const result = await this.pool.query(text, params);
      return result.rows;
    } catch (error) {
      logger.error('Database query error', { text, error });
      throw error;
    }
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(text, params);
    return results.length > 0 ? results[0] : null;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection closed');
  }
}

export const db = new Database();

// Export the pool instance for services that need direct pool access
export { Pool } from 'pg';
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'wisereels',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
