import { Response } from 'express';
import { userService } from '../services/user.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const updated = await userService.updateUserProfile(req.user.userId, req.body);
    res.json({ success: true, message: 'Profile updated', data: updated });
  } catch (error) {
    logger.error('Profile update error', error);
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const user = await userService.getUserById(req.user.userId);
    if (!user) throw new AppError(404, 'User not found');
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get user profile error', error);
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};
