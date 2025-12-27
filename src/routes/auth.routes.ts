import express from 'express';
import {
  registerUser,
  loginUser,
  verifyToken,
  sendOtp,
  verifyOtpAndRegister,
  refreshToken,
  logout,
  getActiveSessions,
  revokeSession,
  deleteAccount,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { registerSchema, loginSchema } from '../utils/validators';

const router = express.Router();

/**
 * @route POST /register
 * @desc Register a new user (sends OTP)
 * @access Public
 */
router.post('/register', validateRequest(registerSchema), registerUser);

/**
 * @route POST /login
 * @desc Login user
 * @access Public
 */
router.post('/login', validateRequest(loginSchema), loginUser);

/**
 * @route GET /verify
 * @desc Verify JWT token
 * @access Authenticated users
 */
router.get('/verify', authMiddleware, verifyToken);

/**
 * @route POST /send-otp
 * @desc Send OTP to phone number
 * @access Public
 */
router.post('/send-otp', sendOtp);

/**
 * @route POST /verify-otp
 * @desc Verify OTP and complete registration
 * @access Public
 */
router.post('/verify-otp', verifyOtpAndRegister);

/**
 * @route POST /refresh
 * @desc Refresh access token
 * @access Authenticated users
 */
router.post('/refresh', authMiddleware, refreshToken);

/**
 * @route POST /logout
 * @desc Logout user
 * @access Authenticated users
 */
router.post('/logout', authMiddleware, logout);

/**
 * @route GET /sessions
 * @desc Get active sessions
 * @access Authenticated users
 */
router.get('/sessions', authMiddleware, getActiveSessions);

/**
 * @route DELETE /sessions/:sessionId
 * @desc Revoke specific session
 * @access Authenticated users
 */
router.delete('/sessions/:sessionId', authMiddleware, revokeSession);

/**
 * @route DELETE /account
 * @desc Delete user account
 * @access Authenticated users
 */
router.delete('/account', authMiddleware, deleteAccount);

export default router;
