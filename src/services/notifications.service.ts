import { v4 as uuidv4 } from 'uuid';
import { db, pool } from '../config/database';
import { cache } from '../config/cache';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface Notification {
  id: string;
  user_id: string;
  sender_id?: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'message' | 'story_reply' | 'expert_alert' | 'points_update';
  related_id?: string;
  related_type?: string;
  title: string;
  description?: string;
  icon_url?: string;
  is_read: boolean;
  created_at: Date;
  updated_at: Date;
}

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a notification
   */
  async createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    senderId?: string,
    relatedId?: string,
    relatedType?: string,
    description?: string,
    iconUrl?: string
  ): Promise<Notification> {
    const client = await pool.connect();
    try {
      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO notifications 
        (id, user_id, sender_id, type, related_id, related_type, title, description, icon_url, is_read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11)
        RETURNING *;
      `;

      const result = await client.query(query, [
        id,
        userId,
        senderId || null,
        type,
        relatedId || null,
        relatedType || null,
        title,
        description || null,
        iconUrl || null,
        now,
        now,
      ]);

      const notification = result.rows[0];

      // Invalidate notification cache
      await cache.del(`notifications:${userId}`);
      await cache.del(`unread:${userId}`);

      logger.info('Notification created', { userId, type, notificationId: id });

      return notification;
    } catch (error) {
      logger.error('Error creating notification', { error });
      throw new AppError(500, 'Failed to create notification');
    } finally {
      client.release();
    }
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    type?: Notification['type']
  ): Promise<Notification[]> {
    try {
      const cacheKey = `notifications:${userId}:${type || 'all'}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      let query = `
        SELECT * FROM notifications
        WHERE user_id = $1
      `;
      const params: any[] = [userId];

      if (type) {
        query += ` AND type = $${params.length + 1}`;
        params.push(type);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      const notifications = result.rows;

      // Cache for 5 minutes
      await cache.set(cacheKey, notifications, 300);

      return notifications;
    } catch (error) {
      logger.error('Error fetching notifications', { error });
      throw new AppError(500, 'Failed to fetch notifications');
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const cacheKey = `unread:${userId}`;
      const cached = await cache.get(cacheKey);

      if (cached !== null && cached !== undefined) {
        return cached;
      }

      const result = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      const count = parseInt(result.rows[0].count, 10);

      // Cache for 1 minute
      await cache.set(cacheKey, count, 60);

      return count;
    } catch (error) {
      logger.error('Error fetching unread count', { error });
      throw new AppError(500, 'Failed to fetch unread count');
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const client = await pool.connect();
    try {
      const now = new Date();

      const query = `
        UPDATE notifications 
        SET is_read = true, updated_at = $1
        WHERE id = $2 AND user_id = $3
        RETURNING *;
      `;

      const result = await client.query(query, [now, notificationId, userId]);

      if (result.rows.length === 0) {
        throw new AppError(404, 'Notification not found');
      }

      // Invalidate cache
      await cache.del(`notifications:${userId}:all:*`);
      await cache.del(`unread:${userId}`);

      logger.info('Notification marked as read', { notificationId, userId });

      return result.rows[0];
    } catch (error) {
      logger.error('Error marking notification as read', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const client = await pool.connect();
    try {
      const now = new Date();

      const query = `
        UPDATE notifications 
        SET is_read = true, updated_at = $1
        WHERE user_id = $2 AND is_read = false;
      `;

      const result = await client.query(query, [now, userId]);

      // Invalidate cache
      await cache.del(`notifications:${userId}:all:*`);
      await cache.del(`unread:${userId}`);

      logger.info('All notifications marked as read', { userId, count: result.rowCount });

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error marking all notifications as read', { error });
      throw new AppError(500, 'Failed to mark notifications as read');
    } finally {
      client.release();
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      const query = `
        DELETE FROM notifications 
        WHERE id = $1 AND user_id = $2;
      `;

      const result = await client.query(query, [notificationId, userId]);

      if (result.rowCount === 0) {
        throw new AppError(404, 'Notification not found');
      }

      // Invalidate cache
      await cache.del(`notifications:${userId}:all:*`);
      await cache.del(`unread:${userId}`);

      logger.info('Notification deleted', { notificationId, userId });
    } catch (error) {
      logger.error('Error deleting notification', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId: string): Promise<number> {
    const client = await pool.connect();
    try {
      const query = 'DELETE FROM notifications WHERE user_id = $1;';

      const result = await client.query(query, [userId]);

      // Invalidate cache
      await cache.del(`notifications:${userId}:all:*`);
      await cache.del(`unread:${userId}`);

      logger.info('All notifications deleted', { userId, count: result.rowCount });

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Error deleting all notifications', { error });
      throw new AppError(500, 'Failed to delete notifications');
    } finally {
      client.release();
    }
  }

  /**
   * Get notifications by type
   */
  async getNotificationsByType(
    userId: string,
    type: Notification['type'],
    limit: number = 20,
    offset: number = 0
  ): Promise<Notification[]> {
    return this.getNotifications(userId, limit, offset, type);
  }

  /**
   * Create bulk notifications (for batch operations)
   */
  async createBulkNotifications(
    notifications: Array<{
      userId: string;
      type: Notification['type'];
      title: string;
      senderId?: string;
      relatedId?: string;
      relatedType?: string;
      description?: string;
      iconUrl?: string;
    }>
  ): Promise<Notification[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const results: Notification[] = [];
      const now = new Date();

      for (const notif of notifications) {
        const id = uuidv4();

        const query = `
          INSERT INTO notifications 
          (id, user_id, sender_id, type, related_id, related_type, title, description, icon_url, is_read, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11)
          RETURNING *;
        `;

        const result = await client.query(query, [
          id,
          notif.userId,
          notif.senderId || null,
          notif.type,
          notif.relatedId || null,
          notif.relatedType || null,
          notif.title,
          notif.description || null,
          notif.iconUrl || null,
          now,
          now,
        ]);

        results.push(result.rows[0]);

        // Invalidate cache for this user
        await cache.del(`notifications:${notif.userId}`);
        await cache.del(`unread:${notif.userId}`);
      }

      await client.query('COMMIT');

      logger.info('Bulk notifications created', { count: notifications.length });

      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating bulk notifications', { error });
      throw new AppError(500, 'Failed to create notifications');
    } finally {
      client.release();
    }
  }
}

export default NotificationService.getInstance();
