"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const validators_1 = require("../utils/validators");
const router = express_1.default.Router();
/**
 * @route POST /register
 * @desc Register a new user (sends OTP)
 * @access Public
 */
router.post('/register', (0, validation_1.validateRequest)(validators_1.registerSchema), auth_controller_1.registerUser);
/**
 * @route POST /login
 * @desc Login user
 * @access Public
 */
router.post('/login', (0, validation_1.validateRequest)(validators_1.loginSchema), auth_controller_1.loginUser);
/**
 * @route GET /verify
 * @desc Verify JWT token
 * @access Authenticated users
 */
router.get('/verify', auth_1.authMiddleware, auth_controller_1.verifyToken);
/**
 * @route POST /send-otp
 * @desc Send OTP to phone number
 * @access Public
 */
router.post('/send-otp', auth_controller_1.sendOtp);
/**
 * @route POST /verify-otp
 * @desc Verify OTP and complete registration
 * @access Public
 */
router.post('/verify-otp', auth_controller_1.verifyOtpAndRegister);
exports.default = router;
