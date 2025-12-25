import { Response } from 'express';
import { videoService } from '../services/video.service';
import { creatorService } from '../services/creator.service';
import { walletService } from '../services/wallet.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const uploadVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { title, description, category, durationSeconds } = req.body;

    if (!title || !category || !durationSeconds) {
      throw new AppError(400, 'Title, category, and duration are required');
    }

    // Check if creator can post in this category
    if (['FINANCE', 'HEALTH', 'FITNESS'].includes(category)) {
      const canPost = await creatorService.canPostRestrictedContent(req.user.userId);
      if (!canPost) {
        throw new AppError(403, 'You are not verified to post in this category');
      }
    }

    // Get creator ID
    const creator = await creatorService.getCreatorByUserId(req.user.userId);
    if (!creator) {
      throw new AppError(404, 'Creator profile not found');
    }

    const video = await videoService.uploadVideo(
      creator.id,
      title,
      description,
      category,
      durationSeconds
    );

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: video,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Video upload error', error);
      res.status(500).json({
        success: false,
        error: 'Video upload failed',
      });
    }
  }
};

export const publishVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { videoId } = req.params;

    if (!videoId) {
      throw new AppError(400, 'Video ID is required');
    }

    const video = await videoService.publishVideo(videoId);

    res.json({
      success: true,
      message: 'Video published successfully',
      data: video,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Video publication error', error);
      res.status(500).json({
        success: false,
        error: 'Video publication failed',
      });
    }
  }
};

export const getVideo = async (req: AuthRequest, res: Response) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      throw new AppError(400, 'Video ID is required');
    }

    const video = await videoService.getVideoById(videoId);

    if (!video) {
      throw new AppError(404, 'Video not found');
    }

    // Record watch event if user is authenticated
    if (req.user) {
      const creator = await creatorService.getCreatorByUserId(req.user.userId);
      if (creator && video.creator_id !== creator.id) {
        // Only record if user is not the creator
        await walletService.recordWatchEvent(
          req.user.userId,
          videoId,
          video.creator_id,
          10, // Default 10 seconds for API call
          video.category
        );
      }

      // Increment view count
      await videoService.incrementViewCount(videoId);
    }

    res.json({
      success: true,
      data: video,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Get video error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch video',
      });
    }
  }
};

export const getCreatorVideos = async (req: AuthRequest, res: Response) => {
  try {
    const { creatorId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    if (!creatorId) {
      throw new AppError(400, 'Creator ID is required');
    }

    const videos = await videoService.getVideosByCreator(
      creatorId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: {
        videos,
        count: videos.length,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Get creator videos error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch creator videos',
      });
    }
  }
};

export const likeVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { videoId } = req.params;
    if (!videoId) throw new AppError(400, 'Video ID is required');
    const result = await videoService.likeVideo(req.user.userId, videoId);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

export const commentOnVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { videoId } = req.params;
    const { comment } = req.body;
    if (!videoId || !comment) throw new AppError(400, 'Video ID and comment are required');
    const result = await videoService.commentOnVideo(req.user.userId, videoId, comment);
    res.status(201).json({ success: true, message: 'Comment added', data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};
