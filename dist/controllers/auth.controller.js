"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtp = exports.verifyToken = exports.loginUser = exports.verifyOtpAndRegister = exports.registerUser = void 0;
const auth_service_1 = require("../services/auth.service");
const creator_service_1 = require("../services/creator.service");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const otp_service_1 = require("../services/otp.service");
const registerUser = async (req, res) => {
    try {
        const { phoneNumber, username, displayName, firstName, lastName, email } = req.body;
        if (!phoneNumber || !username || !displayName) {
            throw new errorHandler_1.AppError(400, 'Phone number, username, and display name are required');
        }
        // Check if user exists in main users table
        const existingUser = await auth_service_1.authService.getUserByPhone(phoneNumber);
        if (existingUser) {
            throw new errorHandler_1.AppError(409, 'User already registered with this phone number');
        }
        // Check if username exists in main users table
        const existingUsername = await auth_service_1.authService.getUserByUsername(username);
        if (existingUsername) {
            throw new errorHandler_1.AppError(409, 'Username already taken');
        }
        // Store in pending_registrations
        await auth_service_1.authService.savePendingRegistration({
            phoneNumber, username, displayName, firstName, lastName, email
        });
        // Send OTP
        await otp_service_1.otpService.generateAndSendOtp(phoneNumber);
        res.status(200).json({
            success: true,
            message: 'Registration info received. OTP sent to phone number.'
        });
    }
    catch (error) {
        logger_1.logger.error('Registration error', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Registration failed',
        });
    }
};
exports.registerUser = registerUser;
const verifyOtpAndRegister = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;
        if (!phoneNumber || !otp) {
            throw new errorHandler_1.AppError(400, 'Phone number and OTP are required');
        }
        // Verify OTP
        await otp_service_1.otpService.verifyOtp(phoneNumber, otp);
        // Get pending registration
        const pending = await auth_service_1.authService.getPendingRegistration(phoneNumber);
        if (!pending)
            throw new errorHandler_1.AppError(404, 'No pending registration found');
        // Finalize user creation
        const user = await auth_service_1.authService.registerUser(pending.phone_number, pending.username, pending.display_name, pending.first_name, pending.last_name, pending.email);
        // Remove from pending_registrations
        await auth_service_1.authService.deletePendingRegistration(phoneNumber);
        // Initialize creator profile
        await creator_service_1.creatorService.initializeCreator(user.id);
        // Generate token
        const token = await auth_service_1.authService.generateAuthToken(user.id, 'USER');
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: { user, token },
        });
    }
    catch (error) {
        logger_1.logger.error('OTP verification/registration error', error);
        res.status(500).json({
            success: false,
            error: error.message || 'OTP verification/registration failed',
        });
    }
};
exports.verifyOtpAndRegister = verifyOtpAndRegister;
const loginUser = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            throw new errorHandler_1.AppError(400, 'Phone number is required');
        }
        const user = await auth_service_1.authService.getUserByPhone(phoneNumber);
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found');
        }
        const token = await auth_service_1.authService.generateAuthToken(user.id, 'USER');
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user,
                token,
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
            logger_1.logger.error('Login error', error);
            res.status(500).json({
                success: false,
                error: 'Login failed',
            });
        }
    }
};
exports.loginUser = loginUser;
const verifyToken = async (req, res) => {
    try {
        if (!req.user) {
            throw new errorHandler_1.AppError(401, 'Invalid token');
        }
        const user = await auth_service_1.authService.getUserById(req.user.userId);
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found');
        }
        res.json({
            success: true,
            data: {
                user,
                role: req.user.role,
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
            res.status(500).json({
                success: false,
                error: 'Token verification failed',
            });
        }
    }
};
exports.verifyToken = verifyToken;
const sendOtp = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber)
            throw new errorHandler_1.AppError(400, 'Phone number is required');
        await otp_service_1.otpService.generateAndSendOtp(phoneNumber);
        res.json({ success: true, message: 'OTP sent successfully' });
    }
    catch (error) {
        logger_1.logger.error('Send OTP error', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to send OTP' });
    }
};
exports.sendOtp = sendOtp;
