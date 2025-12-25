"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseWrapper = void 0;
/**
 * Middleware to standardize all API responses.
 * Ensures every successful response is wrapped in a consistent structure.
 */
const responseWrapper = (req, res, next) => {
    // Store original send
    const oldJson = res.json;
    res.json = function (data) {
        // If already wrapped, don't double wrap
        if (data && typeof data === 'object' && 'success' in data) {
            return oldJson.call(this, data);
        }
        return oldJson.call(this, { success: true, data });
    };
    next();
};
exports.responseWrapper = responseWrapper;
