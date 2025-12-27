import { Request, Response } from 'express';
import SocialService from '../services/social.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Follow a user
 * POST /api/users/:id/follow
 */
export const followUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followingId = req.params.id;
    const followerId = req.userId;

    if (!followerId) {
      throw new AppError(401, 'Authentication required');
    }

    await SocialService.followUser(followerId, followingId);

    res.status(200).json({
      success: true,
      message: 'User followed successfully',
    });

    logger.info('Follow endpoint', { followerId, followingId });
  } catch (error) {
    logger.error('Error in followUser', { error });
    throw error;
  }
};

/**
 * Unfollow a user
 * DELETE /api/users/:id/unfollow
 */
export const unfollowUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followingId = req.params.id;
    const followerId = req.userId;

    if (!followerId) {
      throw new AppError(401, 'Authentication required');
    }

    await SocialService.unfollowUser(followerId, followingId);

    res.status(200).json({
      success: true,
      message: 'User unfollowed successfully',
    });

    logger.info('Unfollow endpoint', { followerId, followingId });
  } catch (error) {
    logger.error('Error in unfollowUser', { error });
    throw error;
  }
};

/**
 * Get followers list
 * GET /api/users/:id/followers
 */
export const getFollowers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const followers = await SocialService.getFollowers(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        followers,
        count: followers.length,
      },
    });

    logger.info('Followers fetched', { userId, count: followers.length });
  } catch (error) {
    logger.error('Error in getFollowers', { error });
    throw error;
  }
};

/**
 * Get following list
 * GET /api/users/:id/following
 */
export const getFollowing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const following = await SocialService.getFollowing(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        following,
        count: following.length,
      },
    });

    logger.info('Following fetched', { userId, count: following.length });
  } catch (error) {
    logger.error('Error in getFollowing', { error });
    throw error;
  }
};

/**
 * Block a user
 * POST /api/users/:id/block
 */
export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blockedId = req.params.id;
    const blockerId = req.userId;

    if (!blockerId) {
      throw new AppError(401, 'Authentication required');
    }

    await SocialService.blockUser(blockerId, blockedId);

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
    });

    logger.info('User blocked', { blockerId, blockedId });
  } catch (error) {
    logger.error('Error in blockUser', { error });
    throw error;
  }
};

/**
 * Unblock a user
 * DELETE /api/users/:id/unblock
 */
export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const blockedId = req.params.id;
    const blockerId = req.userId;

    if (!blockerId) {
      throw new AppError(401, 'Authentication required');
    }

    await SocialService.unblockUser(blockerId, blockedId);

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
    });

    logger.info('User unblocked', { blockerId, blockedId });
  } catch (error) {
    logger.error('Error in unblockUser', { error });
    throw error;
  }
};

/**
 * Get blocked users list
 * GET /api/users/blocked-list
 */
export const getBlockedList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const blocked = await SocialService.getBlockedUsers(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        blocked,
        count: blocked.length,
      },
    });

    logger.info('Blocked list fetched', { userId, count: blocked.length });
  } catch (error) {
    logger.error('Error in getBlockedList', { error });
    throw error;
  }
};

/**
 * Search users
 * GET /api/users/search
 */
export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!q || q.length < 2) {
      throw new AppError(400, 'Search query must be at least 2 characters');
    }

    const results = await SocialService.searchUsers(q, req.userId, limit);

    res.status(200).json({
      success: true,
      data: {
        results,
        count: results.length,
      },
    });

    logger.info('Users searched', { query: q, count: results.length });
  } catch (error) {
    logger.error('Error in searchUsers', { error });
    throw error;
  }
};

/**
 * Get public profile by username
 * GET /api/users/@:username
 */
export const getPublicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const username = req.params.username;
    const profile = await SocialService.getPublicProfile(username, req.userId);

    if (!profile) {
      throw new AppError(404, 'User not found');
    }

    // Get follow status if current user is authenticated
    let result = profile;
    if (req.userId && req.userId !== profile.id) {
      result = await SocialService.getProfileWithStatus(profile.id, req.userId);
    }

    res.status(200).json({
      success: true,
      data: result,
    });

    logger.info('Public profile fetched', { username });
  } catch (error) {
    logger.error('Error in getPublicProfile', { error });
    throw error;
  }
};

/**
 * Get own profile (@me)
 * GET /api/users/@me
 */
export const getOwnProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const profile = await SocialService.getOwnProfile(userId);

    res.status(200).json({
      success: true,
      data: profile,
    });

    logger.info('Own profile fetched', { userId });
  } catch (error) {
    logger.error('Error in getOwnProfile', { error });
    throw error;
  }
};
