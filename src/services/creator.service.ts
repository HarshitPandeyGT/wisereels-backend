import { db } from '../config/database';
import { cache } from '../config/cache';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface Creator {
  id: string;
  user_id: string;
  credential_type: 'CA' | 'DOCTOR' | 'TRAINER' | 'NONE';
  credential_id?: string;
  issuing_body?: string;
  expiry_date?: Date;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  verified_at?: Date;
  can_post_restricted_content: boolean;
  subscriber_count: number;
  total_views: number;
  total_earnings: number;
}

class CreatorService {
  async initializeCreator(userId: string): Promise<Creator> {
    const creatorId = uuidv4();
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
      const creator = await db.queryOne<Creator>(query, [
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

      if (!creator) throw new Error('Creator initialization failed');

      logger.info(`Creator initialized: ${creatorId}`);
      return creator;
    } catch (error) {
      logger.error('Creator initialization failed', error);
      throw error;
    }
  }

  async submitCredentials(
    userId: string,
    credentialType: 'CA' | 'DOCTOR' | 'TRAINER',
    credentialId: string,
    issuingBody: string,
    expiryDate: Date
  ): Promise<Creator> {
    const query = `
      UPDATE creators 
      SET credential_type = $1, credential_id = $2, 
          issuing_body = $3, expiry_date = $4,
          verification_status = $5, updated_at = $6
      WHERE user_id = $7
      RETURNING *
    `;

    try {
      const creator = await db.queryOne<Creator>(query, [
        credentialType,
        credentialId,
        issuingBody,
        expiryDate,
        'PENDING',
        new Date(),
        userId,
      ]);

      if (!creator) throw new Error('Creator not found');

      logger.info(`Credentials submitted for user: ${userId}`);
      return creator;
    } catch (error) {
      logger.error('Credential submission failed', error);
      throw error;
    }
  }

  async verifyCreator(
    userId: string,
    status: 'VERIFIED' | 'REJECTED',
    verifiedBy: string
  ): Promise<Creator> {
    const now = new Date();
    const query = `
      UPDATE creators 
      SET verification_status = $1, verified_at = $2, verified_by = $3,
          can_post_restricted_content = $4, updated_at = $5
      WHERE user_id = $6
      RETURNING *
    `;

    try {
      const creator = await db.queryOne<Creator>(query, [
        status,
        status === 'VERIFIED' ? now : null,
        status === 'VERIFIED' ? verifiedBy : null,
        status === 'VERIFIED',
        now,
        userId,
      ]);

      if (!creator) throw new Error('Creator not found');

      // Invalidate cache
      await cache.del(`creator:${userId}`);

      logger.info(`Creator verification updated for user: ${userId}`);
      return creator;
    } catch (error) {
      logger.error('Creator verification failed', error);
      throw error;
    }
  }

  async getCreatorByUserId(userId: string): Promise<Creator | null> {
    // Try cache first
    const cached = await cache.get(`creator:${userId}`);
    if (cached) {
      return cached;
    }

    const query = `SELECT * FROM creators WHERE user_id = $1`;
    const creator = await db.queryOne<Creator>(query, [userId]);

    if (creator) {
      await cache.set(`creator:${userId}`, creator, 3600);
    }

    return creator;
  }

  async canPostRestrictedContent(userId: string): Promise<boolean> {
    const creator = await this.getCreatorByUserId(userId);
    return creator?.can_post_restricted_content || false;
  }

  async updateProfile(userId: string, fields: {
    username?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    profilePictureUrl?: string;
    bio?: string;
  }): Promise<any> {
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
    if (updates.length === 0) throw new Error('No fields to update');
    updates.push(`updated_at = $${idx}`);
    values.push(new Date());
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx + 1} RETURNING *`;
    values.push(userId);
    const updated = await db.queryOne(query, values);
    if (!updated) throw new Error('Profile update failed');
    return updated;
  }

  async updateCredentials(userId: string, credentialType: string, credentialId: string, issuingBody: string, expiryDate: Date): Promise<any> {
    // Find creator by userId
    const creator = await db.queryOne('SELECT * FROM creators WHERE user_id = $1', [userId]);
    if (!creator) throw new Error('Creator profile not found');
    // Update credentials and reset verification status
    const updated = await db.queryOne(
      `UPDATE creators SET credential_type = $1, credential_id = $2, issuing_body = $3, expiry_date = $4, verification_status = 'PENDING', verified_at = NULL, updated_at = $5 WHERE user_id = $6 RETURNING *`,
      [credentialType, credentialId, issuingBody, expiryDate, new Date(), userId]
    );
    if (!updated) throw new Error('Credential update failed');
    // Optionally, log audit trail here
    return updated;
  }

  async getUserProfile(userId: string): Promise<any> {
    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw new Error('User not found');
    return user;
  }

  async getCreatorById(creatorId: string): Promise<any> {
    const creator = await db.queryOne('SELECT * FROM creators WHERE id = $1', [creatorId]);
    if (!creator) throw new Error('Creator not found');
    return creator;
  }
}

export const creatorService = new CreatorService();
