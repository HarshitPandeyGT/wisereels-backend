"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.redemptionSchema = exports.watchEventSchema = exports.credentialSubmissionSchema = exports.videoUploadSchema = exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.registerSchema = joi_1.default.object({
    phoneNumber: joi_1.default.string().pattern(/^[+]?[0-9]{10,15}$/).required(),
    username: joi_1.default.string().alphanum().min(3).max(32).required(),
    displayName: joi_1.default.string().alphanum().min(3).max(50).required(),
});
exports.loginSchema = joi_1.default.object({
    phoneNumber: joi_1.default.string().pattern(/^[+]?[0-9]{10,15}$/).required(),
});
exports.videoUploadSchema = joi_1.default.object({
    title: joi_1.default.string().min(5).max(255).required(),
    description: joi_1.default.string().max(1000).optional(),
    category: joi_1.default.string()
        .valid('FINANCE', 'HEALTH', 'FITNESS', 'EDUCATION', 'ENTERTAINMENT', 'OTHER')
        .required(),
    durationSeconds: joi_1.default.number().integer().min(10).required(),
});
exports.credentialSubmissionSchema = joi_1.default.object({
    credentialType: joi_1.default.string().valid('CA', 'DOCTOR', 'TRAINER').required(),
    credentialId: joi_1.default.string().min(5).max(100).required(),
    issuingBody: joi_1.default.string().min(3).max(255).required(),
    expiryDate: joi_1.default.date().iso().required(),
});
exports.watchEventSchema = joi_1.default.object({
    videoId: joi_1.default.string().uuid().required(),
    creatorId: joi_1.default.string().uuid().required(),
    watchDurationSeconds: joi_1.default.number().integer().min(5).required(),
    category: joi_1.default.string()
        .valid('FINANCE', 'HEALTH', 'FITNESS', 'EDUCATION', 'ENTERTAINMENT', 'OTHER')
        .required(),
});
exports.redemptionSchema = joi_1.default.object({
    pointsToRedeem: joi_1.default.number().integer().min(100).required(),
    redemptionType: joi_1.default.string().valid('UPI', 'GIFT_CARD', 'RECHARGE').required(),
    upiId: joi_1.default.string().when('redemptionType', {
        is: 'UPI',
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional(),
    }),
});
const validate = (data, schema) => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const errors = error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
        }));
        return { error: true, errors, value: null };
    }
    return { error: false, errors: null, value };
};
exports.validate = validate;
