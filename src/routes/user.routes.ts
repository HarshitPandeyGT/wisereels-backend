import express from 'express';
import { updateUserProfile, getUserProfile } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { userProfileUpdateSchema } from '../utils/userValidators';

const router = express.Router();

/**
 * @route PUT /profile
 * @desc Update user profile
 * @access Authenticated users
 */
router.put('/profile', authMiddleware, validateRequest(userProfileUpdateSchema), updateUserProfile);

/**
 * @route GET /profile
 * @desc Get user profile
 * @access Authenticated users
 */
router.get('/profile', authMiddleware, getUserProfile);

export default router;
