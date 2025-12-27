import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface StoryInput {
  userId: string;
  mediaUrl: string;
  caption?: string;
  category?: string;
}

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  caption?: string;
  category?: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  viewCount: number;
  userProfile?: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface StoryInteraction {
  storyId: string;
  userId: string;
  action: 'mute' | 'report';
  reason?: string;
}

export class StoriesService {
  /**
   * Upload a new story (24-hour expiry)
   */
  async uploadStory(input: StoryInput): Promise<Story> {
    const client = await pool.connect();
    try {
      // Check if user exists
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [
        input.userId,
      ]);

      if (userCheck.rows.length === 0) {
        throw new AppError(404, 'User not found');
      }

      // Create story with 24-hour expiry
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const query = `
        INSERT INTO stories (user_id, media_url, caption, category, created_at, expires_at, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING 
          id, user_id, media_url, caption, category, created_at, expires_at, 
          is_active, view_count
      `;

      const result = await client.query(query, [
        input.userId,
        input.mediaUrl,
        input.caption || null,
        input.category || null,
        now,
        expiresAt,
      ]);

      const story = result.rows[0];

      // Increment user's story count
      await client.query('UPDATE users SET story_count = story_count + 1 WHERE id = $1', [
        input.userId,
      ]);

      logger.info('Story uploaded successfully', {
        storyId: story.id,
        userId: input.userId,
      });

      return this.formatStory(story);
    } catch (error) {
      logger.error('Error uploading story', { error, userId: input.userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active stories for home screen (24h window, following only)
   */
  async getActiveStories(userId: string, limit: number = 50): Promise<Story[]> {
    const client = await pool.connect();
    try {
      // Get stories from users being followed
      const query = `
        SELECT 
          s.id, s.user_id, s.media_url, s.caption, s.category,
          s.created_at, s.expires_at, s.is_active, s.view_count,
          u.username, u.display_name, u.avatar_url,
          ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.created_at DESC) as user_story_order
        FROM stories s
        INNER JOIN users u ON s.user_id = u.id
        INNER JOIN follows f ON s.user_id = f.following_id AND f.follower_id = $1
        LEFT JOIN story_interactions si ON s.id = si.story_id 
          AND si.user_id = $1 AND si.action = 'mute'
        WHERE s.is_active = TRUE 
          AND s.expires_at > NOW()
          AND si.id IS NULL
        ORDER BY s.user_id, s.created_at DESC
        LIMIT $2
      `;

      const result = await client.query(query, [userId, limit]);

      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        mediaUrl: row.media_url,
        caption: row.caption,
        category: row.category,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        isActive: row.is_active,
        viewCount: row.view_count,
        userProfile: {
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
      }));
    } catch (error) {
      logger.error('Error fetching active stories', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reply to a story (sends DM)
   */
  async replyToStory(storyId: string, userId: string, replyText: string): Promise<any> {
    const client = await pool.connect();
    try {
      // Get story to find creator
      const storyCheck = await client.query('SELECT user_id FROM stories WHERE id = $1', [
        storyId,
      ]);

      if (storyCheck.rows.length === 0) {
        throw new AppError(404, 'Story not found');
      }

      const storyCreatorId = storyCheck.rows[0].user_id;

      if (storyCreatorId === userId) {
        throw new AppError(400, 'Cannot reply to your own story');
      }

      // Check if story is still active
      const activeCheck = await client.query(
        'SELECT id FROM stories WHERE id = $1 AND is_active = TRUE AND expires_at > NOW()',
        [storyId]
      );

      if (activeCheck.rows.length === 0) {
        throw new AppError(410, 'Story has expired');
      }

      // Create reply
      const now = new Date();
      const query = `
        INSERT INTO story_replies (story_id, user_id, reply_text, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, story_id, user_id, reply_text, created_at, is_read
      `;

      const result = await client.query(query, [storyId, userId, replyText, now]);

      logger.info('Story reply created', {
        replyId: result.rows[0].id,
        storyId,
        userId,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error replying to story', { error, storyId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get story replies
   */
  async getStoryReplies(storyId: string, userId: string): Promise<any[]> {
    const client = await pool.connect();
    try {
      // Verify user owns the story
      const storyCheck = await client.query('SELECT user_id FROM stories WHERE id = $1', [
        storyId,
      ]);

      if (storyCheck.rows.length === 0) {
        throw new AppError(404, 'Story not found');
      }

      if (storyCheck.rows[0].user_id !== userId) {
        throw new AppError(403, 'Unauthorized');
      }

      const query = `
        SELECT 
          sr.id, sr.story_id, sr.user_id, sr.reply_text, sr.created_at,
          sr.is_read, u.username, u.display_name, u.avatar_url
        FROM story_replies sr
        INNER JOIN users u ON sr.user_id = u.id
        WHERE sr.story_id = $1
        ORDER BY sr.created_at DESC
      `;

      const result = await client.query(query, [storyId]);

      return result.rows.map((row: any) => ({
        id: row.id,
        storyId: row.story_id,
        user: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
        replyText: row.reply_text,
        createdAt: row.created_at,
        isRead: row.is_read,
      }));
    } catch (error) {
      logger.error('Error fetching story replies', { error, storyId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark story as read
   */
  async markStoryAsViewed(storyId: string, userId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE stories SET view_count = view_count + 1 
         WHERE id = $1 AND user_id != $2`,
        [storyId, userId]
      );
    } catch (error) {
      logger.error('Error marking story as viewed', { error, storyId, userId });
      // Non-critical error, don't throw
    }
  }

  /**
   * Mute stories from a user
   */
  async muteStories(storyId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      // Get story creator
      const story = await client.query('SELECT user_id FROM stories WHERE id = $1', [storyId]);

      if (story.rows.length === 0) {
        throw new AppError(404, 'Story not found');
      }

      const creatorId = story.rows[0].user_id;

      // Insert or update mute interaction
      const query = `
        INSERT INTO story_interactions (story_id, user_id, action)
        VALUES ($1, $2, 'mute')
        ON CONFLICT (story_id, user_id, action) DO NOTHING
      `;

      await client.query(query, [storyId, userId]);

      logger.info('Story muted', { storyId, userId });
    } catch (error) {
      logger.error('Error muting story', { error, storyId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Report a story
   */
  async reportStory(
    storyId: string,
    userId: string,
    reason: string,
    description?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Check story exists
      const story = await client.query('SELECT id FROM stories WHERE id = $1', [storyId]);

      if (story.rows.length === 0) {
        throw new AppError(404, 'Story not found');
      }

      // Create content report
      const query = `
        INSERT INTO content_reports 
        (reporter_id, content_type, content_id, reason, description)
        VALUES ($1, 'story', $2, $3, $4)
      `;

      await client.query(query, [userId, storyId, reason, description || null]);

      logger.info('Story reported', { storyId, userId, reason });
    } catch (error) {
      logger.error('Error reporting story', { error, storyId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get single story by ID (with user profile)
   */
  async getStoryById(storyId: string, userId?: string): Promise<Story | null> {
    try {
      const query = `
        SELECT 
          s.id, s.user_id, s.media_url, s.caption, s.category,
          s.created_at, s.expires_at, s.is_active, s.view_count,
          u.username, u.display_name, u.avatar_url
        FROM stories s
        INNER JOIN users u ON s.user_id = u.id
        WHERE s.id = $1 AND s.is_active = TRUE AND s.expires_at > NOW()
      `;

      const result = await pool.query(query, [storyId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Mark as viewed
      if (userId) {
        await this.markStoryAsViewed(storyId, userId);
      }

      return {
        id: row.id,
        userId: row.user_id,
        mediaUrl: row.media_url,
        caption: row.caption,
        category: row.category,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        isActive: row.is_active,
        viewCount: row.view_count,
        userProfile: {
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
      };
    } catch (error) {
      logger.error('Error fetching story by ID', { error, storyId });
      throw error;
    }
  }

  /**
   * Clean up expired stories (should be called via cron job)
   */
  async cleanupExpiredStories(): Promise<number> {
    try {
      const result = await pool.query(
        `UPDATE stories SET is_active = FALSE 
         WHERE expires_at <= NOW() AND is_active = TRUE`
      );

      logger.info('Expired stories cleaned up', { count: result.rowCount });

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error cleaning up expired stories', { error });
      throw error;
    }
  }

  /**
   * Helper: Format story object
   */
  private formatStory(row: any): Story {
    return {
      id: row.id,
      userId: row.user_id,
      mediaUrl: row.media_url,
      caption: row.caption,
      category: row.category,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      viewCount: row.view_count,
    };
  }
}

export default new StoriesService();
