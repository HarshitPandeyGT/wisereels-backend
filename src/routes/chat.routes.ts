import { Router } from 'express';
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  getUnreadCount,
  archiveConversation,
} from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Conversation routes
router.post('/conversations/:userId', getOrCreateConversation);
router.get('/conversations', getConversations);

// Message routes
router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/send', sendMessage);
router.delete('/messages/:messageId', deleteMessage);

// Unread count
router.get('/unread-count', getUnreadCount);

// Archive conversation
router.post('/:conversationId/archive', archiveConversation);

export default router;
