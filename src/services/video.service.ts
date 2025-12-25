import { db } from '../config/database';
import { redis } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface Video {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  category: 'FINANCE' | 'HEALTH' | 'FITNESS' | 'EDUCATION' | 'ENTERTAINMENT' | 'OTHER';
  requires_verified_creator: boolean;
  video_url: string;
  thumbnail_url?: string;
  duration_seconds: number;
  hls_playlist_url?: string;
  video_status: 'PROCESSING' | 'PUBLISHED' | 'DELETED' | 'FLAGGED';
  view_count: number;
  published_at?: Date;
}

class VideoService {
  async uploadVideo(
    creatorId: string,
    title: string,
    description: string | undefined,
    category: string,
    durationSeconds: number
  ): Promise<Video> {
    const videoId = uuidv4();
    const now = new Date();
    const requiresVerified = ['FINANCE', 'HEALTH', 'FITNESS'].includes(category);

    const query = `
      INSERT INTO videos (
        id, creator_id, title, description, category,
        requires_verified_creator, video_url, duration_seconds,
        video_status, view_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    try {
      const video = await db.queryOne<Video>(query, [
        videoId,
        creatorId,
        title,
        description,
        category,
        requiresVerified,
        `https://videos.wisereels.com/${videoId}`,
        durationSeconds,
        'PROCESSING',
        0,
        now,
        now,
      ]);

      if (!video) throw new Error('Video creation failed');

      logger.info(`Video uploaded: ${videoId}`);
      return video;
    } catch (error) {
      logger.error('Video upload failed', error);
      throw error;
    }
  }

  async publishVideo(videoId: string): Promise<Video> {
    const now = new Date();
    const query = `
      UPDATE videos 
      SET video_status = $1, published_at = $2, updated_at = $3
      WHERE id = $4
      RETURNING *
    `;

    try {
      const video = await db.queryOne<Video>(query, [
        'PUBLISHED',
        now,
        now,
        videoId,
      ]);

      if (!video) throw new Error('Video not found');

      // Invalidate cache
      await redis.del(`video:${videoId}`);

      logger.info(`Video published: ${videoId}`);
      return video;
    } catch (error) {
      logger.error('Video publication failed', error);
      throw error;
    }
  }

  async getVideoById(videoId: string): Promise<Video | null> {
    const cached = await redis.get(`video:${videoId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const query = `SELECT * FROM videos WHERE id = $1 AND video_status = $2`;
    const video = await db.queryOne<Video>(query, [videoId, 'PUBLISHED']);

    if (video) {
      await redis.set(`video:${videoId}`, JSON.stringify(video), 300);
    }

    return video;
  }

  async getVideosByCreator(creatorId: string, limit: number = 20, offset: number = 0): Promise<Video[]> {
    const query = `
      SELECT * FROM videos 
      WHERE creator_id = $1 AND video_status = $2
      ORDER BY published_at DESC
      LIMIT $3 OFFSET $4
    `;

    return db.query<Video>(query, [creatorId, 'PUBLISHED', limit, offset]);
  }

  async incrementViewCount(videoId: string): Promise<void> {
    const query = `
      UPDATE videos 
      SET view_count = view_count + 1, updated_at = $1
      WHERE id = $2
    `;

    try {
      await db.query(query, [new Date(), videoId]);
      await redis.del(`video:${videoId}`); // Invalidate cache
    } catch (error) {
      logger.error('View count increment failed', error);
      throw error;
    }
  }

  async likeVideo(userId: string, videoId: string): Promise<{ message: string }> {
    // Check if already liked
    const existing = await db.queryOne(
      `SELECT * FROM engagements WHERE user_id = $1 AND video_id = $2 AND engagement_type = 'LIKE'`,
      [userId, videoId]
    );
    if (existing) {
      // Unlike (remove like)
      await db.query(
        `DELETE FROM engagements WHERE user_id = $1 AND video_id = $2 AND engagement_type = 'LIKE'`,
        [userId, videoId]
      );
      await db.query(
        `UPDATE videos SET like_count = like_count - 1 WHERE id = $1 AND like_count > 0`,
        [videoId]
      );
      return { message: 'Like removed' };
    } else {
      // Like
      await db.query(
        `INSERT INTO engagements (id, user_id, video_id, engagement_type, created_at) VALUES ($1, $2, $3, 'LIKE', $4)`,
        [uuidv4(), userId, videoId, new Date()]
      );
      await db.query(
        `UPDATE videos SET like_count = like_count + 1 WHERE id = $1`,
        [videoId]
      );
      return { message: 'Video liked' };
    }
  }

  async commentOnVideo(userId: string, videoId: string, comment: string): Promise<{ commentId: string; comment: string; createdAt: Date }> {
    // Store comment as engagement (extend schema if you want comment text in a separate table)
    const commentId = uuidv4();
    const createdAt = new Date();
    await db.query(
      `INSERT INTO engagements (id, user_id, video_id, engagement_type, created_at, comment_text) VALUES ($1, $2, $3, 'COMMENT', $4, $5)`,
      [commentId, userId, videoId, createdAt, comment]
    );
    await db.query(
      `UPDATE videos SET comment_count = comment_count + 1 WHERE id = $1`,
      [videoId]
    );
    return { commentId, comment, createdAt };
  }
}

export const videoService = new VideoService();
