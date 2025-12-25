"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./utils/logger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const creator_routes_1 = __importDefault(require("./routes/creator.routes"));
const video_routes_1 = __importDefault(require("./routes/video.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = require("./middleware/auth");
const responseWrapper_1 = require("./middleware/responseWrapper");
const swagger_1 = require("./utils/swagger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
app.use(responseWrapper_1.responseWrapper);
// Swagger docs setup
(0, swagger_1.setupSwaggerDocs)(app);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Public Routes (Auth)
app.use('/api/auth', auth_routes_1.default);
// User profile update route (all users)
app.use('/api/users', auth_1.authMiddleware, user_routes_1.default);
// Protected Routes
app.use('/api/creators', auth_1.authMiddleware, creator_routes_1.default);
app.use('/api/videos', auth_1.authMiddleware, video_routes_1.default);
app.use('/api/wallet', auth_1.authMiddleware, wallet_routes_1.default);
// Error Handler (must be last)
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    logger_1.logger.info(`WiseReels server running on port ${PORT}`);
});
exports.default = app;
