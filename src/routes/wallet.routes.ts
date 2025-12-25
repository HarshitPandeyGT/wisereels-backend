import express from 'express';
import {
  getWallet,
  recordWatchEvent,
  redeemPoints,
  processPendingPoints,
} from '../controllers/wallet.controller';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { watchEventSchema, redemptionSchema } from '../utils/validators';

const router = express.Router();

/**
 * @route GET /
 * @desc Get wallet info
 * @access Authenticated users
 */
router.get('/', authMiddleware, getWallet);

/**
 * @route POST /watch-event
 * @desc Record a video watch event for rewards
 * @access Authenticated users
 */
router.post('/watch-event', authMiddleware, validateRequest(watchEventSchema), recordWatchEvent);

/**
 * @route POST /redeem
 * @desc Redeem points for rewards
 * @access Authenticated users
 */
router.post('/redeem', authMiddleware, validateRequest(redemptionSchema), redeemPoints);

/**
 * @route POST /process-pending
 * @desc Process pending points (admin only)
 * @access Admin only
 */
router.post('/process-pending', authMiddleware, roleMiddleware('ADMIN'), processPendingPoints);

export default router;
