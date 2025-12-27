import { Request, Response } from 'express';
import MediaService from '../services/media.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Save a video/post
 * POST /api/media/save/:videoId
 */
export const savePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const saved = await MediaService.savePost(userId, videoId);

    res.status(201).json({
      success: true,
      message: 'Post saved successfully',
      data: saved,
    });

    logger.info('Post saved', { userId, videoId });
  } catch (error) {
    logger.error('Error in savePost', { error });
    throw error;
  }
};

/**
 * Unsave a video/post
 * DELETE /api/media/save/:videoId
 */
export const unsavePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    await MediaService.unsavePost(userId, videoId);

    res.status(200).json({
      success: true,
      message: 'Post unsaved successfully',
    });

    logger.info('Post unsaved', { userId, videoId });
  } catch (error) {
    logger.error('Error in unsavePost', { error });
    throw error;
  }
};

/**
 * Get saved posts
 * GET /api/media/saved
 */
export const getSavedPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const posts = await MediaService.getSavedPosts(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        posts,
        count: posts.length,
      },
    });

    logger.info('Saved posts fetched', { userId, count: posts.length });
  } catch (error) {
    logger.error('Error in getSavedPosts', { error });
    throw error;
  }
};

/**
 * Check if post is saved
 * GET /api/media/:videoId/is-saved
 */
export const checkIfSaved = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const isSaved = await MediaService.isPostSaved(userId, videoId);

    res.status(200).json({
      success: true,
      data: {
        isSaved,
      },
    });
  } catch (error) {
    logger.error('Error in checkIfSaved', { error });
    throw error;
  }
};

/**
 * Hide a post
 * POST /api/media/hide/:videoId
 */
export const hidePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const hidden = await MediaService.hidePost(userId, videoId);

    res.status(201).json({
      success: true,
      message: 'Post hidden successfully',
      data: hidden,
    });

    logger.info('Post hidden', { userId, videoId });
  } catch (error) {
    logger.error('Error in hidePost', { error });
    throw error;
  }
};

/**
 * Unhide a post
 * DELETE /api/media/hide/:videoId
 */
export const unhidePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    await MediaService.unhidePost(userId, videoId);

    res.status(200).json({
      success: true,
      message: 'Post unhidden successfully',
    });

    logger.info('Post unhidden', { userId, videoId });
  } catch (error) {
    logger.error('Error in unhidePost', { error });
    throw error;
  }
};

/**
 * Get hidden posts
 * GET /api/media/hidden
 */
export const getHiddenPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const posts = await MediaService.getHiddenPosts(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        posts,
        count: posts.length,
      },
    });

    logger.info('Hidden posts fetched', { userId, count: posts.length });
  } catch (error) {
    logger.error('Error in getHiddenPosts', { error });
    throw error;
  }
};

/**
 * Report content
 * POST /api/media/report
 */
export const reportContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { contentType, contentId, reason, description, reportedId } = req.body;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    if (!contentType || !contentId || !reason) {
      throw new AppError(400, 'Missing required fields: contentType, contentId, reason');
    }

    const report = await MediaService.reportContent(
      userId,
      contentType,
      contentId,
      reason,
      description,
      reportedId
    );

    res.status(201).json({
      success: true,
      message: 'Content reported successfully',
      data: report,
    });

    logger.info('Content reported', { userId, contentType, contentId, reason });
  } catch (error) {
    logger.error('Error in reportContent', { error });
    throw error;
  }
};

/**
 * Get user's reports
 * GET /api/media/reports
 */
export const getUserReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const reports = await MediaService.getUserReports(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        reports,
        count: reports.length,
      },
    });

    logger.info('User reports fetched', { userId, count: reports.length });
  } catch (error) {
    logger.error('Error in getUserReports', { error });
    throw error;
  }
};

/**
 * Add to favorites
 * POST /api/media/favorites/:videoId
 */
export const addFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const favorite = await MediaService.addFavorite(userId, videoId);

    res.status(201).json({
      success: true,
      message: 'Added to favorites',
      data: favorite,
    });

    logger.info('Video added to favorites', { userId, videoId });
  } catch (error) {
    logger.error('Error in addFavorite', { error });
    throw error;
  }
};

/**
 * Remove from favorites
 * DELETE /api/media/favorites/:videoId
 */
export const removeFavorite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const videoId = req.params.videoId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    await MediaService.removeFavorite(userId, videoId);

    res.status(200).json({
      success: true,
      message: 'Removed from favorites',
    });

    logger.info('Video removed from favorites', { userId, videoId });
  } catch (error) {
    logger.error('Error in removeFavorite', { error });
    throw error;
  }
};

/**
 * Get favorites
 * GET /api/media/favorites
 */
export const getFavorites = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const favorites = await MediaService.getFavorites(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        favorites,
        count: favorites.length,
      },
    });

    logger.info('Favorites fetched', { userId, count: favorites.length });
  } catch (error) {
    logger.error('Error in getFavorites', { error });
    throw error;
  }
};
