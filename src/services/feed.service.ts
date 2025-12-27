import { db, pool } from '../config/database';
import { cache } from '../config/cache';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface FeedVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  creator_id: string;
  creator_name: string;
  creator_username: string;
  creator_profile_pic: string;
  creator_follower_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_liked: boolean;
  created_at: Date;
}

class FeedService {
  private static instance: FeedService;

  private constructor() {}

  public static getInstance(): FeedService {
    if (!FeedService.instance) {
      FeedService.instance = new FeedService();
    }
    return FeedService.instance;
  }

  /**
   * Get personalized feed (For You page)
   * Based on user interests, follows, and engagement history
   */
  async getPersonalizedFeed(userId: string, limit: number = 20, offset: number = 0): Promise<FeedVideo[]> {
    try {
      const cacheKey = `feed:personalized:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      // Get videos from creators user follows, plus trending videos not hidden
      const query = `
        SELECT 
          v.id, v.title, v.description, v.video_url, v.thumbnail_url,
          v.creator_id, u.username as creator_username, u.display_name as creator_name, 
          u.profile_pic_url as creator_profile_pic, u.follower_count as creator_follower_count,
          COUNT(DISTINCT l.id) as likes_count,
          COUNT(DISTINCT c.id) as comments_count,
          COUNT(DISTINCT s.id) as shares_count,
          EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = $1) as is_liked,
          v.created_at
        FROM videos v
        JOIN users u ON v.creator_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        LEFT JOIN shares s ON v.id = s.video_id
        WHERE v.is_deleted = false
          AND NOT EXISTS (SELECT 1 FROM post_visibility WHERE user_id = $1 AND video_id = v.id AND is_hidden = true)
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id)
          AND u.id IN (
            SELECT following_id FROM follows WHERE follower_id = $1
            UNION
            SELECT creator_id FROM videos WHERE view_count > 1000
          )
        GROUP BY v.id, u.id
        ORDER BY v.created_at DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      // Cache for 2 minutes
      await cache.set(cacheKey, result.rows, 120);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching personalized feed', { error });
      throw new AppError(500, 'Failed to fetch feed');
    }
  }

  /**
   * Get explore/discovery feed
   * Shows trending and popular videos
   */
  async getExploreFeed(userId: string, limit: number = 20, offset: number = 0): Promise<FeedVideo[]> {
    try {
      const cacheKey = `feed:explore:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT 
          v.id, v.title, v.description, v.video_url, v.thumbnail_url,
          v.creator_id, u.username as creator_username, u.display_name as creator_name, 
          u.profile_pic_url as creator_profile_pic, u.follower_count as creator_follower_count,
          COUNT(DISTINCT l.id) as likes_count,
          COUNT(DISTINCT c.id) as comments_count,
          COUNT(DISTINCT s.id) as shares_count,
          EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = $1) as is_liked,
          v.created_at
        FROM videos v
        JOIN users u ON v.creator_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        LEFT JOIN shares s ON v.id = s.video_id
        WHERE v.is_deleted = false
          AND NOT EXISTS (SELECT 1 FROM post_visibility WHERE user_id = $1 AND video_id = v.id AND is_hidden = true)
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id)
        GROUP BY v.id, u.id
        ORDER BY 
          (COUNT(DISTINCT l.id) + COUNT(DISTINCT c.id) + COUNT(DISTINCT s.id)) DESC,
          v.created_at DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      // Cache for 3 minutes
      await cache.set(cacheKey, result.rows, 180);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching explore feed', { error });
      throw new AppError(500, 'Failed to fetch explore feed');
    }
  }

  /**
   * Get trending videos
   */
  async getTrendingVideos(userId: string, limit: number = 20, offset: number = 0): Promise<FeedVideo[]> {
    try {
      const cacheKey = `feed:trending:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const query = `
        SELECT 
          v.id, v.title, v.description, v.video_url, v.thumbnail_url,
          v.creator_id, u.username as creator_username, u.display_name as creator_name, 
          u.profile_pic_url as creator_profile_pic, u.follower_count as creator_follower_count,
          COUNT(DISTINCT l.id) as likes_count,
          COUNT(DISTINCT c.id) as comments_count,
          COUNT(DISTINCT s.id) as shares_count,
          EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = $1) as is_liked,
          v.created_at
        FROM videos v
        JOIN users u ON v.creator_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id AND l.created_at > $4
        LEFT JOIN comments c ON v.id = c.video_id AND c.created_at > $4
        LEFT JOIN shares s ON v.id = s.video_id AND s.created_at > $4
        WHERE v.is_deleted = false
          AND v.created_at > $4
          AND NOT EXISTS (SELECT 1 FROM post_visibility WHERE user_id = $1 AND video_id = v.id AND is_hidden = true)
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id)
        GROUP BY v.id, u.id
        ORDER BY (COUNT(DISTINCT l.id) + COUNT(DISTINCT c.id) + COUNT(DISTINCT s.id)) DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [userId, limit, offset, thirtyDaysAgo]);

      // Cache for 5 minutes
      await cache.set(cacheKey, result.rows, 300);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching trending videos', { error });
      throw new AppError(500, 'Failed to fetch trending videos');
    }
  }

  /**
   * Get videos by category
   */
  async getVideosByCategory(
    userId: string,
    category: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<FeedVideo[]> {
    try {
      const cacheKey = `feed:category:${category}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT 
          v.id, v.title, v.description, v.video_url, v.thumbnail_url,
          v.creator_id, u.username as creator_username, u.display_name as creator_name, 
          u.profile_pic_url as creator_profile_pic, u.follower_count as creator_follower_count,
          COUNT(DISTINCT l.id) as likes_count,
          COUNT(DISTINCT c.id) as comments_count,
          COUNT(DISTINCT s.id) as shares_count,
          EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = $1) as is_liked,
          v.created_at
        FROM videos v
        JOIN users u ON v.creator_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        LEFT JOIN shares s ON v.id = s.video_id
        WHERE v.is_deleted = false
          AND v.category = $2
          AND NOT EXISTS (SELECT 1 FROM post_visibility WHERE user_id = $1 AND video_id = v.id AND is_hidden = true)
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id)
        GROUP BY v.id, u.id
        ORDER BY v.created_at DESC
        LIMIT $3 OFFSET $4;
      `;

      const result = await pool.query(query, [userId, category, limit, offset]);

      // Cache for 3 minutes
      await cache.set(cacheKey, result.rows, 180);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching videos by category', { error });
      throw new AppError(500, 'Failed to fetch videos by category');
    }
  }

  /**
   * Get videos by hashtag
   */
  async getVideosByHashtag(
    userId: string,
    hashtag: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<FeedVideo[]> {
    try {
      const cacheKey = `feed:hashtag:${hashtag}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT 
          v.id, v.title, v.description, v.video_url, v.thumbnail_url,
          v.creator_id, u.username as creator_username, u.display_name as creator_name, 
          u.profile_pic_url as creator_profile_pic, u.follower_count as creator_follower_count,
          COUNT(DISTINCT l.id) as likes_count,
          COUNT(DISTINCT c.id) as comments_count,
          COUNT(DISTINCT s.id) as shares_count,
          EXISTS(SELECT 1 FROM likes WHERE video_id = v.id AND user_id = $1) as is_liked,
          v.created_at
        FROM videos v
        JOIN users u ON v.creator_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        LEFT JOIN shares s ON v.id = s.video_id
        WHERE v.is_deleted = false
          AND (v.tags LIKE $2 OR v.description LIKE $2)
          AND NOT EXISTS (SELECT 1 FROM post_visibility WHERE user_id = $1 AND video_id = v.id AND is_hidden = true)
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = u.id)
        GROUP BY v.id, u.id
        ORDER BY v.created_at DESC
        LIMIT $3 OFFSET $4;
      `;

      const hashtag_pattern = `%#${hashtag}%`;
      const result = await pool.query(query, [userId, hashtag_pattern, limit, offset]);

      // Cache for 3 minutes
      await cache.set(cacheKey, result.rows, 180);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching videos by hashtag', { error });
      throw new AppError(500, 'Failed to fetch videos by hashtag');
    }
  }

  /**
   * Invalidate feed caches (call on like, comment, share, follow)
   */
  async invalidateFeedCache(userId?: string): Promise<void> {
    try {
      if (userId) {
        // Invalidate specific user's feed
        await cache.del(`feed:personalized:${userId}:*`);
      } else {
        // Invalidate all feeds (use with caution)
        await cache.del('feed:personalized:*');
        await cache.del('feed:explore:*');
        await cache.del('feed:trending:*');
        await cache.del('feed:category:*');
        await cache.del('feed:hashtag:*');
      }
      logger.info('Feed cache invalidated', { userId });
    } catch (error) {
      logger.error('Error invalidating feed cache', { error });
      // Don't throw - cache invalidation failure is not critical
    }
  }
}

export default FeedService.getInstance();
