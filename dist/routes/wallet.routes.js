"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const wallet_controller_1 = require("../controllers/wallet.controller");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const validators_1 = require("../utils/validators");
const router = express_1.default.Router();
/**
 * @route GET /
 * @desc Get wallet info
 * @access Authenticated users
 */
router.get('/', auth_1.authMiddleware, wallet_controller_1.getWallet);
/**
 * @route POST /watch-event
 * @desc Record a video watch event for rewards
 * @access Authenticated users
 */
router.post('/watch-event', auth_1.authMiddleware, (0, validation_1.validateRequest)(validators_1.watchEventSchema), wallet_controller_1.recordWatchEvent);
/**
 * @route POST /redeem
 * @desc Redeem points for rewards
 * @access Authenticated users
 */
router.post('/redeem', auth_1.authMiddleware, (0, validation_1.validateRequest)(validators_1.redemptionSchema), wallet_controller_1.redeemPoints);
/**
 * @route POST /process-pending
 * @desc Process pending points (admin only)
 * @access Admin only
 */
router.post('/process-pending', auth_1.authMiddleware, (0, auth_1.roleMiddleware)('ADMIN'), wallet_controller_1.processPendingPoints);
exports.default = router;
