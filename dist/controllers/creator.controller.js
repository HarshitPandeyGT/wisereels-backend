"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCreatorById = exports.updateCredentials = exports.updateCreatorProfile = exports.verifyCreatorCredentials = exports.getCreatorProfile = exports.submitCredentials = void 0;
const creator_service_1 = require("../services/creator.service");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const submitCredentials = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Authentication required');
        }
        const { credentialType, credentialId, issuingBody, expiryDate } = req.body;
        if (!credentialType || !credentialId || !issuingBody || !expiryDate) {
            throw new errorHandler_1.AppError(400, 'All credential fields are required');
        }
        const creator = await creator_service_1.creatorService.submitCredentials(req.user.userId, credentialType, credentialId, issuingBody, new Date(expiryDate));
        res.json({
            success: true,
            message: 'Credentials submitted for verification',
            data: creator,
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
            logger_1.logger.error('Credential submission error', error);
            res.status(500).json({
                success: false,
                error: 'Credential submission failed',
            });
        }
    }
};
exports.submitCredentials = submitCredentials;
const getCreatorProfile = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Authentication required');
        }
        const creator = await creator_service_1.creatorService.getCreatorByUserId(req.user.userId);
        if (!creator) {
            throw new errorHandler_1.AppError(404, 'Creator profile not found');
        }
        res.json({
            success: true,
            data: creator,
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
            logger_1.logger.error('Get creator profile error', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch creator profile',
            });
        }
    }
};
exports.getCreatorProfile = getCreatorProfile;
const verifyCreatorCredentials = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            throw new errorHandler_1.AppError(403, 'Only admins can verify credentials');
        }
        const { userId, status } = req.body;
        if (!userId || !status) {
            throw new errorHandler_1.AppError(400, 'User ID and status are required');
        }
        if (!['VERIFIED', 'REJECTED'].includes(status)) {
            throw new errorHandler_1.AppError(400, 'Status must be VERIFIED or REJECTED');
        }
        const creator = await creator_service_1.creatorService.verifyCreator(userId, status, req.user.userId);
        res.json({
            success: true,
            message: `Creator ${status.toLowerCase()} successfully`,
            data: creator,
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
            logger_1.logger.error('Creator verification error', error);
            res.status(500).json({
                success: false,
                error: 'Creator verification failed',
            });
        }
    }
};
exports.verifyCreatorCredentials = verifyCreatorCredentials;
const updateCreatorProfile = async (req, res) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Authentication required');
        const { username, displayName, firstName, lastName, profilePictureUrl, bio } = req.body;
        const updated = await creator_service_1.creatorService.updateProfile(req.user.userId, {
            username,
            displayName,
            firstName,
            lastName,
            profilePictureUrl,
            bio,
        });
        res.json({ success: true, message: 'Profile updated', data: updated });
    }
    catch (error) {
        logger_1.logger.error('Profile update error', error);
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.updateCreatorProfile = updateCreatorProfile;
const updateCredentials = async (req, res) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Authentication required');
        const { credentialType, credentialId, issuingBody, expiryDate } = req.body;
        if (!credentialType || !credentialId || !issuingBody || !expiryDate) {
            throw new errorHandler_1.AppError(400, 'All credential fields are required');
        }
        const updated = await creator_service_1.creatorService.updateCredentials(req.user.userId, credentialType, credentialId, issuingBody, new Date(expiryDate));
        res.json({ success: true, message: 'Credentials updated and set for re-verification', data: updated });
    }
    catch (error) {
        logger_1.logger.error('Credential update error', error);
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.updateCredentials = updateCredentials;
const getCreatorById = async (req, res) => {
    try {
        const { creatorId } = req.params;
        if (!creatorId)
            throw new errorHandler_1.AppError(400, 'Creator ID is required');
        const creator = await creator_service_1.creatorService.getCreatorById(creatorId);
        if (!creator)
            throw new errorHandler_1.AppError(404, 'Creator not found');
        // Optionally, fetch user profile as well
        const user = await creator_service_1.creatorService.getUserProfile(creator.user_id);
        res.json({ success: true, data: { creator, user } });
    }
    catch (error) {
        logger_1.logger.error('Get creator by ID error', error);
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.getCreatorById = getCreatorById;
