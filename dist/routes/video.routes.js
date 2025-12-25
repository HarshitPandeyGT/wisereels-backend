"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const video_controller_1 = require("../controllers/video.controller");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const validators_1 = require("../utils/validators");
const videoValidators_1 = require("../utils/videoValidators");
const router = express_1.default.Router();
/**
 * @route POST /upload
 * @desc Upload a new video
 * @access Authenticated creators
 */
router.post('/upload', auth_1.authMiddleware, (0, validation_1.validateRequest)(validators_1.videoUploadSchema), video_controller_1.uploadVideo);
/**
 * @route POST /:videoId/publish
 * @desc Publish a video
 * @access Authenticated creators
 */
router.post('/:videoId/publish', auth_1.authMiddleware, (0, validation_1.validateRequest)(videoValidators_1.videoPublishSchema), video_controller_1.publishVideo);
/**
 * @route GET /:videoId
 * @desc Get video by ID
 * @access Public
 */
router.get('/:videoId', video_controller_1.getVideo);
/**
 * @route GET /creator/:creatorId
 * @desc Get all videos by creator
 * @access Public
 */
router.get('/creator/:creatorId', video_controller_1.getCreatorVideos);
/**
 * @route POST /:videoId/like
 * @desc Like a video
 * @access Authenticated users
 */
router.post('/:videoId/like', auth_1.authMiddleware, video_controller_1.likeVideo);
/**
 * @route POST /:videoId/comment
 * @desc Comment on a video
 * @access Authenticated users
 */
router.post('/:videoId/comment', auth_1.authMiddleware, (0, validation_1.validateRequest)(videoValidators_1.videoCommentSchema), video_controller_1.commentOnVideo);
exports.default = router;
