import express from 'express';
import {
  registerUser,
  loginUser,
  verifyToken,
  sendOtp,
  verifyOtpAndRegister,
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

export default router;
