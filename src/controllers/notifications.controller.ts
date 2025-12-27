import { Request, Response } from 'express';
import NotificationService from '../services/notifications.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Get notifications
 * GET /api/notifications
 */
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const notifications = await NotificationService.getNotifications(userId, limit, offset, type as any);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        count: notifications.length,
      },
    });

    logger.info('Notifications fetched', { userId, count: notifications.length, type });
  } catch (error) {
    logger.error('Error in getNotifications', { error });
    throw error;
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const unreadCount = await NotificationService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error in getUnreadCount', { error });
    throw error;
  }
};

/**
 * Mark notification as read
 * POST /api/notifications/:notificationId/read
 */
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const notification = await NotificationService.markAsRead(notificationId, userId);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });

    logger.info('Notification marked as read', { notificationId, userId });
  } catch (error) {
    logger.error('Error in markAsRead', { error });
    throw error;
  }
};

/**
 * Mark all notifications as read
 * POST /api/notifications/mark-all-read
 */
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const count = await NotificationService.markAllAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        count,
      },
    });

    logger.info('All notifications marked as read', { userId, count });
  } catch (error) {
    logger.error('Error in markAllAsRead', { error });
    throw error;
  }
};

/**
 * Delete notification
 * DELETE /api/notifications/:notificationId
 */
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    await NotificationService.deleteNotification(notificationId, userId);

    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });

    logger.info('Notification deleted', { notificationId, userId });
  } catch (error) {
    logger.error('Error in deleteNotification', { error });
    throw error;
  }
};

/**
 * Delete all notifications
 * DELETE /api/notifications
 */
export const deleteAllNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const count = await NotificationService.deleteAllNotifications(userId);

    res.status(200).json({
      success: true,
      message: 'All notifications deleted',
      data: {
        count,
      },
    });

    logger.info('All notifications deleted', { userId, count });
  } catch (error) {
    logger.error('Error in deleteAllNotifications', { error });
    throw error;
  }
};
