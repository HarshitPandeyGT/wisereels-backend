import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import authRouter from './routes/auth.routes';
import creatorRouter from './routes/creator.routes';
import videoRouter from './routes/video.routes';
import walletRouter from './routes/wallet.routes';
import userRouter from './routes/user.routes';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { responseWrapper } from './middleware/responseWrapper';
import { setupSwaggerDocs } from './utils/swagger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(responseWrapper);

// Swagger docs setup
setupSwaggerDocs(app);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public Routes (Auth)
app.use('/api/auth', authRouter);

// User profile update route (all users)
app.use('/api/users', authMiddleware, userRouter);

// Protected Routes
app.use('/api/creators', authMiddleware, creatorRouter);
app.use('/api/videos', authMiddleware, videoRouter);
app.use('/api/wallet', authMiddleware, walletRouter);

// Error Handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`WiseReels server running on port ${PORT}`);
});

export default app;
