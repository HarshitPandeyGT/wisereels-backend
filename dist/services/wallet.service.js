"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletService = void 0;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
// Earning rates per 10 minutes
const EARNING_RATES = {
    FINANCE: 500,
    HEALTH: 400,
    FITNESS: 300,
    EDUCATION: 200,
    ENTERTAINMENT: 100,
};
class WalletService {
    async getWallet(userId) {
        const cached = await redis_1.redis.get(`wallet:${userId}`);
        if (cached) {
            return JSON.parse(cached);
        }
        const query = `SELECT * FROM wallet WHERE user_id = $1`;
        const wallet = await database_1.db.queryOne(query, [userId]);
        if (wallet) {
            await redis_1.redis.set(`wallet:${userId}`, JSON.stringify(wallet), 30);
        }
        return wallet;
    }
    async recordWatchEvent(userId, videoId, creatorId, watchDurationSeconds, category) {
        try {
            // Validate watch (minimum 5 seconds per watch event)
            if (watchDurationSeconds < 5) {
                logger_1.logger.info(`Watch too short: ${userId}, ${videoId}, ${watchDurationSeconds}s`);
                return;
            }
            // Calculate points
            const ratePerTenMin = EARNING_RATES[category] || 100;
            const points = Math.floor((watchDurationSeconds / 600) * ratePerTenMin);
            if (points <= 0) {
                return; // Too short to earn
            }
            // Record in ledger
            await this.recordEarning(userId, videoId, creatorId, points, category, watchDurationSeconds, ratePerTenMin);
            // Update wallet (pending points)
            await this.updateWalletPending(userId, points);
        }
        catch (error) {
            logger_1.logger.error('Watch event recording failed', error);
            throw error;
        }
    }
    async recordEarning(userId, videoId, creatorId, points, category, watchDurationSeconds, ratePerTenMin) {
        const transactionId = (0, uuid_1.v4)();
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
        await database_1.db.query(query, [
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
        logger_1.logger.info(`Earning recorded: ${transactionId}`);
    }
    async updateWalletPending(userId, points) {
        const query = `
      UPDATE wallet 
      SET pending_points = pending_points + $1, updated_at = $2
      WHERE user_id = $3
    `;
        await database_1.db.query(query, [points, new Date(), userId]);
        // Invalidate cache
        await redis_1.redis.del(`wallet:${userId}`);
    }
    async processPendingToAvailable() {
        const query = `
      SELECT * FROM ledger_transactions
      WHERE status = $1 
      AND posted_at <= NOW() - INTERVAL '30 days'
    `;
        try {
            const transactions = await database_1.db.query(query, ['POSTED']);
            for (const transaction of transactions) {
                // Update transaction status
                await database_1.db.query(`UPDATE ledger_transactions SET status = $1 WHERE id = $2`, ['AVAILABLE', transaction.id]);
                // Update wallet
                await database_1.db.query(`UPDATE wallet 
           SET available_points = available_points + $1,
               pending_points = pending_points - $1,
               updated_at = $2
           WHERE user_id = $3`, [transaction.points, new Date(), transaction.user_id]);
                // Invalidate cache
                await redis_1.redis.del(`wallet:${transaction.user_id}`);
            }
            logger_1.logger.info(`Processed ${transactions.length} transactions to available`);
        }
        catch (error) {
            logger_1.logger.error('Pending to available processing failed', error);
            throw error;
        }
    }
    async redeemPoints(userId, pointsToRedeem) {
        const wallet = await this.getWallet(userId);
        if (!wallet || wallet.available_points < pointsToRedeem) {
            throw new Error('Insufficient points');
        }
        const redemptionId = (0, uuid_1.v4)();
        const now = new Date();
        const query = `
      INSERT INTO redemption_requests (
        id, user_id, amount_points, redemption_type, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
        try {
            const result = await database_1.db.queryOne(query, [
                redemptionId,
                userId,
                pointsToRedeem,
                'UPI',
                'PENDING',
                now,
            ]);
            // Deduct points immediately (with ledger entry)
            await database_1.db.query(`UPDATE wallet 
         SET available_points = available_points - $1, updated_at = $2
         WHERE user_id = $3`, [pointsToRedeem, now, userId]);
            // Record in ledger
            await database_1.db.query(`INSERT INTO ledger_transactions (
          id, user_id, transaction_type, points, status, posted_at, created_at, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                (0, uuid_1.v4)(),
                userId,
                'REDEEMED',
                -pointsToRedeem,
                'REDEEMED',
                now,
                now,
                'Redemption request',
            ]);
            await redis_1.redis.del(`wallet:${userId}`);
            logger_1.logger.info(`Redemption created: ${redemptionId}`);
            return result?.id || redemptionId;
        }
        catch (error) {
            logger_1.logger.error('Redemption failed', error);
            throw error;
        }
    }
}
exports.walletService = new WalletService();
