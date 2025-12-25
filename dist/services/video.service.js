"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoService = void 0;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class VideoService {
    async uploadVideo(creatorId, title, description, category, durationSeconds) {
        const videoId = (0, uuid_1.v4)();
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
            const video = await database_1.db.queryOne(query, [
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
            if (!video)
                throw new Error('Video creation failed');
            logger_1.logger.info(`Video uploaded: ${videoId}`);
            return video;
        }
        catch (error) {
            logger_1.logger.error('Video upload failed', error);
            throw error;
        }
    }
    async publishVideo(videoId) {
        const now = new Date();
        const query = `
      UPDATE videos 
      SET video_status = $1, published_at = $2, updated_at = $3
      WHERE id = $4
      RETURNING *
    `;
        try {
            const video = await database_1.db.queryOne(query, [
                'PUBLISHED',
                now,
                now,
                videoId,
            ]);
            if (!video)
                throw new Error('Video not found');
            // Invalidate cache
            await redis_1.redis.del(`video:${videoId}`);
            logger_1.logger.info(`Video published: ${videoId}`);
            return video;
        }
        catch (error) {
            logger_1.logger.error('Video publication failed', error);
            throw error;
        }
    }
    async getVideoById(videoId) {
        const cached = await redis_1.redis.get(`video:${videoId}`);
        if (cached) {
            return JSON.parse(cached);
        }
        const query = `SELECT * FROM videos WHERE id = $1 AND video_status = $2`;
        const video = await database_1.db.queryOne(query, [videoId, 'PUBLISHED']);
        if (video) {
            await redis_1.redis.set(`video:${videoId}`, JSON.stringify(video), 300);
        }
        return video;
    }
    async getVideosByCreator(creatorId, limit = 20, offset = 0) {
        const query = `
      SELECT * FROM videos 
      WHERE creator_id = $1 AND video_status = $2
      ORDER BY published_at DESC
      LIMIT $3 OFFSET $4
    `;
        return database_1.db.query(query, [creatorId, 'PUBLISHED', limit, offset]);
    }
    async incrementViewCount(videoId) {
        const query = `
      UPDATE videos 
      SET view_count = view_count + 1, updated_at = $1
      WHERE id = $2
    `;
        try {
            await database_1.db.query(query, [new Date(), videoId]);
            await redis_1.redis.del(`video:${videoId}`); // Invalidate cache
        }
        catch (error) {
            logger_1.logger.error('View count increment failed', error);
            throw error;
        }
    }
    async likeVideo(userId, videoId) {
        // Check if already liked
        const existing = await database_1.db.queryOne(`SELECT * FROM engagements WHERE user_id = $1 AND video_id = $2 AND engagement_type = 'LIKE'`, [userId, videoId]);
        if (existing) {
            // Unlike (remove like)
            await database_1.db.query(`DELETE FROM engagements WHERE user_id = $1 AND video_id = $2 AND engagement_type = 'LIKE'`, [userId, videoId]);
            await database_1.db.query(`UPDATE videos SET like_count = like_count - 1 WHERE id = $1 AND like_count > 0`, [videoId]);
            return { message: 'Like removed' };
        }
        else {
            // Like
            await database_1.db.query(`INSERT INTO engagements (id, user_id, video_id, engagement_type, created_at) VALUES ($1, $2, $3, 'LIKE', $4)`, [(0, uuid_1.v4)(), userId, videoId, new Date()]);
            await database_1.db.query(`UPDATE videos SET like_count = like_count + 1 WHERE id = $1`, [videoId]);
            return { message: 'Video liked' };
        }
    }
    async commentOnVideo(userId, videoId, comment) {
        // Store comment as engagement (extend schema if you want comment text in a separate table)
        const commentId = (0, uuid_1.v4)();
        const createdAt = new Date();
        await database_1.db.query(`INSERT INTO engagements (id, user_id, video_id, engagement_type, created_at, comment_text) VALUES ($1, $2, $3, 'COMMENT', $4, $5)`, [commentId, userId, videoId, createdAt, comment]);
        await database_1.db.query(`UPDATE videos SET comment_count = comment_count + 1 WHERE id = $1`, [videoId]);
        return { commentId, comment, createdAt };
    }
}
exports.videoService = new VideoService();
