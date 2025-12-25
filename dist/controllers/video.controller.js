"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentOnVideo = exports.likeVideo = exports.getCreatorVideos = exports.getVideo = exports.publishVideo = exports.uploadVideo = void 0;
const video_service_1 = require("../services/video.service");
const creator_service_1 = require("../services/creator.service");
const wallet_service_1 = require("../services/wallet.service");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const uploadVideo = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Authentication required');
        }
        const { title, description, category, durationSeconds } = req.body;
        if (!title || !category || !durationSeconds) {
            throw new errorHandler_1.AppError(400, 'Title, category, and duration are required');
        }
        // Check if creator can post in this category
        if (['FINANCE', 'HEALTH', 'FITNESS'].includes(category)) {
            const canPost = await creator_service_1.creatorService.canPostRestrictedContent(req.user.userId);
            if (!canPost) {
                throw new errorHandler_1.AppError(403, 'You are not verified to post in this category');
            }
        }
        // Get creator ID
        const creator = await creator_service_1.creatorService.getCreatorByUserId(req.user.userId);
        if (!creator) {
            throw new errorHandler_1.AppError(404, 'Creator profile not found');
        }
        const video = await video_service_1.videoService.uploadVideo(creator.id, title, description, category, durationSeconds);
        res.status(201).json({
            success: true,
            message: 'Video uploaded successfully',
            data: video,
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
            logger_1.logger.error('Video upload error', error);
            res.status(500).json({
                success: false,
                error: 'Video upload failed',
            });
        }
    }
};
exports.uploadVideo = uploadVideo;
const publishVideo = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Authentication required');
        }
        const { videoId } = req.params;
        if (!videoId) {
            throw new errorHandler_1.AppError(400, 'Video ID is required');
        }
        const video = await video_service_1.videoService.publishVideo(videoId);
        res.json({
            success: true,
            message: 'Video published successfully',
            data: video,
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
            logger_1.logger.error('Video publication error', error);
            res.status(500).json({
                success: false,
                error: 'Video publication failed',
            });
        }
    }
};
exports.publishVideo = publishVideo;
const getVideo = async (req, res) => {
    try {
        const { videoId } = req.params;
        if (!videoId) {
            throw new errorHandler_1.AppError(400, 'Video ID is required');
        }
        const video = await video_service_1.videoService.getVideoById(videoId);
        if (!video) {
            throw new errorHandler_1.AppError(404, 'Video not found');
        }
        // Record watch event if user is authenticated
        if (req.user) {
            const creator = await creator_service_1.creatorService.getCreatorByUserId(req.user.userId);
            if (creator && video.creator_id !== creator.id) {
                // Only record if user is not the creator
                await wallet_service_1.walletService.recordWatchEvent(req.user.userId, videoId, video.creator_id, 10, // Default 10 seconds for API call
                video.category);
            }
            // Increment view count
            await video_service_1.videoService.incrementViewCount(videoId);
        }
        res.json({
            success: true,
            data: video,
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
            logger_1.logger.error('Get video error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch video',
            });
        }
    }
};
exports.getVideo = getVideo;
const getCreatorVideos = async (req, res) => {
    try {
        const { creatorId } = req.params;
        const { limit = '20', offset = '0' } = req.query;
        if (!creatorId) {
            throw new errorHandler_1.AppError(400, 'Creator ID is required');
        }
        const videos = await video_service_1.videoService.getVideosByCreator(creatorId, parseInt(limit), parseInt(offset));
        res.json({
            success: true,
            data: {
                videos,
                count: videos.length,
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
            logger_1.logger.error('Get creator videos error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch creator videos',
            });
        }
    }
};
exports.getCreatorVideos = getCreatorVideos;
const likeVideo = async (req, res) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Authentication required');
        const { videoId } = req.params;
        if (!videoId)
            throw new errorHandler_1.AppError(400, 'Video ID is required');
        const result = await video_service_1.videoService.likeVideo(req.user.userId, videoId);
        res.json({ success: true, message: result.message });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.likeVideo = likeVideo;
const commentOnVideo = async (req, res) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Authentication required');
        const { videoId } = req.params;
        const { comment } = req.body;
        if (!videoId || !comment)
            throw new errorHandler_1.AppError(400, 'Video ID and comment are required');
        const result = await video_service_1.videoService.commentOnVideo(req.user.userId, videoId, comment);
        res.status(201).json({ success: true, message: 'Comment added', data: result });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.commentOnVideo = commentOnVideo;
