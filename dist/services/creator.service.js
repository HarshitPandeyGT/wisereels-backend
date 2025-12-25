"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creatorService = void 0;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class CreatorService {
    async initializeCreator(userId) {
        const creatorId = (0, uuid_1.v4)();
        const now = new Date();
        const query = `
      INSERT INTO creators (
        id, user_id, credential_type, verification_status,
        can_post_restricted_content, subscriber_count, total_views,
        total_earnings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
        try {
            const creator = await database_1.db.queryOne(query, [
                creatorId,
                userId,
                'NONE',
                'PENDING',
                false,
                0,
                0,
                0,
                now,
                now,
            ]);
            if (!creator)
                throw new Error('Creator initialization failed');
            logger_1.logger.info(`Creator initialized: ${creatorId}`);
            return creator;
        }
        catch (error) {
            logger_1.logger.error('Creator initialization failed', error);
            throw error;
        }
    }
    async submitCredentials(userId, credentialType, credentialId, issuingBody, expiryDate) {
        const query = `
      UPDATE creators 
      SET credential_type = $1, credential_id = $2, 
          issuing_body = $3, expiry_date = $4,
          verification_status = $5, updated_at = $6
      WHERE user_id = $7
      RETURNING *
    `;
        try {
            const creator = await database_1.db.queryOne(query, [
                credentialType,
                credentialId,
                issuingBody,
                expiryDate,
                'PENDING',
                new Date(),
                userId,
            ]);
            if (!creator)
                throw new Error('Creator not found');
            logger_1.logger.info(`Credentials submitted for user: ${userId}`);
            return creator;
        }
        catch (error) {
            logger_1.logger.error('Credential submission failed', error);
            throw error;
        }
    }
    async verifyCreator(userId, status, verifiedBy) {
        const now = new Date();
        const query = `
      UPDATE creators 
      SET verification_status = $1, verified_at = $2, verified_by = $3,
          can_post_restricted_content = $4, updated_at = $5
      WHERE user_id = $6
      RETURNING *
    `;
        try {
            const creator = await database_1.db.queryOne(query, [
                status,
                status === 'VERIFIED' ? now : null,
                status === 'VERIFIED' ? verifiedBy : null,
                status === 'VERIFIED',
                now,
                userId,
            ]);
            if (!creator)
                throw new Error('Creator not found');
            // Invalidate cache
            await redis_1.redis.del(`creator:${userId}`);
            logger_1.logger.info(`Creator verification updated for user: ${userId}`);
            return creator;
        }
        catch (error) {
            logger_1.logger.error('Creator verification failed', error);
            throw error;
        }
    }
    async getCreatorByUserId(userId) {
        // Try cache first
        const cached = await redis_1.redis.get(`creator:${userId}`);
        if (cached) {
            return JSON.parse(cached);
        }
        const query = `SELECT * FROM creators WHERE user_id = $1`;
        const creator = await database_1.db.queryOne(query, [userId]);
        if (creator) {
            await redis_1.redis.set(`creator:${userId}`, JSON.stringify(creator), 3600);
        }
        return creator;
    }
    async canPostRestrictedContent(userId) {
        const creator = await this.getCreatorByUserId(userId);
        return creator?.can_post_restricted_content || false;
    }
    async updateProfile(userId, fields) {
        // Build dynamic update query
        const updates = [];
        const values = [];
        let idx = 1;
        if (fields.username) {
            updates.push(`username = $${idx++}`);
            values.push(fields.username);
        }
        if (fields.displayName) {
            updates.push(`display_name = $${idx++}`);
            values.push(fields.displayName);
        }
        if (fields.firstName) {
            updates.push(`first_name = $${idx++}`);
            values.push(fields.firstName);
        }
        if (fields.lastName) {
            updates.push(`last_name = $${idx++}`);
            values.push(fields.lastName);
        }
        if (fields.profilePictureUrl) {
            updates.push(`profile_picture_url = $${idx++}`);
            values.push(fields.profilePictureUrl);
        }
        if (fields.bio) {
            updates.push(`bio = $${idx++}`);
            values.push(fields.bio);
        }
        if (updates.length === 0)
            throw new Error('No fields to update');
        updates.push(`updated_at = $${idx}`);
        values.push(new Date());
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx + 1} RETURNING *`;
        values.push(userId);
        const updated = await database_1.db.queryOne(query, values);
        if (!updated)
            throw new Error('Profile update failed');
        return updated;
    }
    async updateCredentials(userId, credentialType, credentialId, issuingBody, expiryDate) {
        // Find creator by userId
        const creator = await database_1.db.queryOne('SELECT * FROM creators WHERE user_id = $1', [userId]);
        if (!creator)
            throw new Error('Creator profile not found');
        // Update credentials and reset verification status
        const updated = await database_1.db.queryOne(`UPDATE creators SET credential_type = $1, credential_id = $2, issuing_body = $3, expiry_date = $4, verification_status = 'PENDING', verified_at = NULL, updated_at = $5 WHERE user_id = $6 RETURNING *`, [credentialType, credentialId, issuingBody, expiryDate, new Date(), userId]);
        if (!updated)
            throw new Error('Credential update failed');
        // Optionally, log audit trail here
        return updated;
    }
    async getUserProfile(userId) {
        const user = await database_1.db.queryOne('SELECT * FROM users WHERE id = $1', [userId]);
        if (!user)
            throw new Error('User not found');
        return user;
    }
    async getCreatorById(creatorId) {
        const creator = await database_1.db.queryOne('SELECT * FROM creators WHERE id = $1', [creatorId]);
        if (!creator)
            throw new Error('Creator not found');
        return creator;
    }
}
exports.creatorService = new CreatorService();
