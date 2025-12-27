import { db } from '../config/database';
import { cache } from '../config/cache';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Earning rates per 10 minutes
const EARNING_RATES = {
  FINANCE: 500,
  HEALTH: 400,
  FITNESS: 300,
  EDUCATION: 200,
  ENTERTAINMENT: 100,
};

export interface Wallet {
  user_id: string;
  pending_points: number;
  available_points: number;
  total_earned: number;
  total_redeemed: number;
  updated_at: Date;
}

export interface LedgerTransaction {
  id: string;
  user_id: string;
  video_id?: string;
  creator_id?: string;
  transaction_type: 'EARN' | 'PENDING' | 'AVAILABLE' | 'REDEEMED' | 'REVERSED' | 'EXPIRED' | 'BONUS';
  points: number;
  status: 'POSTED' | 'PENDING_30D' | 'AVAILABLE' | 'EXPIRED' | 'REDEEMED';
  posted_at: Date;
  available_at?: Date;
  expires_at?: Date;
}

class WalletService {
  async getWallet(userId: string): Promise<Wallet | null> {
    const cached = await cache.get(`wallet:${userId}`);
    if (cached) {
      return cached;
    }

    const query = `SELECT * FROM wallet WHERE user_id = $1`;
    const wallet = await db.queryOne<Wallet>(query, [userId]);

    if (wallet) {
      await cache.set(`wallet:${userId}`, wallet, 30);
    }

    return wallet;
  }

  async recordWatchEvent(
    userId: string,
    videoId: string,
    creatorId: string,
    watchDurationSeconds: number,
    category: string
  ): Promise<void> {
    try {
      // Validate watch (minimum 5 seconds per watch event)
      if (watchDurationSeconds < 5) {
        logger.info(`Watch too short: ${userId}, ${videoId}, ${watchDurationSeconds}s`);
        return;
      }

      // Calculate points
      const ratePerTenMin = EARNING_RATES[category as keyof typeof EARNING_RATES] || 100;
      const points = Math.floor((watchDurationSeconds / 600) * ratePerTenMin);

      if (points <= 0) {
        return; // Too short to earn
      }

      // Record in ledger
      await this.recordEarning(
        userId,
        videoId,
        creatorId,
        points,
        category,
        watchDurationSeconds,
        ratePerTenMin
      );

      // Update wallet (pending points)
      await this.updateWalletPending(userId, points);
    } catch (error) {
      logger.error('Watch event recording failed', error);
      throw error;
    }
  }

  private async recordEarning(
    userId: string,
    videoId: string,
    creatorId: string,
    points: number,
    category: string,
    watchDurationSeconds: number,
    ratePerTenMin: number
  ): Promise<void> {
    const transactionId = uuidv4();
    const now = new Date();
    const availableAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const expiresAt = new Date(availableAt.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days after available

    const query = `
      INSERT INTO ledger_transactions (
        id, user_id, video_id, creator_id, transaction_type, points,
        category, watch_duration_seconds, rate_per_10m, status,
        posted_at, available_at, expires_at, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    await db.query(query, [
      transactionId,
      userId,
      videoId,
      creatorId,
      'EARN',
      points,
      category,
      watchDurationSeconds,
      ratePerTenMin,
      'POSTED',
      now,
      availableAt,
      expiresAt,
      'Video watched',
      now,
    ]);

    logger.info(`Earning recorded: ${transactionId}`);
  }

  private async updateWalletPending(userId: string, points: number): Promise<void> {
    const query = `
      UPDATE wallet 
      SET pending_points = pending_points + $1, updated_at = $2
      WHERE user_id = $3
    `;

    await db.query(query, [points, new Date(), userId]);

    // Invalidate cache
    await cache.del(`wallet:${userId}`);
  }

  async processPendingToAvailable(): Promise<void> {
    const query = `
      SELECT * FROM ledger_transactions
      WHERE status = $1 
      AND posted_at <= NOW() - INTERVAL '30 days'
    `;

    try {
      const transactions = await db.query<LedgerTransaction>(query, ['POSTED']);

      for (const transaction of transactions) {
        // Update transaction status
        await db.query(
          `UPDATE ledger_transactions SET status = $1 WHERE id = $2`,
          ['AVAILABLE', transaction.id]
        );

        // Update wallet
        await db.query(
          `UPDATE wallet 
           SET available_points = available_points + $1,
               pending_points = pending_points - $1,
               updated_at = $2
           WHERE user_id = $3`,
          [transaction.points, new Date(), transaction.user_id]
        );

        // Invalidate cache
        await cache.del(`wallet:${transaction.user_id}`);
      }

      logger.info(`Processed ${transactions.length} transactions to available`);
    } catch (error) {
      logger.error('Pending to available processing failed', error);
      throw error;
    }
  }

  /**
   * Wallet Heartbeat: Update watch progress every 30 seconds
   * Applies tier-based multipliers (Gold: 5x, Silver: 3x, Bronze: 1x)
   */
  async recordWatchHeartbeat(
    userId: string,
    videoId: string,
    creatorId: string,
    watchDurationSeconds: number,
    category: string
  ): Promise<{
    pendingPoints: number;
    availablePoints: number;
    pointsEarned: number;
    multiplier: number;
  }> {
    try {
      // Get user's expert status (determines multiplier)
      const userQuery = `SELECT expert_status FROM users WHERE id = $1`;
      const userResult = await db.queryOne<{ expert_status: string }>(userQuery, [userId]);

      if (!userResult) {
        throw new Error('User not found');
      }

      // Determine tier multiplier
      const multiplierMap: { [key: string]: number } = {
        verified: 5, // Gold tier for verified experts
        pending: 3, // Silver tier for pending verification
        none: 1, // Bronze tier for regular users
      };

      const tierMultiplier = multiplierMap[userResult.expert_status] || 1;

      // Calculate points with tier multiplier
      const ratePerTenMin = EARNING_RATES[category as keyof typeof EARNING_RATES] || 100;
      const basePoints = Math.floor((watchDurationSeconds / 600) * ratePerTenMin);
      const pointsWithMultiplier = Math.floor(basePoints * tierMultiplier);

      if (pointsWithMultiplier > 0) {
        // Record earning with multiplier info
        const transactionId = uuidv4();
        const now = new Date();
        const availableAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const expiresAt = new Date(availableAt.getTime() + 90 * 24 * 60 * 60 * 1000);

        const insertQuery = `
          INSERT INTO transactions (
            id, user_id, type, amount, video_id, created_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        const metadata = {
          base_points: basePoints,
          multiplier: tierMultiplier,
          tier: userResult.expert_status,
          watch_duration_seconds: watchDurationSeconds,
          category,
          heartbeat: true,
        };

        await db.query(insertQuery, [
          transactionId,
          userId,
          'earn',
          pointsWithMultiplier,
          videoId,
          now,
          JSON.stringify(metadata),
        ]);

        // Update wallet pending points
        await db.query(
          `UPDATE wallet 
           SET pending_points = pending_points + $1, updated_at = $2
           WHERE user_id = $3`,
          [pointsWithMultiplier, now, userId]
        );

        // Invalidate cache
        await cache.del(`wallet:${userId}`);

        logger.info('Heartbeat recorded', {
          userId,
          videoId,
          basePoints,
          multiplier: tierMultiplier,
          totalPoints: pointsWithMultiplier,
          tier: userResult.expert_status,
        });
      }

      // Return updated wallet balances
      const wallet = await this.getWallet(userId);
      if (!wallet) {
        throw new Error('Failed to fetch updated wallet');
      }

      return {
        pendingPoints: wallet.pending_points,
        availablePoints: wallet.available_points,
        pointsEarned: pointsWithMultiplier,
        multiplier: tierMultiplier,
      };
    } catch (error) {
      logger.error('Heartbeat recording failed', error);
      throw error;
    }
  }

  /**
   * Get wallet options (payment methods and redemption options)
   */
  async getWalletOptions(): Promise<{
    paymentMethods: Array<{ id: string; name: string; minAmount: number }>;
    giftCards: Array<{ id: string; provider: string; denominations: number[] }>;
  }> {
    return {
      paymentMethods: [
        { id: 'upi', name: 'UPI (Google Pay, PhonePe, Paytm)', minAmount: 100 },
        { id: 'recharge', name: 'Mobile Recharge', minAmount: 50 },
        { id: 'bank_transfer', name: 'Bank Transfer', minAmount: 500 },
      ],
      giftCards: [
        {
          id: 'amazon',
          provider: 'Amazon',
          denominations: [100, 250, 500, 1000, 2000, 5000],
        },
        { id: 'flipkart', provider: 'Flipkart', denominations: [100, 250, 500, 1000, 2000] },
        {
          id: 'netflix',
          provider: 'Netflix',
          denominations: [149, 399, 649, 799],
        },
        {
          id: 'spotify',
          provider: 'Spotify',
          denominations: [99, 249, 499, 999],
        },
      ],
    };
  }

  async redeemPoints(userId: string, pointsToRedeem: number): Promise<string> {
    const wallet = await this.getWallet(userId);
    if (!wallet || wallet.available_points < pointsToRedeem) {
      throw new Error('Insufficient points');
    }

    const redemptionId = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO redemption_requests (
        id, user_id, amount_points, redemption_type, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    try {
      const result = await db.queryOne<{ id: string }>(query, [
        redemptionId,
        userId,
        pointsToRedeem,
        'UPI',
        'PENDING',
        now,
      ]);

      // Deduct points immediately (with ledger entry)
      await db.query(
        `UPDATE wallet 
         SET available_points = available_points - $1, updated_at = $2
         WHERE user_id = $3`,
        [pointsToRedeem, now, userId]
      );

      // Record in ledger
      await db.query(
        `INSERT INTO ledger_transactions (
          id, user_id, transaction_type, points, status, posted_at, created_at, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          userId,
          'REDEEMED',
          -pointsToRedeem,
          'REDEEMED',
          now,
          now,
          'Redemption request',
        ]
      );

      await cache.del(`wallet:${userId}`);

      logger.info(`Redemption created: ${redemptionId}`);
      return result?.id || redemptionId;
    } catch (error) {
      logger.error('Redemption failed', error);
      throw error;
    }
  }
}

export const walletService = new WalletService();
