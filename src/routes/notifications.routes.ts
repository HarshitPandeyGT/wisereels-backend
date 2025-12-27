import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notifications.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Notification routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/:notificationId/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);
router.delete('/:notificationId', deleteNotification);
router.delete('/', deleteAllNotifications);

export default router;
