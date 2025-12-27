import { Router } from 'express';
import {
  savePost,
  unsavePost,
  getSavedPosts,
  checkIfSaved,
  hidePost,
  unhidePost,
  getHiddenPosts,
  reportContent,
  getUserReports,
  addFavorite,
  removeFavorite,
  getFavorites,
} from '../controllers/media.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Save/Unsave routes
router.post('/save/:videoId', savePost);
router.delete('/save/:videoId', unsavePost);
router.get('/saved', getSavedPosts);
router.get('/:videoId/is-saved', checkIfSaved);

// Hide/Unhide routes
router.post('/hide/:videoId', hidePost);
router.delete('/hide/:videoId', unhidePost);
router.get('/hidden', getHiddenPosts);

// Report routes
router.post('/report', reportContent);
router.get('/reports', getUserReports);

// Favorites routes
router.post('/favorites/:videoId', addFavorite);
router.delete('/favorites/:videoId', removeFavorite);
router.get('/favorites', getFavorites);

export default router;
