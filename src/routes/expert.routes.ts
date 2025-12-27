import { Router } from 'express';
import {
  applyForExpert,
  getApplicationStatus,
  getPendingApplications,
  approveApplication,
  rejectApplication,
  getExpertProfile,
  getExpertsByCategory,
  getQueueStats,
} from '../controllers/expert.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes (no auth)
router.get('/@:username', getExpertProfile);
router.get('/category/:category', getExpertsByCategory);

// Authenticated user routes
router.post('/apply', authMiddleware, applyForExpert);
router.get('/status', authMiddleware, getApplicationStatus);

// Admin routes
router.get('/queue', authMiddleware, getPendingApplications);
router.post('/approve/:applicationId', authMiddleware, approveApplication);
router.post('/reject/:applicationId', authMiddleware, rejectApplication);
router.get('/stats/queue', authMiddleware, getQueueStats);

export default router;
