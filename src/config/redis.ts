import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

class RedisClient {
  private client: RedisClientType | null = null;

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        password: process.env.REDIS_PASSWORD || undefined,
      }) as any;

      await (this.client as any).connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) throw new Error('Redis not connected');
    return await (this.client as any).get(key);
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    if (expirySeconds) {
      await (this.client as any).setEx(key, expirySeconds, value);
    } else {
      await (this.client as any).set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) throw new Error('Redis not connected');
    await (this.client as any).del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.client) throw new Error('Redis not connected');
    return await (this.client as any).incr(key);
  }

  async close(): Promise<void> {
    if (this.client) {
      await (this.client as any).quit();
      logger.info('Redis connection closed');
    }
  }
}

export const redis = new RedisClient();
