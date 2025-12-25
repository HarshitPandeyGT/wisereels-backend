"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const validators_1 = require("../utils/validators");
const errorHandler_1 = require("../middleware/errorHandler");
const validateRequest = (schema) => (req, res, next) => {
    const { error, errors, value } = (0, validators_1.validate)(req.body, schema);
    if (error) {
        return next(new errorHandler_1.AppError(400, 'Validation failed', {
            errors,
        }));
    }
    req.body = value;
    next();
};
exports.validateRequest = validateRequest;
