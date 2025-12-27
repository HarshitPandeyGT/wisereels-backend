import { Request, Response } from 'express';
import StoriesService from '../services/stories.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
}

const authCheck = (userId: string | undefined): string => {
  if (!userId) {
    throw new AppError(401, 'Authentication required');
  }
  return userId;
};

/**
 * Upload a new story (24-hour expiry)
 * POST /api/stories/upload
 */
export const uploadStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const { mediaUrl, caption, category } = req.body;

    if (!mediaUrl) {
      throw new AppError(400, 'Media URL is required');
    }

    const story = await StoriesService.uploadStory({
      userId,
      mediaUrl,
      caption,
      category,
    });

    res.status(201).json({
      success: true,
      message: 'Story uploaded successfully',
      data: story,
    });

    logger.info('Story uploaded', { userId });
  } catch (error) {
    logger.error('Error in uploadStory controller', { error });
    throw error;
  }
};

/**
 * Get active stories
 * GET /api/stories
 */
export const getActiveStories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const stories = await StoriesService.getActiveStories(userId, limit);

    res.status(200).json({
      success: true,
      message: 'Active stories fetched',
      data: {
        stories,
        count: stories.length,
      },
    });

    logger.info('Active stories fetched', { userId, count: stories.length });
  } catch (error) {
    logger.error('Error in getActiveStories controller', { error });
    throw error;
  }
};

/**
 * Get story by ID
 * GET /api/stories/:storyId
 */
export const getStoryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const storyId = req.params.storyId;

    const story = await StoriesService.getStoryById(storyId, userId);

    res.status(200).json({
      success: true,
      message: 'Story fetched',
      data: story,
    });

    logger.info('Story fetched', { storyId, userId });
  } catch (error) {
    logger.error('Error in getStoryById controller', { error });
    throw error;
  }
};

/**
 * Reply to story (DM the story creator)
 * POST /api/stories/:storyId/reply
 */
export const replyToStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const storyId = req.params.storyId;
    const { message } = req.body;

    if (!message) {
      throw new AppError(400, 'Message is required');
    }

    const reply = await StoriesService.replyToStory(storyId, userId, message);

    res.status(201).json({
      success: true,
      message: 'Reply sent',
      data: reply,
    });

    logger.info('Reply sent to story', { storyId, userId });
  } catch (error) {
    logger.error('Error in replyToStory controller', { error });
    throw error;
  }
};

/**
 * Get story replies
 * GET /api/stories/:storyId/replies
 */
export const getStoryReplies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const storyId = req.params.storyId;

    const replies = await StoriesService.getStoryReplies(storyId, userId);

    res.status(200).json({
      success: true,
      message: 'Story replies fetched',
      data: {
        replies,
        count: replies.length,
      },
    });

    logger.info('Story replies fetched', { storyId, count: replies.length });
  } catch (error) {
    logger.error('Error in getStoryReplies controller', { error });
    throw error;
  }
};

/**
 * Mute stories from a creator
 * POST /api/stories/mute
 */
export const muteStories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const { creatorId } = req.body;

    if (!creatorId) {
      throw new AppError(400, 'Creator ID is required');
    }

    await StoriesService.muteStories(creatorId, userId);

    res.status(200).json({
      success: true,
      message: 'Creator stories muted',
    });

    logger.info('Creator stories muted', { userId, creatorId });
  } catch (error) {
    logger.error('Error in muteStories controller', { error });
    throw error;
  }
};

/**
 * Report story for violating guidelines
 * POST /api/stories/:storyId/report
 */
export const reportStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const { reason, description } = req.body;
    const storyId = req.params.id;

    if (!reason) {
      throw new AppError(400, 'Reason is required');
    }

    await StoriesService.reportStory(storyId, userId, reason, description);

    res.status(201).json({
      success: true,
      message: 'Story reported',
    });

    logger.info('Story reported', { storyId, userId, reason });
  } catch (error) {
    logger.error('Error in reportStory controller', { error });
    throw error;
  }
};

/**
 * Mark story as viewed
 * POST /api/stories/:id/view
 */
export const viewStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = authCheck(req.userId);
    const storyId = req.params.id;

    await StoriesService.markStoryAsViewed(storyId, userId);

    res.status(200).json({
      success: true,
      message: 'Story marked as viewed',
    });

    logger.info('Story viewed', { storyId, userId });
  } catch (error) {
    logger.error('Error in viewStory controller', { error });
    throw error;
  }
};

/**
 * Share story via DM
 * POST /api/stories/:id/share
 */

