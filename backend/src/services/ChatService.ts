import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { rabbitMQService } from './RabbitMQService';

interface ChatMessage {
  id: string;
  appeal_id: string;
  sender_id: string;
  sender_type: 'citizen' | 'operator' | 'system';
  message_text: string;
  created_at: Date;
}

interface TypingStatus {
  appealId: string;
  userId: string;
  userType: 'citizen' | 'operator';
  isTyping: boolean;
}

export class ChatService {
  private io: Server;
  private connectedUsers: Map<string, Socket> = new Map();
  private static instance: ChatService | null = null;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3002',
          'http://localhost:3003',
          'http://localhost:3004',
          'http://user-smartsupport.vadimevgrafov.ru',
          'http://operator-smartsupport.vadimevgrafov.ru',
          'https://user-smartsupport.vadimevgrafov.ru',
          'https://operator-smartsupport.vadimevgrafov.ru'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupEventHandlers();
    logger.info('ChatService: WebSocket server initialized');
    
    // Store instance for static access
    ChatService.instance = this;
  }
  
  public static getIO(): Server | null {
    return ChatService.instance?.io || null;
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('💬 ChatService: New client connected', socket.id, socket.handshake.address);
      logger.info('ChatService: New client connected', { socketId: socket.id, clientIP: socket.handshake.address });

      // Join appeal room
      socket.on('join_appeal', async (data: { appealId: string; userId: string; userType: 'citizen' | 'operator' }) => {
        try {
          const { appealId, userId, userType } = data;
          
          // Store user connection
          this.connectedUsers.set(userId, socket);
          
          // Join the room for this appeal
          await socket.join(`appeal_${appealId}`);
          
          logger.info('ChatService: User joined appeal', { appealId, userId, userType });
          
          // If operator joins, automatically set appeal status to 'in_progress' and reset unread count
          if (userType === 'operator') {
            try {
              await pool.query(
                `UPDATE appeals 
                 SET status = 'in_progress', 
                     unread_operator_count = 0,
                     updated_at = NOW() 
                 WHERE id = $1 AND status IN ('new', 'in_progress')`,
                [appealId]
              );
              
              // Broadcast appeal_updated event to refresh operator panel
              this.io.emit('appeal_updated', { appealId, hasNewMessage: false });
              
              logger.info('ChatService: Appeal status updated to in_progress, unread count reset', { appealId });
            } catch (statusError: any) {
              logger.warn('ChatService: Failed to update appeal status', { appealId, error: statusError.message });
            }
          }
          
          // Send chat history
          const messages = await this.getChatHistory(appealId);
          socket.emit('chat_history', messages);

          // Send system message only when citizen joins (only to citizen, not to operator)
          if (userType === 'citizen') {
            const systemMessage: ChatMessage = {
              id: 'system-ephemeral',
              appeal_id: appealId,
              sender_id: 'system',
              sender_type: 'system',
              message_text: 'Здравствуйте! Мы анализируем ваше обращение, ожидайте ответ…',
              created_at: new Date().toISOString() as any
            } as any;
            // Send only to the citizen who just joined, not to everyone in the room
            socket.emit('new_message', systemMessage);
          }
          
          // Notify others in the room
          socket.to(`appeal_${appealId}`).emit('user_joined', {
            userId,
            userType,
            timestamp: new Date()
          });
        } catch (error: any) {
          logger.error('ChatService: Error joining appeal', { error: error.message });
          socket.emit('error', { message: 'Failed to join appeal chat' });
        }
      });

      // Handle new message
      socket.on('send_message', async (data: { appealId: string; senderId: string; senderType: 'citizen' | 'operator'; message: string }) => {
        console.log('📨 ChatService: Received send_message event', data, socket.id);
        logger.info('ChatService: Received send_message event', { data, socketId: socket.id });
        const { appealId, senderId, senderType, message } = data;
        try {
          console.log(`💾 Attempting to save message: appealId=${appealId}, senderId=${senderId}, senderType=${senderType}`);
          // Try to save message to database
          const savedMessage = await this.saveMessage(appealId, senderId, senderType, message);
          console.log(`✅ Message saved successfully:`, savedMessage);
          // Broadcast to all users in the appeal room
          this.io.to(`appeal_${appealId}`).emit('new_message', savedMessage);
          logger.info('ChatService: Message sent', { appealId, senderId, senderType });
          
          // If operator sent a message, check if we need to send to Telegram
          // ALSO: emit close_chat event to auto-close chat window
          if (senderType === 'operator') {
            try {
              const appealResult = await pool.query(
                'SELECT source, telegram_chat_id FROM appeals WHERE id = $1',
                [appealId]
              );
              
              if (appealResult.rows.length > 0) {
                const appeal = appealResult.rows[0];
                if (appeal.source === 'telegram' && appeal.telegram_chat_id) {
                  const telegramBotService = require('./TelegramBotService').default;
                  await telegramBotService.sendMessage(appeal.telegram_chat_id, message);
                  logger.info('ChatService: Message sent to Telegram', { appealId, chatId: appeal.telegram_chat_id });
                }
              }
            } catch (telegramError: any) {
              logger.warn('ChatService: Failed to send to Telegram', { appealId, error: telegramError.message });
            }
            
            // Auto-close chat window for operator after sending message
            console.log(`🔒 ChatService: Emitting close_chat event for appealId=${appealId}, socket=${socket.id}`);
            
            // Отправляем событие НАПРЯМУЮ на socket оператора, который отправил сообщение
            socket.emit('close_chat', { appealId });
            logger.info('ChatService: Sent close_chat event to operator socket', { appealId, socketId: socket.id });
            console.log(`✅ ChatService: close_chat event emitted to socket ${socket.id}`);
          }
          
          // If citizen sent a message, generate contextual AI response
          // AND increment unread_operator_count + update last_activity_at
          if (senderType === 'citizen') {
            try {
              await rabbitMQService.enqueueContextualResponse(appealId);
              logger.info('ChatService: Enqueued contextual AI response', { appealId });
            } catch (aiError: any) {
              logger.warn('ChatService: Failed to enqueue contextual AI', { appealId, error: aiError.message });
            }
            
            // Update unread count, activity timestamp, AND status back to 'new' (only if currently in_progress)
            try {
              await pool.query(
                `UPDATE appeals 
                 SET unread_operator_count = unread_operator_count + 1,
                     last_activity_at = NOW(),
                     status = CASE 
                       WHEN status = 'in_progress' THEN 'new'
                       ELSE status
                     END,
                     updated_at = NOW()
                 WHERE id = $1 AND status IN ('in_progress', 'new')`,
                [appealId]
              );
              
              // Broadcast appeal_updated event to all connected operators
              this.io.emit('appeal_updated', { appealId, hasNewMessage: true });
              logger.info('ChatService: Incremented unread count, updated activity, and set status to new if was in_progress', { appealId });
            } catch (updateError: any) {
              logger.warn('ChatService: Failed to update unread count', { appealId, error: updateError.message });
            }
          }
          
          // If operator sent a message, reset unread count AND set status to 'in_progress'
          if (senderType === 'operator') {
            console.log(`📊 ChatService: Updating appeal status for operator message, appealId=${appealId}`);
            try {
              await pool.query(
                `UPDATE appeals 
                 SET unread_operator_count = 0,
                     status = 'in_progress',
                     updated_at = NOW()
                 WHERE id = $1 AND status IN ('new', 'in_progress')`,
                [appealId]
              );
              console.log(`✅ ChatService: Appeal status updated to in_progress, unread count reset`);
              logger.info('ChatService: Reset unread count and set status to in_progress', { appealId });
            } catch (updateError: any) {
              console.log(`❌ ChatService: Failed to update appeal status:`, updateError);
              logger.warn('ChatService: Failed to reset unread count', { appealId, error: updateError.message });
            }
          }
        } catch (error: any) {
          // Fallback: broadcast ephemeral message (not persisted) to keep dialog working
          const ephemeral = {
            id: undefined,
            appeal_id: appealId,
            sender_id: senderId,
            sender_type: senderType,
            message_text: message,
            created_at: new Date().toISOString()
          };
          this.io.to(`appeal_${appealId}`).emit('new_message', ephemeral);
          logger.warn('ChatService: DB save failed, sent ephemeral message', { appealId, error: error?.message });
          
          // ВАЖНО: Отправить close_chat даже если сохранение не удалось (для оператора)
          if (senderType === 'operator') {
            socket.emit('close_chat', { appealId });
            logger.info('ChatService: Sent close_chat event to operator socket (ephemeral)', { appealId, socketId: socket.id });
          }
        }
      });

      // Handle typing indicator
      socket.on('typing', (data: TypingStatus) => {
        const { appealId, userId, userType, isTyping } = data;
        socket.to(`appeal_${appealId}`).emit('user_typing', {
          userId,
          userType,
          isTyping,
          timestamp: new Date()
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info('ChatService: Client disconnected', { socketId: socket.id });
        
        // Remove from connected users
        for (const [userId, sock] of this.connectedUsers.entries()) {
          if (sock.id === socket.id) {
            this.connectedUsers.delete(userId);
            break;
          }
        }
      });

      // Leave appeal room
      socket.on('leave_appeal', (data: { appealId: string; userId: string }) => {
        const { appealId, userId } = data;
        socket.leave(`appeal_${appealId}`);
        this.connectedUsers.delete(userId);
        
        socket.to(`appeal_${appealId}`).emit('user_left', {
          userId,
          timestamp: new Date()
        });
        
        logger.info('ChatService: User left appeal', { appealId, userId });
      });
    });
  }

  private async getChatHistory(appealId: string): Promise<ChatMessage[]> {
    try {
      const query = `
        SELECT 
          id,
          appeal_id,
          sender_id,
          sender_type,
          message AS message_text,
          created_at
        FROM chat_messages
        WHERE appeal_id = $1
        ORDER BY created_at ASC
        LIMIT 100
      `;
      
      const result = await pool.query(query, [appealId]);
      return result.rows;
    } catch (error: any) {
      logger.error('ChatService: Error fetching chat history', { error: error.message, appealId });
      return [];
    }
  }

  private async saveMessage(
    appealId: string,
    senderId: string,
    senderType: 'citizen' | 'operator',
    messageText: string
  ): Promise<ChatMessage> {
    try {
      console.log(`🔍 saveMessage check: senderId=${senderId}, isValidUuid=${this.isValidUuid(senderId)}`);
      
      // If senderId is not a valid UUID or not found in users table, skip persistence
      const userCheck = await this.userExists(senderId);
      console.log(`🔍 User exists check: ${userCheck}`);
      
      if (!this.isValidUuid(senderId) || !userCheck) {
        console.warn(`⚠️ Skipping persistence: invalid UUID or user not found`);
        const fallback: ChatMessage = {
          id: 'ephemeral',
          appeal_id: appealId,
          sender_id: senderId,
          sender_type: senderType,
          message_text: messageText,
          created_at: new Date()
        } as any;
        return fallback;
      }
      
      console.log(`✅ Validation passed, saving to DB...`);

      const query = `
        INSERT INTO chat_messages (
          appeal_id,
          sender_id,
          sender_type,
          message,
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING 
          id,
          appeal_id,
          sender_id,
          sender_type,
          message AS message_text,
          created_at
      `;
      
      const result = await pool.query(query, [appealId, senderId, senderType, messageText]);
      
      logger.info('ChatService: Message saved to database', { appealId, senderId });
      
      return result.rows[0];
    } catch (error: any) {
      logger.error('ChatService: Error saving message', { error: error.message, appealId });
      throw error;
    }
  }

  private isValidUuid(value: string): boolean {
    // Упрощенная проверка UUID (включая nil UUID 00000000-0000-0000-0000-000000000000)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private async userExists(userId: string): Promise<boolean> {
    try {
      const result = await pool.query('SELECT 1 FROM users WHERE id = $1 LIMIT 1', [userId]);
      return result.rowCount > 0;
    } catch {
      return false;
    }
  }

  // Public method to send notification to specific user
  public sendNotificationToUser(userId: string, notification: any): void {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit('notification', notification);
      logger.info('ChatService: Notification sent to user', { userId });
    }
  }

  // Public method to broadcast to appeal room
  public broadcastToAppeal(appealId: string, event: string, data: any): void {
    this.io.to(`appeal_${appealId}`).emit(event, data);
    logger.info('ChatService: Broadcast to appeal', { appealId, event });
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}
