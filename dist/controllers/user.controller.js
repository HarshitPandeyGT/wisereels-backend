"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserProfile = exports.updateUserProfile = void 0;
const user_service_1 = require("../services/user.service");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const updateUserProfile = async (req, res) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Authentication required');
        const updated = await user_service_1.userService.updateUserProfile(req.user.userId, req.body);
        res.json({ success: true, message: 'Profile updated', data: updated });
    }
    catch (error) {
        logger_1.logger.error('Profile update error', error);
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.updateUserProfile = updateUserProfile;
const getUserProfile = async (req, res) => {
    try {
        if (!req.user)
            throw new errorHandler_1.AppError(401, 'Authentication required');
        const user = await user_service_1.userService.getUserById(req.user.userId);
        if (!user)
            throw new errorHandler_1.AppError(404, 'User not found');
        res.json({ success: true, data: user });
    }
    catch (error) {
        logger_1.logger.error('Get user profile error', error);
        res.status(400).json({ success: false, error: error.message });
    }
};
exports.getUserProfile = getUserProfile;
