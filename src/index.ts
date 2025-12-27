import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import authRouter from './routes/auth.routes';
import creatorRouter from './routes/creator.routes';
import videoRouter from './routes/video.routes';
import walletRouter from './routes/wallet.routes';
import userRouter from './routes/user.routes';
import storiesRouter from './routes/stories.routes';
import socialRouter from './routes/social.routes';
import chatRouter from './routes/chat.routes';
import notificationsRouter from './routes/notifications.routes';
import mediaRouter from './routes/media.routes';
import feedRouter from './routes/feed.routes';
import expertRouter from './routes/expert.routes';
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

// Protected Routes
app.use('/api/creators', authMiddleware, creatorRouter);
app.use('/api/videos', authMiddleware, videoRouter);
app.use('/api/wallet', authMiddleware, walletRouter);
app.use('/api/stories', authMiddleware, storiesRouter);
app.use('/api/users', authMiddleware, userRouter);
app.use('/api/social', authMiddleware, socialRouter);
app.use('/api/chat', authMiddleware, chatRouter);
app.use('/api/notifications', authMiddleware, notificationsRouter);
app.use('/api/media', authMiddleware, mediaRouter);
app.use('/api/feed', authMiddleware, feedRouter);
app.use('/api/experts', expertRouter);

// Error Handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`WiseReels server running on port ${PORT}`);
});

export default app;
