import { Request, Response } from 'express';
import ExpertService from '../services/expert.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Apply for expert verification
 * POST /api/experts/apply
 */
export const applyForExpert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { category, bio, credentials, portfolioUrl } = req.body;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    if (!category || !bio || !credentials) {
      throw new AppError(400, 'Category, bio, and credentials are required');
    }

    const application = await ExpertService.applyForExpert(userId, category, bio, credentials, portfolioUrl);

    res.status(201).json({
      success: true,
      message: 'Expert application submitted successfully',
      data: application,
    });

    logger.info('Expert application submitted', { userId, category });
  } catch (error) {
    logger.error('Error in applyForExpert', { error });
    throw error;
  }
};

/**
 * Get application status
 * GET /api/experts/status
 */
export const getApplicationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const status = await ExpertService.getApplicationStatus(userId);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error in getApplicationStatus', { error });
    throw error;
  }
};

/**
 * Get pending applications (admin only)
 * GET /api/experts/queue
 */
export const getPendingApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin') {
      throw new AppError(403, 'Admin access required');
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const applications = await ExpertService.getPendingApplications(limit, offset);

    res.status(200).json({
      success: true,
      data: {
        applications,
        count: applications.length,
      },
    });

    logger.info('Pending applications fetched', { count: applications.length });
  } catch (error) {
    logger.error('Error in getPendingApplications', { error });
    throw error;
  }
};

/**
 * Approve application (admin only)
 * POST /api/experts/approve/:applicationId
 */
export const approveApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.applicationId;
    const adminId = req.userId;
    const { badgeType, notes } = req.body;

    if (req.userRole !== 'admin') {
      throw new AppError(403, 'Admin access required');
    }

    if (!adminId) {
      throw new AppError(401, 'Authentication required');
    }

    const application = await ExpertService.approveApplication(
      applicationId,
      badgeType || 'verified',
      adminId,
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Application approved successfully',
      data: application,
    });

    logger.info('Expert application approved', { applicationId, adminId });
  } catch (error) {
    logger.error('Error in approveApplication', { error });
    throw error;
  }
};

/**
 * Reject application (admin only)
 * POST /api/experts/reject/:applicationId
 */
export const rejectApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.applicationId;
    const adminId = req.userId;
    const { reason } = req.body;

    if (req.userRole !== 'admin') {
      throw new AppError(403, 'Admin access required');
    }

    if (!adminId) {
      throw new AppError(401, 'Authentication required');
    }

    if (!reason) {
      throw new AppError(400, 'Rejection reason is required');
    }

    await ExpertService.rejectApplication(applicationId, adminId, reason);

    res.status(200).json({
      success: true,
      message: 'Application rejected',
    });

    logger.info('Expert application rejected', { applicationId, adminId });
  } catch (error) {
    logger.error('Error in rejectApplication', { error });
    throw error;
  }
};

/**
 * Get expert profile (public)
 * GET /api/experts/@:username
 */
export const getExpertProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const username = req.params.username;

    const profile = await ExpertService.getExpertProfile(username);

    if (!profile) {
      throw new AppError(404, 'Expert not found');
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('Error in getExpertProfile', { error });
    throw error;
  }
};

/**
 * Get experts by category
 * GET /api/experts/category/:category
 */
export const getExpertsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = req.params.category;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const experts = await ExpertService.getExpertsByCategory(category, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        category,
        experts,
        count: experts.length,
      },
    });

    logger.info('Experts by category fetched', { category, count: experts.length });
  } catch (error) {
    logger.error('Error in getExpertsByCategory', { error });
    throw error;
  }
};

/**
 * Get verification queue stats (admin only)
 * GET /api/experts/stats/queue
 */
export const getQueueStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin') {
      throw new AppError(403, 'Admin access required');
    }

    const stats = await ExpertService.getQueueStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error in getQueueStats', { error });
    throw error;
  }
};
