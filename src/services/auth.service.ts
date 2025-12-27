import { db } from '../config/database';
import { jwtService } from '../config/jwt';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  phone_number: string;
  username: string;
  email?: string;
  display_name: string;
  profile_picture_url?: string;
  account_status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  account_created_at: Date;
}

class AuthService {
  async savePendingRegistration({ phoneNumber, username, displayName, firstName, lastName, email }: any): Promise<void> {
    await db.query(
      `INSERT INTO pending_registrations (phone_number, username, display_name, first_name, last_name, email, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (phone_number) DO UPDATE SET username = $2, display_name = $3, first_name = $4, last_name = $5, email = $6, created_at = $7`,
      [phoneNumber, username, displayName, firstName, lastName, email, new Date()]
    );
  }

  async getPendingRegistration(phoneNumber: string): Promise<any | null> {
    return db.queryOne(
      `SELECT * FROM pending_registrations WHERE phone_number = $1`,
      [phoneNumber]
    );
  }

  async deletePendingRegistration(phoneNumber: string): Promise<void> {
    await db.query(
      `DELETE FROM pending_registrations WHERE phone_number = $1`,
      [phoneNumber]
    );
  }

  async registerUser(phoneNumber: string, username: string, displayName: string, firstName?: string, lastName?: string, email?: string): Promise<User> {
    // Check for unique username
    const existingUsername = await db.queryOne<User>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    if (existingUsername) {
      throw new Error('Username already taken');
    }
    const userId = uuidv4();
    const now = new Date();
    const query = `
      INSERT INTO users (
        id, phone_number, username, display_name, first_name, last_name, email, account_status, account_created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    try {
      const user = await db.queryOne<User>(query, [
        userId,
        phoneNumber,
        username,
        displayName,
        firstName,
        lastName,
        email,
        'ACTIVE',
        now,
        now,
      ]);

      if (!user) throw new Error('User creation failed');

      // Initialize wallet
      await this.initializeWallet(userId);

      logger.info(`User registered: ${userId}`);
      return user;
    } catch (error) {
      logger.error('User registration failed', error);
      throw error;
    }
  }

  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE phone_number = $1`;
    return db.queryOne<User>(query, [phoneNumber]);
  }

  async getUserById(userId: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE id = $1`;
    return db.queryOne<User>(query, [userId]);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE username = $1`;
    return db.queryOne<User>(query, [username]);
  }

  async generateAuthToken(userId: string, role: string = 'USER'): Promise<string> {
    return jwtService.generateToken({
      userId,
      role: role as 'USER' | 'CREATOR' | 'ADMIN',
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, userId: string): Promise<string> {
    try {
      // Verify refresh token from db
      const query = `
        SELECT * FROM refresh_tokens 
        WHERE user_id = $1 AND token = $2 AND is_revoked = false AND expires_at > NOW()
      `;

      const result = await db.queryOne<any>(query, [userId, refreshToken]);

      if (!result) {
        throw new Error('Invalid or expired refresh token');
      }

      // Get user details
      const userQuery = 'SELECT id, user_role FROM users WHERE id = $1';
      const user = await db.queryOne<any>(userQuery, [userId]);

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      return jwtService.generateToken({
        userId: user.id,
        role: user.user_role || 'USER',
      });
    } catch (error) {
      logger.error('Error refreshing token', { error, userId });
      throw error;
    }
  }

  /**
   * Logout user - revoke refresh token
   */
  async logout(userId: string, refreshToken?: string, allDevices: boolean = false): Promise<void> {
    try {
      if (allDevices) {
        // Revoke all refresh tokens for this user
        const revokeQuery = `
          UPDATE refresh_tokens 
          SET is_revoked = true, revoked_at = NOW()
          WHERE user_id = $1 AND is_revoked = false;
        `;

        await db.query(revokeQuery, [userId]);

        logger.info('User logged out from all devices', { userId });
      } else if (refreshToken) {
        // Revoke specific refresh token
        const revokeQuery = `
          UPDATE refresh_tokens 
          SET is_revoked = true, revoked_at = NOW()
          WHERE user_id = $1 AND token = $2;
        `;

        await db.query(revokeQuery, [userId, refreshToken]);

        logger.info('User logged out', { userId });
      }
    } catch (error) {
      logger.error('Error logging out user', { error, userId });
      throw error;
    }
  }

  /**
   * Delete user account with cascade delete and GDPR compliance
   */
  async deleteAccount(userId: string): Promise<void> {
    try {
      // Get user before deletion for logging
      const user = await db.queryOne<any>('SELECT username FROM users WHERE id = $1', [userId]);

      if (!user) {
        throw new Error('User not found');
      }

      // Anonymize user data (GDPR compliance)
      const anonymizeUserQuery = `
        UPDATE users 
        SET 
          display_name = 'Deleted User',
          username = $1,
          email = NULL,
          bio = NULL,
          profile_pic_url = NULL,
          is_deleted = true,
          deleted_at = NOW()
        WHERE id = $2;
      `;

      await db.query(anonymizeUserQuery, [`deleted_${uuidv4().slice(0, 8)}`, userId]);

      // Delete/anonymize related content
      // Videos - soft delete
      await db.query('UPDATE videos SET is_deleted = true WHERE creator_id = $1', [userId]);

      // Stories - soft delete
      await db.query('UPDATE stories SET is_deleted = true WHERE creator_id = $1', [userId]);

      // Comments - anonymize
      await db.query(
        'UPDATE comments SET user_id = NULL, text = $1 WHERE user_id = $2',
        ['[deleted]', userId]
      );

      // Likes - delete
      await db.query('DELETE FROM likes WHERE user_id = $1', [userId]);

      // Follows - delete
      await db.query('DELETE FROM follows WHERE follower_id = $1 OR following_id = $1', [userId]);

      // Blocks - delete
      await db.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [userId]);

      // Refresh tokens - revoke all
      await db.query(
        'UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE user_id = $1',
        [userId]
      );

      // Wallet - clear balance
      await db.query('DELETE FROM wallet WHERE user_id = $1', [userId]);

      // Saved posts - delete
      await db.query('DELETE FROM saved_posts WHERE user_id = $1', [userId]);

      // Create deletion record for compliance
      const deletionId = uuidv4();
      await db.query(
        'INSERT INTO user_deletions (id, user_id, username, deleted_at, reason) VALUES ($1, $2, $3, NOW(), $4)',
        [deletionId, userId, user.username, 'user_request']
      );

      logger.warn('User account deleted', {
        userId,
        username: user.username,
        deletionId,
      });
    } catch (error) {
      logger.error('Error deleting user account', { error, userId });
      throw error;
    }
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          id, created_at, expires_at
        FROM refresh_tokens
        WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
        ORDER BY created_at DESC;
      `;

      return await db.query<any>(query, [userId]);
    } catch (error) {
      logger.error('Error fetching sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      const query = `
        UPDATE refresh_tokens 
        SET is_revoked = true, revoked_at = NOW()
        WHERE id = $1 AND user_id = $2;
      `;

      await db.query(query, [sessionId, userId]);

      logger.info('Session revoked', { userId, sessionId });
    } catch (error) {
      logger.error('Error revoking session', { error });
      throw error;
    }
  }

  private async initializeWallet(userId: string): Promise<void> {
    const query = `
      INSERT INTO wallet (user_id, pending_points, available_points, total_earned, total_redeemed, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await db.query(query, [
      userId,
      0,
      0,
      0,
      0,
      new Date(),
    ]);
  }
}

export const authService = new AuthService();
