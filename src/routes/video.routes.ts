import express from 'express';
import {
  uploadVideo,
  publishVideo,
  getVideo,
  getCreatorVideos,
  likeVideo,
  commentOnVideo,
} from '../controllers/video.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { videoUploadSchema } from '../utils/validators';
import { videoPublishSchema, videoCommentSchema } from '../utils/videoValidators';

const router = express.Router();

/**
 * @route POST /upload
 * @desc Upload a new video
 * @access Authenticated creators
 */
router.post('/upload', authMiddleware, validateRequest(videoUploadSchema), uploadVideo);

/**
 * @route POST /:videoId/publish
 * @desc Publish a video
 * @access Authenticated creators
 */
router.post('/:videoId/publish', authMiddleware, validateRequest(videoPublishSchema), publishVideo);

/**
 * @route GET /:videoId
 * @desc Get video by ID
 * @access Public
 */
router.get('/:videoId', getVideo);

/**
 * @route GET /creator/:creatorId
 * @desc Get all videos by creator
 * @access Public
 */
router.get('/creator/:creatorId', getCreatorVideos);

/**
 * @route POST /:videoId/like
 * @desc Like a video
 * @access Authenticated users
 */
router.post('/:videoId/like', authMiddleware, likeVideo);

/**
 * @route POST /:videoId/comment
 * @desc Comment on a video
 * @access Authenticated users
 */
router.post('/:videoId/comment', authMiddleware, validateRequest(videoCommentSchema), commentOnVideo);

export default router;
