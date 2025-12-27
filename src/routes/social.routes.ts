import { Router } from 'express';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  blockUser,
  unblockUser,
  getBlockedList,
  searchUsers,
  getPublicProfile,
  getOwnProfile,
} from '../controllers/social.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Follow routes
router.post('/:id/follow', followUser);
router.delete('/:id/unfollow', unfollowUser);

// Followers/Following routes
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

// Block routes
router.post('/:id/block', blockUser);
router.delete('/:id/unblock', unblockUser);
router.get('/blocked-list', getBlockedList);

// Search and profile routes
router.get('/search', searchUsers);
router.get('/@:username', getPublicProfile);
router.get('/@me', getOwnProfile);

export default router;
