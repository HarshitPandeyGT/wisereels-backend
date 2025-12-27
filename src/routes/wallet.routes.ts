import express from 'express';
import {
  getWallet,
  recordWatchEvent,
  redeemPoints,
  processPendingPoints,
  walletHeartbeat,
  getWalletOptions,
} from '../controllers/wallet.controller';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { watchEventSchema, redemptionSchema } from '../utils/validators';
import Joi from 'joi';

const router = express.Router();

// Heartbeat validation schema
const heartbeatSchema = Joi.object({
  videoId: Joi.string().uuid().required(),
  creatorId: Joi.string().uuid().required(),
  watchDurationSeconds: Joi.number().min(0).required(),
  category: Joi.string().max(50).required(),
});

/**
 * @route GET /
 * @desc Get wallet info (total_points, pending_points, available_points)
 * @access Authenticated users
 */
router.get('/', authMiddleware, getWallet);

/**
 * @route POST /heartbeat
 * @desc 30-second watch progress update with tier-based multipliers
 * @access Authenticated users
 */
router.post('/heartbeat', authMiddleware, validateRequest(heartbeatSchema), walletHeartbeat);

/**
 * @route POST /watch-event
 * @desc Record a video watch event for rewards (deprecated - use heartbeat)
 * @access Authenticated users
 */
router.post('/watch-event', authMiddleware, validateRequest(watchEventSchema), recordWatchEvent);

/**
 * @route GET /options
 * @desc Get redemption options (payment methods and gift cards)
 * @access Authenticated users
 */
router.get('/options', authMiddleware, getWalletOptions);

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
