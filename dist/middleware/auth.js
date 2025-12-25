"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleMiddleware = exports.authMiddleware = void 0;
const jwt_1 = require("../config/jwt");
const errorHandler_1 = require("./errorHandler");
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_1.AppError(401, 'Missing or invalid authorization header');
        }
        const token = authHeader.substring(7);
        const user = jwt_1.jwtService.verifyToken(token);
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
        }
        else {
            next(new errorHandler_1.AppError(401, 'Invalid or expired token'));
        }
    }
};
exports.authMiddleware = authMiddleware;
const roleMiddleware = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            next(new errorHandler_1.AppError(403, 'Insufficient permissions'));
        }
        else {
            next();
        }
    };
};
exports.roleMiddleware = roleMiddleware;
