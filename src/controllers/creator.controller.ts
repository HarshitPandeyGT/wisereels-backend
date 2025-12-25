import { Response } from 'express';
import { creatorService } from '../services/creator.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const submitCredentials = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { credentialType, credentialId, issuingBody, expiryDate } = req.body;

    if (!credentialType || !credentialId || !issuingBody || !expiryDate) {
      throw new AppError(400, 'All credential fields are required');
    }

    const creator = await creatorService.submitCredentials(
      req.user.userId,
      credentialType,
      credentialId,
      issuingBody,
      new Date(expiryDate)
    );

    res.json({
      success: true,
      message: 'Credentials submitted for verification',
      data: creator,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Credential submission error', error);
      res.status(500).json({
        success: false,
        error: 'Credential submission failed',
      });
    }
  }
};

export const getCreatorProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const creator = await creatorService.getCreatorByUserId(req.user.userId);

    if (!creator) {
      throw new AppError(404, 'Creator profile not found');
    }

    res.json({
      success: true,
      data: creator,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Get creator profile error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch creator profile',
      });
    }
  }
};

export const verifyCreatorCredentials = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError(403, 'Only admins can verify credentials');
    }

    const { userId, status } = req.body;

    if (!userId || !status) {
      throw new AppError(400, 'User ID and status are required');
    }

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw new AppError(400, 'Status must be VERIFIED or REJECTED');
    }

    const creator = await creatorService.verifyCreator(userId, status, req.user.userId);

    res.json({
      success: true,
      message: `Creator ${status.toLowerCase()} successfully`,
      data: creator,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      logger.error('Creator verification error', error);
      res.status(500).json({
        success: false,
        error: 'Creator verification failed',
      });
    }
  }
};

export const updateCreatorProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { username, displayName, firstName, lastName, profilePictureUrl, bio } = req.body;
    const updated = await creatorService.updateProfile(req.user.userId, {
      username,
      displayName,
      firstName,
      lastName,
      profilePictureUrl,
      bio,
    });
    res.json({ success: true, message: 'Profile updated', data: updated });
  } catch (error) {
    logger.error('Profile update error', error);
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

export const updateCredentials = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { credentialType, credentialId, issuingBody, expiryDate } = req.body;
    if (!credentialType || !credentialId || !issuingBody || !expiryDate) {
      throw new AppError(400, 'All credential fields are required');
    }
    const updated = await creatorService.updateCredentials(
      req.user.userId,
      credentialType,
      credentialId,
      issuingBody,
      new Date(expiryDate)
    );
    res.json({ success: true, message: 'Credentials updated and set for re-verification', data: updated });
  } catch (error) {
    logger.error('Credential update error', error);
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

export const getCreatorById = async (req: AuthRequest, res: Response) => {
  try {
    const { creatorId } = req.params;
    if (!creatorId) throw new AppError(400, 'Creator ID is required');
    const creator = await creatorService.getCreatorById(creatorId);
    if (!creator) throw new AppError(404, 'Creator not found');
    // Optionally, fetch user profile as well
    const user = await creatorService.getUserProfile(creator.user_id);
    res.json({ success: true, data: { creator, user } });
  } catch (error) {
    logger.error('Get creator by ID error', error);
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};
