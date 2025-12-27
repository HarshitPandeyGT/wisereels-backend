import { Request, Response } from 'express';
import FeedService from '../services/feed.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Get personalized feed (For You page)
 * GET /api/feed/for-you
 */
export const getPersonalizedFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const videos = await FeedService.getPersonalizedFeed(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        videos,
        count: videos.length,
      },
    });

    logger.info('Personalized feed fetched', { userId, count: videos.length });
  } catch (error) {
    logger.error('Error in getPersonalizedFeed', { error });
    throw error;
  }
};

/**
 * Get explore feed
 * GET /api/feed/explore
 */
export const getExploreFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const videos = await FeedService.getExploreFeed(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        videos,
        count: videos.length,
      },
    });

    logger.info('Explore feed fetched', { userId, count: videos.length });
  } catch (error) {
    logger.error('Error in getExploreFeed', { error });
    throw error;
  }
};

/**
 * Get trending videos
 * GET /api/feed/trending
 */
export const getTrendingVideos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const videos = await FeedService.getTrendingVideos(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        videos,
        count: videos.length,
      },
    });

    logger.info('Trending videos fetched', { count: videos.length });
  } catch (error) {
    logger.error('Error in getTrendingVideos', { error });
    throw error;
  }
};

/**
 * Get videos by category
 * GET /api/feed/category/:category
 */
export const getVideosByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const category = req.params.category;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const videos = await FeedService.getVideosByCategory(userId, category, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        category,
        videos,
        count: videos.length,
      },
    });

    logger.info('Videos by category fetched', { category, count: videos.length });
  } catch (error) {
    logger.error('Error in getVideosByCategory', { error });
    throw error;
  }
};

/**
 * Get videos by hashtag
 * GET /api/feed/hashtag/:hashtag
 */
export const getVideosByHashtag = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const hashtag = req.params.hashtag;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const videos = await FeedService.getVideosByHashtag(userId, hashtag, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        hashtag,
        videos,
        count: videos.length,
      },
    });

    logger.info('Videos by hashtag fetched', { hashtag, count: videos.length });
  } catch (error) {
    logger.error('Error in getVideosByHashtag', { error });
    throw error;
  }
};
