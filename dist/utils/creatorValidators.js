"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.credentialVerificationSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.credentialVerificationSchema = joi_1.default.object({
    userId: joi_1.default.string().uuid().required(),
    status: joi_1.default.string().valid('VERIFIED', 'REJECTED').required(),
});
