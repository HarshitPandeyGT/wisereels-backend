"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userProfileUpdateSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.userProfileUpdateSchema = joi_1.default.object({
    username: joi_1.default.string().alphanum().min(3).max(32).optional(),
    displayName: joi_1.default.string().min(3).max(50).optional(),
    firstName: joi_1.default.string().max(50).optional(),
    lastName: joi_1.default.string().max(50).optional(),
    email: joi_1.default.string().email().optional(),
    avatar_url: joi_1.default.string().uri().optional(),
    bio: joi_1.default.string().max(500).optional(),
    settings: joi_1.default.object().optional(),
});
