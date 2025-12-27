import express from 'express';
import {
  uploadStory,
  getActiveStories,
  getStoryById,
  replyToStory,
  getStoryReplies,
  reportStory,
  viewStory,
  muteStories,
} from '../controllers/stories.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';

const router = express.Router();

// Define validation schemas
const storyUploadSchema = Joi.object({
  mediaUrl: Joi.string().uri().required(),
  caption: Joi.string().max(500),
  category: Joi.string().max(50),
});

const storyReplySchema = Joi.object({
  replyText: Joi.string().min(1).max(500).required(),
});

const storyReportSchema = Joi.object({
  reason: Joi.string()
    .valid('spam', 'inappropriate', 'harassment', 'hate_speech', 'violence', 'other')
    .required(),
  description: Joi.string().max(500),
});

const storyShareSchema = Joi.object({
  shareWithUserIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  message: Joi.string().max(500),
});

/**
 * @route POST /api/stories/upload
 * @desc Upload a new 24-hour story
 * @access Authenticated users
 */
router.post('/upload', authMiddleware, validateRequest(storyUploadSchema), uploadStory);

/**
 * @route GET /api/stories/active
 * @desc Get active stories for home screen (following, non-muted)
 * @access Authenticated users
 */
router.get('/active', authMiddleware, getActiveStories);

/**
 * @route GET /api/stories/:id
 * @desc Get single story by ID
 * @access Authenticated users
 */
router.get('/:id', authMiddleware, getStoryById);

/**
 * @route POST /api/stories/:id/view
 * @desc Mark story as viewed
 * @access Authenticated users
 */
router.post('/:id/view', authMiddleware, viewStory);

/**
 * @route POST /api/stories/:id/reply
 * @desc Reply to a story (sends DM)
 * @access Authenticated users
 */
router.post('/:id/reply', authMiddleware, validateRequest(storyReplySchema), replyToStory);

/**
 * @route GET /api/stories/:id/replies
 * @desc Get replies to a story (story owner only)
 * @access Authenticated users
 */
router.get('/:id/replies', authMiddleware, getStoryReplies);

/**
 * @route POST /api/stories/:id/mute
 * @desc Mute stories from a user
 * @access Authenticated users
 */
router.post('/mute', authMiddleware, muteStories);

/**
 * @route POST /api/stories/:id/report
 * @desc Report story content
 * @access Authenticated users
 */
router.post('/:id/report', authMiddleware, validateRequest(storyReportSchema), reportStory);

export default router;
