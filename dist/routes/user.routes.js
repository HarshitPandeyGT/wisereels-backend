"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("../controllers/user.controller");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const userValidators_1 = require("../utils/userValidators");
const router = express_1.default.Router();
/**
 * @route PUT /profile
 * @desc Update user profile
 * @access Authenticated users
 */
router.put('/profile', auth_1.authMiddleware, (0, validation_1.validateRequest)(userValidators_1.userProfileUpdateSchema), user_controller_1.updateUserProfile);
/**
 * @route GET /profile
 * @desc Get user profile
 * @access Authenticated users
 */
router.get('/profile', auth_1.authMiddleware, user_controller_1.getUserProfile);
exports.default = router;
