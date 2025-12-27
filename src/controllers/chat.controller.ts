import { Request, Response } from 'express';
import ChatService from '../services/chat.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Get or create conversation
 * POST /api/chat/conversations/:userId
 */
export const getOrCreateConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId1 = req.userId;
    const userId2 = req.params.userId;

    if (!userId1) {
      throw new AppError(401, 'Authentication required');
    }

    const conversation = await ChatService.getOrCreateConversation(userId1, userId2);

    res.status(200).json({
      success: true,
      data: conversation,
    });

    logger.info('Conversation retrieved/created', { userId1, userId2 });
  } catch (error) {
    logger.error('Error in getOrCreateConversation', { error });
    throw error;
  }
};

/**
 * Get all conversations
 * GET /api/chat/conversations
 */
export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const conversations = await ChatService.getConversations(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        conversations,
        count: conversations.length,
      },
    });

    logger.info('Conversations fetched', { userId, count: conversations.length });
  } catch (error) {
    logger.error('Error in getConversations', { error });
    throw error;
  }
};

/**
 * Get messages in conversation
 * GET /api/chat/:conversationId/messages
 */
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId;
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const messages = await ChatService.getMessages(conversationId, userId, limit, offset);

    res.status(200).json({
      success: true,
      data: {
        messages,
        count: messages.length,
      },
    });

    logger.info('Messages fetched', { conversationId, userId, count: messages.length });
  } catch (error) {
    logger.error('Error in getMessages', { error });
    throw error;
  }
};

/**
 * Send message
 * POST /api/chat/:conversationId/send
 */
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId;
    const userId = req.userId;
    const { content, mediaUrl, mediaType } = req.body;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const message = await ChatService.sendMessage(
      conversationId,
      userId,
      content,
      mediaUrl,
      mediaType
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });

    logger.info('Message sent', { conversationId, userId });
  } catch (error) {
    logger.error('Error in sendMessage', { error });
    throw error;
  }
};

/**
 * Delete message
 * DELETE /api/chat/messages/:messageId
 */
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messageId = req.params.messageId;
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    await ChatService.deleteMessage(messageId, userId);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });

    logger.info('Message deleted', { messageId, userId });
  } catch (error) {
    logger.error('Error in deleteMessage', { error });
    throw error;
  }
};

/**
 * Get unread message count
 * GET /api/chat/unread-count
 */
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const unreadCount = await ChatService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Error in getUnreadCount', { error });
    throw error;
  }
};

/**
 * Archive conversation
 * POST /api/chat/:conversationId/archive
 */
export const archiveConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId;
    const userId = req.userId;

    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    await ChatService.archiveConversation(conversationId, userId);

    res.status(200).json({
      success: true,
      message: 'Conversation archived',
    });

    logger.info('Conversation archived', { conversationId, userId });
  } catch (error) {
    logger.error('Error in archiveConversation', { error });
    throw error;
  }
};
