"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPendingPoints = exports.redeemPoints = exports.recordWatchEvent = exports.getWallet = void 0;
const wallet_service_1 = require("../services/wallet.service");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const getWallet = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Authentication required');
        }
        const wallet = await wallet_service_1.walletService.getWallet(req.user.userId);
        if (!wallet) {
            throw new errorHandler_1.AppError(404, 'Wallet not found');
        }
        res.json({
            success: true,
            data: wallet,
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
            });
        }
        else {
            logger_1.logger.error('Get wallet error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch wallet',
            });
        }
    }
};
exports.getWallet = getWallet;
const recordWatchEvent = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Authentication required');
        }
        const { videoId, creatorId, watchDurationSeconds, category } = req.body;
        if (!videoId || !creatorId || !watchDurationSeconds || !category) {
            throw new errorHandler_1.AppError(400, 'All watch event fields are required');
        }
        await wallet_service_1.walletService.recordWatchEvent(req.user.userId, videoId, creatorId, watchDurationSeconds, category);
        const wallet = await wallet_service_1.walletService.getWallet(req.user.userId);
        res.json({
            success: true,
            message: 'Watch event recorded',
            data: wallet,
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
            });
        }
        else {
            logger_1.logger.error('Record watch event error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to record watch event',
            });
        }
    }
};
exports.recordWatchEvent = recordWatchEvent;
const redeemPoints = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Authentication required');
        }
        const { pointsToRedeem, redemptionType, details } = req.body;
        if (!pointsToRedeem || !redemptionType) {
            throw new errorHandler_1.AppError(400, 'Points to redeem and redemption type are required');
        }
        if (pointsToRedeem < 100) {
            throw new errorHandler_1.AppError(400, 'Minimum redemption is 100 points');
        }
        const redemptionId = await wallet_service_1.walletService.redeemPoints(req.user.userId, pointsToRedeem);
        res.json({
            success: true,
            message: 'Redemption request created',
            data: {
                redemptionId,
                pointsRedeemed: pointsToRedeem,
                status: 'PENDING',
            },
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
            });
        }
        else {
            logger_1.logger.error('Redemption error', error);
            res.status(500).json({
                success: false,
                error: 'Redemption failed',
            });
        }
    }
};
exports.redeemPoints = redeemPoints;
const processPendingPoints = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            throw new errorHandler_1.AppError(403, 'Only admins can process pending points');
        }
        await wallet_service_1.walletService.processPendingToAvailable();
        res.json({
            success: true,
            message: 'Pending points processed successfully',
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message,
            });
        }
        else {
            logger_1.logger.error('Process pending points error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process pending points',
            });
        }
    }
};
exports.processPendingPoints = processPendingPoints;
