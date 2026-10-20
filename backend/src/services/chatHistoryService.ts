import { db } from '../db/index.js';
import { config } from '../config.js';

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  preview: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  screenContext?: string;
  createdAt: string;
  expiresAt: string;
}

export class ChatHistoryService {
  /**
   * Automatically sweeps and removes expired conversations and messages (older than 7 days TTL).
   * Idempotent and called on startup and periodically.
   */
  static cleanExpiredConversations(): { deletedConversations: number; deletedMessages: number } {
    const now = new Date().toISOString();

    const cleanupTx = db.transaction(() => {
      // Find expired conversations
      const expiredMsgs = db.prepare('DELETE FROM ask_veylora_messages WHERE expires_at <= ?').run(now);
      const expiredConvs = db.prepare('DELETE FROM ask_veylora_conversations WHERE expires_at <= ?').run(now);

      return {
        deletedConversations: expiredConvs.changes,
        deletedMessages: expiredMsgs.changes
      };
    });

    const result = cleanupTx();
    if (result.deletedConversations > 0 || result.deletedMessages > 0) {
      console.log(`[ChatHistoryService] Cleaned expired chat records: ${result.deletedConversations} conversations, ${result.deletedMessages} messages.`);
    }
    return result;
  }

  /**
   * List all non-expired conversations
   */
  static listConversations(): ConversationSummary[] {
    this.cleanExpiredConversations();
    const now = new Date().toISOString();

    const rows = db.prepare(`
      SELECT 
        c.id, 
        c.title, 
        c.created_at as createdAt, 
        c.updated_at as updatedAt, 
        c.expires_at as expiresAt,
        (SELECT content FROM ask_veylora_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
        (SELECT COUNT(*) FROM ask_veylora_messages WHERE conversation_id = c.id) as messageCount
      FROM ask_veylora_conversations c
      WHERE c.expires_at > ?
      ORDER BY c.updated_at DESC
    `).all(now) as Array<{
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      expiresAt: string;
      lastMessage: string | null;
      messageCount: number;
    }>;

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      expiresAt: r.expiresAt,
      preview: r.lastMessage ? (r.lastMessage.length > 80 ? r.lastMessage.substring(0, 80) + '...' : r.lastMessage) : 'New conversation',
      messageCount: r.messageCount
    }));
  }

  /**
   * Create a new conversation with a 7-day TTL
   */
  static createConversation(title?: string): ConversationSummary {
    const id = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.askVeyloraChatHistoryTtlDays * 24 * 60 * 60 * 1000);

    const createdAtStr = now.toISOString();
    const expiresAtStr = expiresAt.toISOString();
    const defaultTitle = title?.trim() || 'New Discussion';

    db.prepare(`
      INSERT INTO ask_veylora_conversations (id, title, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, defaultTitle, createdAtStr, createdAtStr, expiresAtStr);

    return {
      id,
      title: defaultTitle,
      createdAt: createdAtStr,
      updatedAt: createdAtStr,
      expiresAt: expiresAtStr,
      preview: 'New conversation',
      messageCount: 0
    };
  }

  /**
   * Get a conversation and its messages
   */
  static getConversation(id: string): { conversation: ConversationSummary; messages: ChatMessage[] } | null {
    const now = new Date().toISOString();

    const conv = db.prepare(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt, expires_at as expiresAt
      FROM ask_veylora_conversations
      WHERE id = ? AND expires_at > ?
    `).get(id, now) as { id: string; title: string; createdAt: string; updatedAt: string; expiresAt: string } | undefined;

    if (!conv) return null;

    const messages = db.prepare(`
      SELECT 
        id, 
        conversation_id as conversationId, 
        role, 
        content, 
        screen_context as screenContext, 
        created_at as createdAt, 
        expires_at as expiresAt
      FROM ask_veylora_messages
      WHERE conversation_id = ? AND expires_at > ?
      ORDER BY created_at ASC
    `).all(id, now) as ChatMessage[];

    return {
      conversation: {
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        expiresAt: conv.expiresAt,
        preview: messages.length > 0 ? messages[messages.length - 1].content.substring(0, 80) : 'New conversation',
        messageCount: messages.length
      },
      messages
    };
  }

  /**
   * Add a message to a conversation
   */
  static addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    screenContext?: string
  ): ChatMessage {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.askVeyloraChatHistoryTtlDays * 24 * 60 * 60 * 1000);

    const nowStr = now.toISOString();
    const expiresAtStr = expiresAt.toISOString();

    const insertTx = db.transaction(() => {
      // Ensure conversation exists or create one
      const existing = db.prepare('SELECT id, title FROM ask_veylora_conversations WHERE id = ?').get(conversationId) as { id: string; title: string } | undefined;
      if (!existing) {
        db.prepare(`
          INSERT INTO ask_veylora_conversations (id, title, created_at, updated_at, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(conversationId, 'Conversation', nowStr, nowStr, expiresAtStr);
      } else {
        // If first user message, update title based on prompt
        if (role === 'user' && (existing.title === 'New Discussion' || existing.title === 'Conversation')) {
          const autoTitle = content.trim().length > 30 ? content.trim().substring(0, 30) + '...' : content.trim();
          db.prepare('UPDATE ask_veylora_conversations SET title = ?, updated_at = ? WHERE id = ?').run(autoTitle, nowStr, conversationId);
        } else {
          db.prepare('UPDATE ask_veylora_conversations SET updated_at = ? WHERE id = ?').run(nowStr, conversationId);
        }
      }

      db.prepare(`
        INSERT INTO ask_veylora_messages (id, conversation_id, role, content, screen_context, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, conversationId, role, content, screenContext || null, nowStr, expiresAtStr);
    });

    insertTx();

    return {
      id: msgId,
      conversationId,
      role,
      content,
      screenContext,
      createdAt: nowStr,
      expiresAt: expiresAtStr
    };
  }

  /**
   * Delete a conversation
   */
  static deleteConversation(id: string): boolean {
    const delTx = db.transaction(() => {
      db.prepare('DELETE FROM ask_veylora_messages WHERE conversation_id = ?').run(id);
      const res = db.prepare('DELETE FROM ask_veylora_conversations WHERE id = ?').run(id);
      return res.changes > 0;
    });

    return delTx();
  }
}
