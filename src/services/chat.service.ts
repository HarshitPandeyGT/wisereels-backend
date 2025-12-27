import { pool } from '../config/database';
import { cache } from '../config/cache';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface Conversation {
  id: string;
  participantA: string;
  participantB: string;
  lastMessageId?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: string;
  isDeleted: boolean;
  isRead?: boolean;
}

class ChatService {
  /**
   * Get or create conversation between two users
   */
  async getOrCreateConversation(userId1: string, userId2: string): Promise<Conversation> {
    const client = await pool.connect();
    try {
      // Normalize user IDs (smaller ID first)
      const [participantA, participantB] = [userId1, userId2].sort();

      // Check if conversation exists
      const existing = await client.query(
        'SELECT * FROM conversations WHERE participant_a_id = $1 AND participant_b_id = $2',
        [participantA, participantB]
      );

      if (existing.rows.length > 0) {
        return this.formatConversation(existing.rows[0]);
      }

      // Create new conversation
      const conversationId = uuidv4();
      const now = new Date();

      const query = `
        INSERT INTO conversations (id, participant_a_id, participant_b_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const result = await client.query(query, [conversationId, participantA, participantB, now, now]);

      logger.info('Conversation created', { conversationId, participantA, participantB });

      return this.formatConversation(result.rows[0]);
    } catch (error) {
      logger.error('Error creating/getting conversation', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const cacheKey = `conversations:${userId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const query = `
        SELECT 
          c.*,
          CASE 
            WHEN c.participant_a_id = $1 THEN c.participant_b_id 
            ELSE c.participant_a_id 
          END as other_user_id,
          u.username, u.display_name, u.avatar_url,
          COUNT(CASE WHEN dm.is_read = false AND 
            ((c.participant_a_id = $1 AND dm.sender_id = c.participant_b_id) OR
             (c.participant_b_id = $1 AND dm.sender_id = c.participant_a_id))
            THEN 1 END) as unread_count
        FROM conversations c
        LEFT JOIN users u ON (
          (c.participant_a_id = $1 AND u.id = c.participant_b_id) OR
          (c.participant_b_id = $1 AND u.id = c.participant_a_id)
        )
        LEFT JOIN direct_messages dm ON c.id = dm.conversation_id AND dm.is_deleted = false
        WHERE (c.participant_a_id = $1 OR c.participant_b_id = $1)
          AND c.is_archived_by_a = false AND c.is_archived_by_b = false
        GROUP BY c.id, u.id
        ORDER BY c.updated_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      const conversations = result.rows.map((row: any) => ({
        id: row.id,
        otherUser: {
          id: row.other_user_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
        unreadCount: parseInt(row.unread_count) || 0,
        updatedAt: row.updated_at,
      }));

      await cache.set(cacheKey, conversations, 60);
      return conversations;
    } catch (error) {
      logger.error('Error fetching conversations', { error, userId });
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content?: string,
    mediaUrl?: string,
    mediaType?: string
  ): Promise<DirectMessage> {
    const client = await pool.connect();
    try {
      if (!content && !mediaUrl) {
        throw new AppError(400, 'Message content or media is required');
      }

      // Verify conversation exists and user is participant
      const conversation = await client.query(
        'SELECT * FROM conversations WHERE id = $1 AND (participant_a_id = $2 OR participant_b_id = $2)',
        [conversationId, senderId]
      );

      if (conversation.rows.length === 0) {
        throw new AppError(404, 'Conversation not found or access denied');
      }

      const messageId = uuidv4();
      const now = new Date();

      // Insert message
      const query = `
        INSERT INTO direct_messages (id, conversation_id, sender_id, content, media_url, media_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await client.query(query, [
        messageId,
        conversationId,
        senderId,
        content || null,
        mediaUrl || null,
        mediaType || null,
        now,
      ]);

      // Update conversation last message
      await client.query(
        'UPDATE conversations SET last_message_id = $1, last_message_at = $2, updated_at = $3 WHERE id = $4',
        [messageId, now, now, conversationId]
      );

      // Invalidate cache
      const conv = conversation.rows[0];
      const otherUserId =
        conv.participant_a_id === senderId ? conv.participant_b_id : conv.participant_a_id;

      await Promise.all([
        cache.del(`messages:${conversationId}`),
        cache.del(`conversations:${senderId}`),
        cache.del(`conversations:${otherUserId}`),
      ]);

      logger.info('Message sent', { conversationId, senderId, messageId });

      return this.formatMessage(result.rows[0]);
    } catch (error) {
      logger.error('Error sending message', { error, conversationId, senderId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get message history
   */
  async getMessages(
    conversationId: string,
    userId: string,
    limit: number = 30,
    offset: number = 0
  ): Promise<DirectMessage[]> {
    try {
      const cacheKey = `messages:${conversationId}:${limit}:${offset}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      // Verify user is participant
      const conversation = await pool.query(
        'SELECT * FROM conversations WHERE id = $1 AND (participant_a_id = $2 OR participant_b_id = $2)',
        [conversationId, userId]
      );

      if (conversation.rows.length === 0) {
        throw new AppError(404, 'Conversation not found or access denied');
      }

      const query = `
        SELECT 
          id, conversation_id, sender_id, content, media_url, media_type,
          created_at, is_deleted,
          EXISTS (
            SELECT 1 FROM message_reads mr WHERE mr.message_id = dm.id AND mr.reader_id = $3
          ) as is_read
        FROM direct_messages dm
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $4
      `;

      const result = await pool.query(query, [conversationId, limit, userId, offset]);

      const messages = result.rows.map(this.formatMessage);

      // Mark as read
      await this.markMessagesAsRead(conversationId, userId);

      await cache.set(cacheKey, messages, 60);
      return messages;
    } catch (error) {
      logger.error('Error fetching messages', { error, conversationId, userId });
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessagesAsRead(conversationId: string, readerId: string): Promise<void> {
    try {
      const query = `
        INSERT INTO message_reads (id, message_id, reader_id, read_at)
        SELECT gen_random_uuid(), dm.id, $1, NOW()
        FROM direct_messages dm
        WHERE dm.conversation_id = $2 
          AND dm.sender_id != $1
          AND NOT EXISTS (
            SELECT 1 FROM message_reads mr 
            WHERE mr.message_id = dm.id AND mr.reader_id = $1
          )
        ON CONFLICT DO NOTHING
      `;

      await pool.query(query, [readerId, conversationId]);
      logger.info('Messages marked as read', { conversationId, readerId });
    } catch (error) {
      logger.error('Error marking messages as read', { error });
      // Non-critical, don't throw
    }
  }

  /**
   * Delete message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      // Verify message ownership
      const message = await client.query(
        'SELECT * FROM direct_messages WHERE id = $1 AND sender_id = $2',
        [messageId, userId]
      );

      if (message.rows.length === 0) {
        throw new AppError(404, 'Message not found or access denied');
      }

      // Soft delete
      await client.query(
        'UPDATE direct_messages SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
        [messageId]
      );

      // Invalidate cache
      await cache.del(`messages:${message.rows[0].conversation_id}`);

      logger.info('Message deleted', { messageId, userId });
    } catch (error) {
      logger.error('Error deleting message', { error, messageId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(DISTINCT dm.id) as unread_count
        FROM direct_messages dm
        INNER JOIN conversations c ON dm.conversation_id = c.id
        WHERE (c.participant_a_id = $1 OR c.participant_b_id = $1)
          AND dm.sender_id != $1
          AND NOT EXISTS (
            SELECT 1 FROM message_reads mr 
            WHERE mr.message_id = dm.id AND mr.reader_id = $1
          )
      `;

      const result = await pool.query(query, [userId]);
      return parseInt(result.rows[0].unread_count) || 0;
    } catch (error) {
      logger.error('Error getting unread count', { error, userId });
      return 0;
    }
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    try {
      const updateColumn = await pool.query(
        'SELECT participant_a_id FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (updateColumn.rows.length === 0) {
        throw new AppError(404, 'Conversation not found');
      }

      const isParticipantA = updateColumn.rows[0].participant_a_id === userId;
      const column = isParticipantA ? 'is_archived_by_a' : 'is_archived_by_b';

      await pool.query(`UPDATE conversations SET ${column} = true WHERE id = $1`, [conversationId]);

      await cache.del(`conversations:${userId}`);
      logger.info('Conversation archived', { conversationId, userId });
    } catch (error) {
      logger.error('Error archiving conversation', { error, conversationId, userId });
      throw error;
    }
  }

  /**
   * Helper: Format conversation
   */
  private formatConversation(row: any): Conversation {
    return {
      id: row.id,
      participantA: row.participant_a_id,
      participantB: row.participant_b_id,
      lastMessageId: row.last_message_id,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Helper: Format message
   */
  private formatMessage(row: any): DirectMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      content: row.content,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      createdAt: row.created_at,
      isDeleted: row.is_deleted || false,
      isRead: row.is_read || false,
    };
  }
}

export default new ChatService();
