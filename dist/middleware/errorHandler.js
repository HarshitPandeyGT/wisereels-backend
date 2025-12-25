"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    constructor(statusCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
const errorHandler = (error, req, res, next) => {
    logger_1.logger.error('Error occurred', {
        message: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
    });
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            details: error.details,
        });
    }
    // Default error
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
    });
};
exports.errorHandler = errorHandler;
