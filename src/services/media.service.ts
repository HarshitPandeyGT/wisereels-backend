import { v4 as uuidv4 } from 'uuid';
import { db, pool } from '../config/database';
import { cache } from '../config/cache';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface SavedPost {
  id: string;
  user_id: string;
  video_id: string;
  created_at: Date;
}

export interface HiddenPost {
  id: string;
  user_id: string;
  video_id: string;
  created_at: Date;
}

export interface ContentReport {
  id: string;
  reporter_id: string;
  reported_id?: string;
  content_type: 'video' | 'comment' | 'story' | 'profile';
  content_id: string;
  reason: string;
  description?: string;
  is_reviewed: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  created_at: Date;
  updated_at: Date;
}

class MediaService {
  private static instance: MediaService;

  private constructor() {}

  public static getInstance(): MediaService {
    if (!MediaService.instance) {
      MediaService.instance = new MediaService();
    }
    return MediaService.instance;
  }

  /**
   * Save a video/post
   */
  async savePost(userId: string, videoId: string): Promise<SavedPost> {
    const client = await pool.connect();
    try {
      // Check if already saved
      const existsQuery = 'SELECT id FROM saved_posts WHERE user_id = $1 AND video_id = $2';
      const existsResult = await client.query(existsQuery, [userId, videoId]);

      if (existsResult.rows.length > 0) {
        throw new AppError(400, 'Post already saved');
      }

      // Check if video exists
      const videoQuery = 'SELECT id FROM videos WHERE id = $1';
      const videoResult = await client.query(videoQuery, [videoId]);

      if (videoResult.rows.length === 0) {
        throw new AppError(404, 'Video not found');
      }

      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO saved_posts (id, user_id, video_id, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;

      const result = await client.query(query, [id, userId, videoId, now]);

      // Invalidate cache
      await cache.del(`saved:${userId}`);

      logger.info('Post saved', { userId, videoId });

      return result.rows[0];
    } catch (error) {
      logger.error('Error saving post', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Unsave a video/post
   */
  async unsavePost(userId: string, videoId: string): Promise<void> {
    const client = await pool.connect();
    try {
      const query = 'DELETE FROM saved_posts WHERE user_id = $1 AND video_id = $2';

      const result = await client.query(query, [userId, videoId]);

      if (result.rowCount === 0) {
        throw new AppError(404, 'Saved post not found');
      }

      // Invalidate cache
      await cache.del(`saved:${userId}`);

      logger.info('Post unsaved', { userId, videoId });
    } catch (error) {
      logger.error('Error unsaving post', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get saved posts for user
   */
  async getSavedPosts(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const cacheKey = `saved:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT v.*, sp.created_at as saved_at, u.username, u.profile_pic_url, u.follower_count,
               COUNT(DISTINCT l.id) as likes_count,
               COUNT(DISTINCT c.id) as comments_count
        FROM saved_posts sp
        JOIN videos v ON sp.video_id = v.id
        JOIN users u ON v.creator_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        WHERE sp.user_id = $1 AND v.is_deleted = false
        GROUP BY v.id, sp.created_at, u.id
        ORDER BY sp.created_at DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      // Cache for 5 minutes
      await cache.set(cacheKey, result.rows, 300);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching saved posts', { error });
      throw new AppError(500, 'Failed to fetch saved posts');
    }
  }

  /**
   * Check if post is saved
   */
  async isPostSaved(userId: string, videoId: string): Promise<boolean> {
    try {
      const query = 'SELECT id FROM saved_posts WHERE user_id = $1 AND video_id = $2 LIMIT 1';
      const result = await pool.query(query, [userId, videoId]);

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking if post is saved', { error });
      throw new AppError(500, 'Failed to check saved status');
    }
  }

  /**
   * Hide a post from feed
   */
  async hidePost(userId: string, videoId: string): Promise<HiddenPost> {
    const client = await pool.connect();
    try {
      // Check if already hidden
      const existsQuery = 'SELECT id FROM post_visibility WHERE user_id = $1 AND video_id = $2 AND is_hidden = true';
      const existsResult = await client.query(existsQuery, [userId, videoId]);

      if (existsResult.rows.length > 0) {
        throw new AppError(400, 'Post already hidden');
      }

      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO post_visibility (id, user_id, video_id, is_hidden, created_at)
        VALUES ($1, $2, $3, true, $4)
        RETURNING *;
      `;

      const result = await client.query(query, [id, userId, videoId, now]);

      // Invalidate cache
      await cache.del(`hidden:${userId}`);
      await cache.del(`feed:${userId}`);

      logger.info('Post hidden', { userId, videoId });

      return result.rows[0];
    } catch (error) {
      logger.error('Error hiding post', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Unhide a post
   */
  async unhidePost(userId: string, videoId: string): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        UPDATE post_visibility 
        SET is_hidden = false
        WHERE user_id = $1 AND video_id = $2;
      `;

      const result = await client.query(query, [userId, videoId]);

      if (result.rowCount === 0) {
        throw new AppError(404, 'Hidden post not found');
      }

      // Invalidate cache
      await cache.del(`hidden:${userId}`);
      await cache.del(`feed:${userId}`);

      logger.info('Post unhidden', { userId, videoId });
    } catch (error) {
      logger.error('Error unhiding post', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get hidden posts
   */
  async getHiddenPosts(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const cacheKey = `hidden:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT v.*, pv.created_at as hidden_at, u.username, u.profile_pic_url
        FROM post_visibility pv
        JOIN videos v ON pv.video_id = v.id
        JOIN users u ON v.creator_id = u.id
        WHERE pv.user_id = $1 AND pv.is_hidden = true
        ORDER BY pv.created_at DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      // Cache for 5 minutes
      await cache.set(cacheKey, result.rows, 300);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching hidden posts', { error });
      throw new AppError(500, 'Failed to fetch hidden posts');
    }
  }

  /**
   * Report content
   */
  async reportContent(
    reporterId: string,
    contentType: ContentReport['content_type'],
    contentId: string,
    reason: string,
    description?: string,
    reportedId?: string
  ): Promise<ContentReport> {
    const client = await pool.connect();
    try {
      // Check if already reported
      const existsQuery = `
        SELECT id FROM content_reports 
        WHERE reporter_id = $1 AND content_id = $2 AND content_type = $3 AND status IN ('pending', 'approved')
      `;
      const existsResult = await client.query(existsQuery, [reporterId, contentId, contentType]);

      if (existsResult.rows.length > 0) {
        throw new AppError(400, 'You have already reported this content');
      }

      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO content_reports 
        (id, reporter_id, reported_id, content_type, content_id, reason, description, is_reviewed, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'pending', $8, $9)
        RETURNING *;
      `;

      const result = await client.query(query, [
        id,
        reporterId,
        reportedId || null,
        contentType,
        contentId,
        reason,
        description || null,
        now,
        now,
      ]);

      logger.info('Content reported', { reporterId, contentType, contentId, reason });

      return result.rows[0];
    } catch (error) {
      logger.error('Error reporting content', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's reports
   */
  async getUserReports(userId: string, limit: number = 20, offset: number = 0): Promise<ContentReport[]> {
    try {
      const query = `
        SELECT * FROM content_reports 
        WHERE reporter_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching user reports', { error });
      throw new AppError(500, 'Failed to fetch reports');
    }
  }

  /**
   * Add to favorites (alternative to saved posts)
   */
  async addFavorite(userId: string, videoId: string): Promise<any> {
    const client = await pool.connect();
    try {
      // Check if already favorited
      const existsQuery = 'SELECT id FROM favorites WHERE user_id = $1 AND video_id = $2';
      const existsResult = await client.query(existsQuery, [userId, videoId]);

      if (existsResult.rows.length > 0) {
        throw new AppError(400, 'Already added to favorites');
      }

      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO favorites (id, user_id, video_id, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;

      const result = await client.query(query, [id, userId, videoId, now]);

      // Invalidate cache
      await cache.del(`favorites:${userId}`);

      logger.info('Video added to favorites', { userId, videoId });

      return result.rows[0];
    } catch (error) {
      logger.error('Error adding favorite', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remove from favorites
   */
  async removeFavorite(userId: string, videoId: string): Promise<void> {
    const client = await pool.connect();
    try {
      const query = 'DELETE FROM favorites WHERE user_id = $1 AND video_id = $2';

      const result = await client.query(query, [userId, videoId]);

      if (result.rowCount === 0) {
        throw new AppError(404, 'Favorite not found');
      }

      // Invalidate cache
      await cache.del(`favorites:${userId}`);

      logger.info('Video removed from favorites', { userId, videoId });
    } catch (error) {
      logger.error('Error removing favorite', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get favorites
   */
  async getFavorites(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const cacheKey = `favorites:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT v.*, f.created_at as favorited_at, u.username, u.profile_pic_url,
               COUNT(DISTINCT l.id) as likes_count,
               COUNT(DISTINCT c.id) as comments_count
        FROM favorites f
        JOIN videos v ON f.video_id = v.id
        JOIN users u ON v.creator_id = u.id
        LEFT JOIN likes l ON v.id = l.video_id
        LEFT JOIN comments c ON v.id = c.video_id
        WHERE f.user_id = $1 AND v.is_deleted = false
        GROUP BY v.id, f.created_at, u.id
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      // Cache for 5 minutes
      await cache.set(cacheKey, result.rows, 300);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching favorites', { error });
      throw new AppError(500, 'Failed to fetch favorites');
    }
  }
}

export default MediaService.getInstance();
