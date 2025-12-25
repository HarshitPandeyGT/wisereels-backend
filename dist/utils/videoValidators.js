"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoCommentSchema = exports.videoLikeSchema = exports.videoPublishSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.videoPublishSchema = joi_1.default.object({
    videoId: joi_1.default.string().uuid().required(),
});
exports.videoLikeSchema = joi_1.default.object({
// No body, but could add userId if needed
});
exports.videoCommentSchema = joi_1.default.object({
    comment: joi_1.default.string().min(1).max(500).required(),
});
