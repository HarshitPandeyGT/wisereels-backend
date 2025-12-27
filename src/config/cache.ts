import NodeCache from 'node-cache';
import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

type CacheProvider = 'REDIS' | 'IN-MEMORY';

interface ICacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  getProvider(): CacheProvider;
}

class CacheService implements ICacheService {
  private redisClient: RedisClientType | null = null;
  private inMemoryCache: NodeCache;
  private provider: CacheProvider = 'IN-MEMORY';

  constructor() {
    // Initialize in-memory cache as fallback
    this.inMemoryCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
    // Initialize Redis asynchronously (non-blocking)
    this.initializeRedis().catch((err) => {
      logger.warn('Failed to initialize Redis:', err);
    });
  }

  private async initializeRedis(): Promise<void> {
    // Check if REDIS_URL is provided
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.warn(
        '⚠️  REDIS_URL not provided. Using IN-MEMORY cache as fallback.'
      );
      logger.info('Cache initialized: IN-MEMORY');
      this.provider = 'IN-MEMORY';
      return;
    }

    try {
      this.redisClient = createClient({ url: redisUrl }) as any;

      // Setup error handler before connecting
      (this.redisClient as any).on('error', (err: Error) => {
        logger.error('Redis error, falling back to in-memory cache:', err);
        this.redisClient = null;
        this.provider = 'IN-MEMORY';
      });

      (this.redisClient as any).on('disconnect', () => {
        logger.warn('Redis disconnected, using in-memory cache');
        this.provider = 'IN-MEMORY';
      });

      await (this.redisClient as any).connect();
      logger.info('Cache initialized: REDIS');
      this.provider = 'REDIS';
    } catch (error) {
      logger.warn(
        '⚠️  Redis connection failed, falling back to in-memory cache:',
        error instanceof Error ? error.message : error
      );
      logger.info('Cache initialized: IN-MEMORY');
      this.redisClient = null;
      this.provider = 'IN-MEMORY';
    }
  }

  async get(key: string): Promise<any> {
    try {
      if (this.redisClient) {
        const value = await (this.redisClient as any).get(key);
        return value ? JSON.parse(value) : null;
      } else {
        const value = this.inMemoryCache.get(key);
        return value || null;
      }
    } catch (error) {
      logger.error(`Error retrieving cache key "${key}":`, error);
      return null;
    }
  }

  async set(
    key: string,
    value: any,
    ttlSeconds: number = 600
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);

      if (this.redisClient) {
        await (this.redisClient as any).setEx(key, ttlSeconds, serialized);
      } else {
        this.inMemoryCache.set(key, value, ttlSeconds);
      }
    } catch (error) {
      logger.error(`Error setting cache key "${key}":`, error);
      // Don't throw - caching failure shouldn't break the app
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redisClient) {
        await (this.redisClient as any).del(key);
      } else {
        this.inMemoryCache.del(key);
      }
    } catch (error) {
      logger.error(`Error deleting cache key "${key}":`, error);
      // Don't throw - cache deletion failure shouldn't break the app
    }
  }

  async close(): Promise<void> {
    try {
      if (this.redisClient) {
        await (this.redisClient as any).quit();
        logger.info('Redis connection closed');
      }
      this.inMemoryCache.flushAll();
      logger.info('In-memory cache flushed');
    } catch (error) {
      logger.error('Error closing cache:', error);
    }
  }

  getProvider(): CacheProvider {
    return this.provider;
  }

  getStats() {
    return {
      provider: this.provider,
      redisConnected: this.redisClient !== null,
      inMemoryKeys: this.inMemoryCache.keys().length,
    };
  }
}

// Export singleton instance
export const cache = new CacheService();
export type { ICacheService };
