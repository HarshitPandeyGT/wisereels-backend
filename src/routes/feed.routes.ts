import { Router } from 'express';
import {
  getPersonalizedFeed,
  getExploreFeed,
  getTrendingVideos,
  getVideosByCategory,
  getVideosByHashtag,
} from '../controllers/feed.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Feed routes
router.get('/for-you', getPersonalizedFeed);
router.get('/explore', getExploreFeed);
router.get('/trending', getTrendingVideos);
router.get('/category/:category', getVideosByCategory);
router.get('/hashtag/:hashtag', getVideosByHashtag);

export default router;
