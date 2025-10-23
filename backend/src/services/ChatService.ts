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
          
          // Send chat history
          const messages = await this.getChatHistory(appealId);
          socket.emit('chat_history', messages);

          // Send system message only when citizen joins
          if (userType === 'citizen') {
            const systemMessage: ChatMessage = {
              id: 'system-ephemeral',
              appeal_id: appealId,
              sender_id: 'system',
              sender_type: 'system',
              message_text: 'Минуту, ожидайте ответ. Мы анализируем ваше обращение…',
              created_at: new Date().toISOString() as any
            } as any;
            this.io.to(`appeal_${appealId}`).emit('new_message', systemMessage);
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
          // Try to save message to database
          const savedMessage = await this.saveMessage(appealId, senderId, senderType, message);
          // Broadcast to all users in the appeal room
          this.io.to(`appeal_${appealId}`).emit('new_message', savedMessage);
          logger.info('ChatService: Message sent', { appealId, senderId, senderType });
          
          // If citizen sent a message, generate contextual AI response
          if (senderType === 'citizen') {
            try {
              await rabbitMQService.enqueueContextualResponse(appealId);
              logger.info('ChatService: Enqueued contextual AI response', { appealId });
            } catch (aiError: any) {
              logger.warn('ChatService: Failed to enqueue contextual AI', { appealId, error: aiError.message });
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
      // If senderId is not a valid UUID or not found in users table, skip persistence
      if (!this.isValidUuid(senderId) || !(await this.userExists(senderId))) {
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
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
