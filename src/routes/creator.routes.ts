import express from 'express';
import {
  submitCredentials,
  verifyCreatorCredentials,
  updateCredentials,
  getCreatorById
} from '../controllers/creator.controller';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { credentialSubmissionSchema } from '../utils/validators';
import { credentialVerificationSchema } from '../utils/creatorValidators';

const router = express.Router();

/**
 * @route POST /submit-credentials
 * @desc Submit creator credentials for verification
 * @access Authenticated users
 */
router.post(
  '/submit-credentials',
  authMiddleware,
  validateRequest(credentialSubmissionSchema),
  submitCredentials
);

/**
 * @route POST /credentials/verify
 * @desc Admin verifies or rejects creator credentials
 * @access Admin only
 */
router.post(
  '/credentials/verify',
  authMiddleware,
  roleMiddleware('ADMIN'),
  validateRequest(credentialVerificationSchema),
  verifyCreatorCredentials
);

/**
 * @route PUT /credentials
 * @desc Update creator credentials (triggers re-verification)
 * @access Authenticated users
 */
router.put(
  '/credentials',
  authMiddleware,
  validateRequest(credentialSubmissionSchema),
  updateCredentials
);

/**
 * @route GET /:creatorId
 * @desc Get creator and user profile by creator ID (admin only)
 * @access Admin only
 */
router.get(
  '/:creatorId',
  authMiddleware,
  roleMiddleware('ADMIN'),
  getCreatorById
);

export default router;
