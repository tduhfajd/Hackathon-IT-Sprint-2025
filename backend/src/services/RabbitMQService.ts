/**
 * RabbitMQ Service for sending tasks to Celery workers
 */
import amqp, { Connection, Channel } from 'amqplib';
import { logger } from '../utils/logger';

export class RabbitMQService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private rabbitMQUrl: string;

  constructor() {
    const host = process.env['RABBITMQ_HOST'] || 'rabbitmq';
    const port = process.env['RABBITMQ_PORT'] || '5672';
    const user = process.env['RABBITMQ_USER'] || 'admin';
    const pass = process.env['RABBITMQ_PASS'] || 'SmartSupport2025!';

    this.rabbitMQUrl = `amqp://${user}:${pass}@${host}:${port}`;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.rabbitMQUrl);
      this.channel = await this.connection.createChannel();
      
      logger.info('✅ Connected to RabbitMQ');
    } catch (error: any) {
      logger.error('❌ Failed to connect to RabbitMQ', { error: error.message });
      throw error;
    }
  }

  async sendTask(taskName: string, args: any[], kwargs: Record<string, any> = {}, options: Record<string, any> = {}): Promise<string> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    // Generate task ID
    const taskId = this.generateUUID();

    // Celery message format
    const message = {
      task: taskName,
      id: taskId,
      args: args,
      kwargs: kwargs,
      retries: 0,
      eta: null,
      expires: null,
      ...options
    };

    const queue = 'celery'; // Default Celery queue

    // Ensure queue exists
    await this.channel.assertQueue(queue, { durable: true });

    // Send message
    this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(message)),
      {
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        deliveryMode: 2, // persistent
      }
    );

    logger.info(`📤 Sent task to RabbitMQ`, { taskName, taskId, args });

    return taskId;
  }

  /**
   * Enqueue appeal analysis task
   */
  async enqueueAppealAnalysis(appealId: string, subject: string, description: string): Promise<string> {
    return this.sendTask(
      'tasks.analyze_appeal',
      [appealId, subject, description],
      {},
      {}
    );
  }

  /**
   * Enqueue response generation task
   */
  async enqueueResponseGeneration(appealId: string, subject: string, description: string): Promise<string> {
    return this.sendTask(
      'tasks.generate_response',
      [appealId, subject, description],
      {},
      {}
    );
  }

  /**
   * Enqueue contextual response generation (for follow-up messages)
   */
  async enqueueContextualResponse(appealId: string): Promise<string> {
    return this.sendTask(
      'tasks.contextual_response',
      [appealId],
      {},
      {}
    );
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    logger.info('RabbitMQ connection closed');
  }
}

// Singleton instance
export const rabbitMQService = new RabbitMQService();

