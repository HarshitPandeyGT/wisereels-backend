import { v4 as uuidv4 } from 'uuid';
import { db, pool } from '../config/database';
import { cache } from '../config/cache';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ExpertApplication {
  id: string;
  user_id: string;
  category: string;
  bio: string;
  credentials: string;
  portfolio_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  is_verified: boolean;
  badge_type?: string;
  applied_at: Date;
  verified_at?: Date;
  verified_by?: string;
  rejection_reason?: string;
  admin_notes?: string;
}

export interface ExpertProfile {
  id: string;
  username: string;
  display_name: string;
  profile_pic_url: string;
  bio: string;
  expert_category: string;
  expert_status: 'pending' | 'approved' | 'rejected';
  is_expert: boolean;
  badge_type?: string;
  follower_count: number;
  verified_at?: Date;
}

class ExpertService {
  private static instance: ExpertService;

  private constructor() {}

  public static getInstance(): ExpertService {
    if (!ExpertService.instance) {
      ExpertService.instance = new ExpertService();
    }
    return ExpertService.instance;
  }

  /**
   * Apply for expert verification
   */
  async applyForExpert(
    userId: string,
    category: string,
    bio: string,
    credentials: string,
    portfolioUrl?: string
  ): Promise<ExpertApplication> {
    const client = await pool.connect();
    try {
      // Check if already has pending or approved application
      const existingQuery = `
        SELECT id FROM expert_applications 
        WHERE user_id = $1 AND status IN ('pending', 'approved')
      `;
      const existingResult = await client.query(existingQuery, [userId]);

      if (existingResult.rows.length > 0) {
        throw new AppError(400, 'You already have an active expert application');
      }

      // Validate category
      const validCategories = [
        'finance',
        'health',
        'fitness',
        'education',
        'entertainment',
        'technology',
        'business',
        'lifestyle',
      ];

      if (!validCategories.includes(category.toLowerCase())) {
        throw new AppError(400, 'Invalid category. Allowed: ' + validCategories.join(', '));
      }

      if (bio.length < 50 || bio.length > 500) {
        throw new AppError(400, 'Bio must be between 50-500 characters');
      }

      if (credentials.length < 50 || credentials.length > 1000) {
        throw new AppError(400, 'Credentials must be between 50-1000 characters');
      }

      const id = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO expert_applications 
        (id, user_id, category, bio, credentials, portfolio_url, status, is_verified, applied_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', false, $7)
        RETURNING *;
      `;

      const result = await client.query(query, [id, userId, category.toLowerCase(), bio, credentials, portfolioUrl || null, now]);

      // Invalidate cache
      await cache.del(`expert:${userId}`);

      logger.info('Expert application submitted', { userId, category, applicationId: id });

      return result.rows[0];
    } catch (error) {
      logger.error('Error applying for expert', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get application status for user
   */
  async getApplicationStatus(userId: string): Promise<ExpertApplication | null> {
    try {
      const cacheKey = `expert:${userId}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT * FROM expert_applications 
        WHERE user_id = $1
        ORDER BY applied_at DESC
        LIMIT 1;
      `;

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const application = result.rows[0];

      // Cache for 30 seconds
      await cache.set(cacheKey, application, 30);

      return application;
    } catch (error) {
      logger.error('Error fetching application status', { error, userId });
      throw new AppError(500, 'Failed to fetch application status');
    }
  }

  /**
   * Get pending applications (admin only)
   */
  async getPendingApplications(limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const query = `
        SELECT 
          ea.id, ea.user_id, ea.category, ea.bio, ea.credentials, ea.portfolio_url,
          ea.status, ea.applied_at, ea.admin_notes,
          u.username, u.display_name, u.profile_pic_url,
          COUNT(DISTINCT v.id) as video_count,
          u.follower_count
        FROM expert_applications ea
        JOIN users u ON ea.user_id = u.id
        LEFT JOIN videos v ON u.id = v.creator_id
        WHERE ea.status = 'pending'
        GROUP BY ea.id, u.id
        ORDER BY ea.applied_at ASC
        LIMIT $1 OFFSET $2;
      `;

      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching pending applications', { error });
      throw new AppError(500, 'Failed to fetch applications');
    }
  }

  /**
   * Approve expert application and activate badge
   */
  async approveApplication(applicationId: string, badgeType: string = 'verified', adminId: string, notes?: string): Promise<ExpertApplication> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get application
      const appQuery = 'SELECT * FROM expert_applications WHERE id = $1';
      const appResult = await client.query(appQuery, [applicationId]);

      if (appResult.rows.length === 0) {
        throw new AppError(404, 'Application not found');
      }

      const application = appResult.rows[0];
      const now = new Date();

      // Update application
      const updateAppQuery = `
        UPDATE expert_applications 
        SET status = 'approved', is_verified = true, verified_at = $1, verified_by = $2, admin_notes = $3
        WHERE id = $4
        RETURNING *;
      `;

      const updateResult = await client.query(updateAppQuery, [now, adminId, notes || null, applicationId]);

      // Update user record
      const updateUserQuery = `
        UPDATE users 
        SET expert_status = 'approved', expert_category = $1, is_expert = true, expert_badge_type = $2
        WHERE id = $3;
      `;

      await client.query(updateUserQuery, [application.category, badgeType, application.user_id]);

      // Create notification for user
      const notificationId = uuidv4();
      const notifQuery = `
        INSERT INTO notifications 
        (id, user_id, type, title, description, is_read, created_at, updated_at)
        VALUES ($1, $2, 'expert_alert', 'Expert Status Approved', 'Congratulations! Your expert application has been approved.', false, $3, $4);
      `;

      await client.query(notifQuery, [notificationId, application.user_id, now, now]);

      await client.query('COMMIT');

      // Invalidate cache
      await cache.del(`expert:${application.user_id}`);
      await cache.del(`user:${application.user_id}`);

      logger.info('Expert application approved', { applicationId, userId: application.user_id, approvedBy: adminId });

      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error approving application', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject expert application
   */
  async rejectApplication(applicationId: string, adminId: string, reason: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get application
      const appQuery = 'SELECT * FROM expert_applications WHERE id = $1';
      const appResult = await client.query(appQuery, [applicationId]);

      if (appResult.rows.length === 0) {
        throw new AppError(404, 'Application not found');
      }

      const application = appResult.rows[0];
      const now = new Date();

      // Update application
      const updateQuery = `
        UPDATE expert_applications 
        SET status = 'rejected', verified_by = $1, rejection_reason = $2, admin_notes = $3
        WHERE id = $4;
      `;

      await client.query(updateQuery, [adminId, reason, reason, applicationId]);

      // Create notification
      const notificationId = uuidv4();
      const notifQuery = `
        INSERT INTO notifications 
        (id, user_id, type, title, description, is_read, created_at, updated_at)
        VALUES ($1, $2, 'expert_alert', 'Expert Application Rejected', $3, false, $4, $5);
      `;

      await client.query(notifQuery, [notificationId, application.user_id, `Your application was rejected: ${reason}`, now, now]);

      await client.query('COMMIT');

      // Invalidate cache
      await cache.del(`expert:${application.user_id}`);

      logger.info('Expert application rejected', { applicationId, userId: application.user_id, rejectedBy: adminId });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error rejecting application', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get expert profile (public)
   */
  async getExpertProfile(username: string): Promise<ExpertProfile | null> {
    try {
      const cacheKey = `expert_profile:${username}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.profile_pic_url, u.bio,
          u.expert_category, u.expert_status, u.is_expert, u.expert_badge_type,
          u.follower_count,
          ea.verified_at
        FROM users u
        LEFT JOIN expert_applications ea ON u.id = ea.user_id AND ea.status = 'approved'
        WHERE u.username = $1 AND u.is_expert = true;
      `;

      const result = await pool.query(query, [username.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      const profile = result.rows[0];

      // Cache for 5 minutes
      await cache.set(cacheKey, profile, 300);

      return profile;
    } catch (error) {
      logger.error('Error fetching expert profile', { error, username });
      throw new AppError(500, 'Failed to fetch expert profile');
    }
  }

  /**
   * Get experts by category
   */
  async getExpertsByCategory(category: string, limit: number = 20, offset: number = 0): Promise<ExpertProfile[]> {
    try {
      const cacheKey = `experts:${category}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.profile_pic_url, u.bio,
          u.expert_category, u.expert_status, u.is_expert, u.expert_badge_type,
          u.follower_count,
          ea.verified_at,
          COUNT(DISTINCT v.id) as video_count
        FROM users u
        LEFT JOIN expert_applications ea ON u.id = ea.user_id AND ea.status = 'approved'
        LEFT JOIN videos v ON u.id = v.creator_id
        WHERE u.is_expert = true AND u.expert_category = $1 AND u.expert_status = 'approved'
        GROUP BY u.id, ea.verified_at
        ORDER BY u.follower_count DESC, ea.verified_at DESC
        LIMIT $2 OFFSET $3;
      `;

      const result = await pool.query(query, [category.toLowerCase(), limit, offset]);

      // Cache for 10 minutes
      await cache.set(cacheKey, result.rows, 600);

      return result.rows;
    } catch (error) {
      logger.error('Error fetching experts by category', { error, category });
      throw new AppError(500, 'Failed to fetch experts');
    }
  }

  /**
   * Get verification queue stats (admin only)
   */
  async getQueueStats(): Promise<any> {
    try {
      const query = `
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
          COUNT(DISTINCT category) as total_categories,
          MIN(applied_at) as oldest_pending_date
        FROM expert_applications
        WHERE status = 'pending' OR status = 'approved' OR status = 'rejected';
      `;

      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching queue stats', { error });
      throw new AppError(500, 'Failed to fetch stats');
    }
  }
}

export default ExpertService.getInstance();
