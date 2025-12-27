import { Response } from 'express';
import { walletService } from '../services/wallet.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const wallet = await walletService.getWallet(req.user.userId);

    if (!wallet) {
      throw new AppError(404, 'Wallet not found');
    }

    res.json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Get wallet error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch wallet',
      });
    }
  }
};

export const recordWatchEvent = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { videoId, creatorId, watchDurationSeconds, category } = req.body;

    if (!videoId || !creatorId || !watchDurationSeconds || !category) {
      throw new AppError(400, 'All watch event fields are required');
    }

    await walletService.recordWatchEvent(
      req.user.userId,
      videoId,
      creatorId,
      watchDurationSeconds,
      category
    );

    const wallet = await walletService.getWallet(req.user.userId);

    res.json({
      success: true,
      message: 'Watch event recorded',
      data: wallet,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Record watch event error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record watch event',
      });
    }
  }
};

export const redeemPoints = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { pointsToRedeem, redemptionType, details } = req.body;

    if (!pointsToRedeem || !redemptionType) {
      throw new AppError(400, 'Points to redeem and redemption type are required');
    }

    if (pointsToRedeem < 100) {
      throw new AppError(400, 'Minimum redemption is 100 points');
    }

    const redemptionId = await walletService.redeemPoints(req.user.userId, pointsToRedeem);

    res.json({
      success: true,
      message: 'Redemption request created',
      data: {
        redemptionId,
        pointsRedeemed: pointsToRedeem,
        status: 'PENDING',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Redemption error', error);
      res.status(500).json({
        success: false,
        error: 'Redemption failed',
      });
    }
  }
};

export const processPendingPoints = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Only admins can process pending points');
    }

    await walletService.processPendingToAvailable();

    res.json({
      success: true,
      message: 'Pending points processed successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Process pending points error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process pending points',
      });
    }
  }
};

/**
 * Wallet Heartbeat: 30-second watch progress update with tier multipliers
 */
export const walletHeartbeat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { videoId, creatorId, watchDurationSeconds, category } = req.body;

    if (!videoId || !creatorId || watchDurationSeconds === undefined || !category) {
      throw new AppError(400, 'All heartbeat fields are required');
    }

    if (typeof watchDurationSeconds !== 'number' || watchDurationSeconds < 0) {
      throw new AppError(400, 'Watch duration must be a positive number');
    }

    const result = await walletService.recordWatchHeartbeat(
      req.user.userId,
      videoId,
      creatorId,
      Math.floor(watchDurationSeconds),
      category
    );

    res.json({
      success: true,
      message: 'Heartbeat recorded',
      data: {
        pointsEarned: result.pointsEarned,
        multiplier: result.multiplier,
        pendingPoints: result.pendingPoints,
        availablePoints: result.availablePoints,
      },
    });

    logger.info('Heartbeat processed', {
      userId: req.user.userId,
      videoId,
      pointsEarned: result.pointsEarned,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Heartbeat error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process heartbeat',
      });
    }
  }
};

/**
 * Get wallet redemption options (payment methods and gift cards)
 */
export const getWalletOptions = async (req: AuthRequest, res: Response) => {
  try {
    const options = await walletService.getWalletOptions();

    res.json({
      success: true,
      message: 'Wallet options retrieved',
      data: options,
    });
  } catch (error) {
    logger.error('Get wallet options error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wallet options',
    });
  }
};
