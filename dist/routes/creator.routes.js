"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const creator_controller_1 = require("../controllers/creator.controller");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const validators_1 = require("../utils/validators");
const creatorValidators_1 = require("../utils/creatorValidators");
const router = express_1.default.Router();
/**
 * @route POST /submit-credentials
 * @desc Submit creator credentials for verification
 * @access Authenticated users
 */
router.post('/submit-credentials', auth_1.authMiddleware, (0, validation_1.validateRequest)(validators_1.credentialSubmissionSchema), creator_controller_1.submitCredentials);
/**
 * @route POST /credentials/verify
 * @desc Admin verifies or rejects creator credentials
 * @access Admin only
 */
router.post('/credentials/verify', auth_1.authMiddleware, (0, auth_1.roleMiddleware)('ADMIN'), (0, validation_1.validateRequest)(creatorValidators_1.credentialVerificationSchema), creator_controller_1.verifyCreatorCredentials);
/**
 * @route PUT /credentials
 * @desc Update creator credentials (triggers re-verification)
 * @access Authenticated users
 */
router.put('/credentials', auth_1.authMiddleware, (0, validation_1.validateRequest)(validators_1.credentialSubmissionSchema), creator_controller_1.updateCredentials);
/**
 * @route GET /:creatorId
 * @desc Get creator and user profile by creator ID (admin only)
 * @access Admin only
 */
router.get('/:creatorId', auth_1.authMiddleware, (0, auth_1.roleMiddleware)('ADMIN'), creator_controller_1.getCreatorById);
exports.default = router;
