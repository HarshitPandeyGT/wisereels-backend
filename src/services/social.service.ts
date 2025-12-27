import { pool } from '../config/database';
import { cache } from '../config/cache';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  expertStatus: 'none' | 'pending' | 'verified';
  postCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isBlocked?: boolean;
}

class SocialService {
  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string): Promise<void> {
    const client = await pool.connect();
    try {
      // Validate users exist
      const [follower, following] = await Promise.all([
        client.query('SELECT id FROM users WHERE id = $1', [followerId]),
        client.query('SELECT id FROM users WHERE id = $1', [followingId]),
      ]);

      if (follower.rows.length === 0 || following.rows.length === 0) {
        throw new AppError(404, 'User not found');
      }

      if (followerId === followingId) {
        throw new AppError(400, 'Cannot follow yourself');
      }

      // Check if already following
      const existingFollow = await client.query(
        'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId]
      );

      if (existingFollow.rows.length > 0) {
        throw new AppError(400, 'Already following this user');
      }

      // Check if blocked
      const blocked = await client.query(
        'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
        [followerId, followingId]
      );

      if (blocked.rows.length > 0) {
        throw new AppError(400, 'Cannot follow blocked user');
      }

      // Create follow relationship
      await client.query(
        'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
        [followerId, followingId]
      );

      // Update counts
      await Promise.all([
        client.query('UPDATE users SET follower_count = follower_count + 1 WHERE id = $1', [
          followingId,
        ]),
        client.query('UPDATE users SET following_count = following_count + 1 WHERE id = $1', [
          followerId,
        ]),
      ]);

      // Invalidate caches
      await Promise.all([
        cache.del(`followers:${followingId}`),
        cache.del(`following:${followerId}`),
        cache.del(`user:${followerId}`),
        cache.del(`user:${followingId}`),
      ]);

      logger.info('User followed', { followerId, followingId });
    } catch (error) {
      logger.error('Error following user', { error, followerId, followingId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const client = await pool.connect();
    try {
      // Delete follow relationship
      const result = await client.query(
        'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'Not following this user');
      }

      // Update counts
      await Promise.all([
        client.query('UPDATE users SET follower_count = GREATEST(0, follower_count - 1) WHERE id = $1', [
          followingId,
        ]),
        client.query('UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = $1', [
          followerId,
        ]),
      ]);

      // Invalidate caches
      await Promise.all([
        cache.del(`followers:${followingId}`),
        cache.del(`following:${followerId}`),
        cache.del(`user:${followerId}`),
        cache.del(`user:${followingId}`),
      ]);

      logger.info('User unfollowed', { followerId, followingId });
    } catch (error) {
      logger.error('Error unfollowing user', { error, followerId, followingId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get followers list (paginated)
   */
  async getFollowers(userId: string, limit: number = 20, offset: number = 0): Promise<UserProfile[]> {
    try {
      const cacheKey = `followers:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.avatar_url, u.bio,
          u.expert_status, u.post_count, u.follower_count, u.following_count
        FROM users u
        INNER JOIN follows f ON u.id = f.follower_id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);
      const followers = result.rows.map((row: any) => this.formatUserProfile(row));

      await cache.set(cacheKey, followers, 60);
      return followers;
    } catch (error) {
      logger.error('Error fetching followers', { error, userId });
      throw error;
    }
  }

  /**
   * Get following list (paginated)
   */
  async getFollowing(userId: string, limit: number = 20, offset: number = 0): Promise<UserProfile[]> {
    try {
      const cacheKey = `following:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.avatar_url, u.bio,
          u.expert_status, u.post_count, u.follower_count, u.following_count
        FROM users u
        INNER JOIN follows f ON u.id = f.following_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);
      const following = result.rows.map((row: any) => this.formatUserProfile(row));

      await cache.set(cacheKey, following, 60);
      return following;
    } catch (error) {
      logger.error('Error fetching following', { error, userId });
      throw error;
    }
  }

  /**
   * Check if user follows another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking follow status', { error, followerId, followingId });
      return false;
    }
  }

  /**
   * Block a user
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    const client = await pool.connect();
    try {
      if (blockerId === blockedId) {
        throw new AppError(400, 'Cannot block yourself');
      }

      // Check if already blocked
      const existing = await client.query(
        'SELECT id FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
        [blockerId, blockedId]
      );

      if (existing.rows.length > 0) {
        throw new AppError(400, 'User already blocked');
      }

      // Create block
      await client.query(
        'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)',
        [blockerId, blockedId]
      );

      // Remove follow relationship if exists
      await Promise.all([
        client.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [
          blockerId,
          blockedId,
        ]),
        client.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [
          blockedId,
          blockerId,
        ]),
      ]);

      // Invalidate caches
      await Promise.all([
        cache.del(`followers:${blockedId}`),
        cache.del(`following:${blockerId}`),
        cache.del(`user:${blockerId}`),
        cache.del(`user:${blockedId}`),
        cache.del(`blocked:${blockerId}`),
      ]);

      logger.info('User blocked', { blockerId, blockedId });
    } catch (error) {
      logger.error('Error blocking user', { error, blockerId, blockedId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    try {
      const result = await pool.query(
        'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
        [blockerId, blockedId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, 'User not blocked');
      }

      await cache.del(`blocked:${blockerId}`);
      logger.info('User unblocked', { blockerId, blockedId });
    } catch (error) {
      logger.error('Error unblocking user', { error, blockerId, blockedId });
      throw error;
    }
  }

  /**
   * Get blocked users list
   */
  async getBlockedUsers(userId: string, limit: number = 20, offset: number = 0): Promise<UserProfile[]> {
    try {
      const cacheKey = `blocked:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.avatar_url, u.bio,
          u.expert_status, u.post_count, u.follower_count, u.following_count
        FROM users u
        INNER JOIN blocks b ON u.id = b.blocked_id
        WHERE b.blocker_id = $1
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);
      const blocked = result.rows.map((row: any) => this.formatUserProfile(row));

      await cache.set(cacheKey, blocked, 60);
      return blocked;
    } catch (error) {
      logger.error('Error fetching blocked users', { error, userId });
      throw error;
    }
  }

  /**
   * Search users by username or display name
   */
  async searchUsers(query: string, currentUserId?: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      const searchQuery = `%${query.toLowerCase()}%`;

      const sql = `
        SELECT 
          u.id, u.username, u.display_name, u.avatar_url, u.bio,
          u.expert_status, u.post_count, u.follower_count, u.following_count
        FROM users u
        WHERE (LOWER(u.username) LIKE $1 OR LOWER(u.display_name) LIKE $1)
        ${currentUserId ? 'AND u.id != $2' : ''}
        LIMIT $${currentUserId ? '3' : '2'}
      `;

      const params = [searchQuery, currentUserId].filter(p => p !== undefined);
      const result = await pool.query(sql, params);

      return result.rows.map((row: any) => this.formatUserProfile(row, currentUserId));
    } catch (error) {
      logger.error('Error searching users', { error, query });
      throw error;
    }
  }

  /**
   * Get public profile by username
   */
  async getPublicProfile(username: string, currentUserId?: string): Promise<UserProfile | null> {
    try {
      const cacheKey = `profile:${username}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          id, username, display_name, avatar_url, bio,
          expert_status, post_count, follower_count, following_count
        FROM users
        WHERE username = $1
      `;

      const result = await pool.query(query, [username]);
      if (result.rows.length === 0) return null;

      const profile = this.formatUserProfile(result.rows[0], currentUserId);
      await cache.set(cacheKey, profile, 120);

      return profile;
    } catch (error) {
      logger.error('Error fetching public profile', { error, username });
      throw error;
    }
  }

  /**
   * Get own profile (@me)
   */
  async getOwnProfile(userId: string): Promise<any> {
    try {
      const cacheKey = `profile:me:${userId}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          id, username, display_name, avatar_url, bio, email, phone_number,
          expert_status, post_count, follower_count, following_count, story_count,
          created_at, last_login
        FROM users
        WHERE id = $1
      `;

      const result = await pool.query(query, [userId]);
      if (result.rows.length === 0) {
        throw new AppError(404, 'User not found');
      }

      const wallet = await pool.query('SELECT * FROM wallet WHERE user_id = $1', [userId]);

      const profile = {
        ...result.rows[0],
        wallet: wallet.rows[0] || null,
      };

      await cache.set(cacheKey, profile, 30);
      return profile;
    } catch (error) {
      logger.error('Error fetching own profile', { error, userId });
      throw error;
    }
  }

  /**
   * Get profile with follow status
   */
  async getProfileWithStatus(userId: string, currentUserId?: string): Promise<any> {
    try {
      const profile = await this.getOwnProfile(userId);
      
      if (!currentUserId || currentUserId === userId) {
        return profile;
      }

      const [isFollowing, isFollowedBy, isBlocked] = await Promise.all([
        this.isFollowing(currentUserId, userId),
        this.isFollowing(userId, currentUserId),
        this.isUserBlocked(currentUserId, userId),
      ]);

      return {
        ...profile,
        isFollowing,
        isFollowedBy,
        isBlocked,
      };
    } catch (error) {
      logger.error('Error getting profile with status', { error, userId, currentUserId });
      throw error;
    }
  }

  /**
   * Check if user is blocked
   */
  async isUserBlocked(userId1: string, userId2: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
        [userId1, userId2]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking block status', { error });
      return false;
    }
  }

  /**
   * Helper: Format user profile
   */
  private formatUserProfile(row: any, currentUserId?: string): UserProfile {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      expertStatus: row.expert_status || 'none',
      postCount: row.post_count || 0,
      followerCount: row.follower_count || 0,
      followingCount: row.following_count || 0,
    };
  }
}

export default new SocialService();
