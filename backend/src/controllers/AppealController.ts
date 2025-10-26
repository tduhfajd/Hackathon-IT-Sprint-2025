import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AppealModel, CreateAppealData, UpdateAppealData, AppealFilters } from '../models/Appeal';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';
import { rabbitMQService } from '../services/RabbitMQService';

export class AppealController {
  constructor(private appealModel: AppealModel) {}

  createAppeal = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      // Ensure anonymous citizen user exists for this appeal when no auth
      let citizenUserId: string | null = req.user?.userId || null;
      if (!citizenUserId) {
        const fullName: string = req.body.full_name || req.body.fullName || 'Гражданин';
        const emailRaw: string = req.body.email || '';
        const generatedEmail = emailRaw && typeof emailRaw === 'string'
          ? emailRaw
          : `guest-${Date.now()}-${Math.random().toString(36).slice(2,8)}@guest.local`;
        const phone: string | null = req.body.phone || null;
        // Try find existing by email, else create minimal citizen user
        const existing = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [generatedEmail]);
        if (existing.rowCount && existing.rows[0]?.id) {
          citizenUserId = existing.rows[0].id;
        } else {
          const created = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, phone, role, is_active)
             VALUES ($1, $2, $3, $4, 'citizen', true)
             RETURNING id`,
            [generatedEmail, 'guest', fullName, phone]
          );
          citizenUserId = created.rows[0].id;
        }
      }

      const appealData: CreateAppealData = {
        ...req.body,
        user_id: citizenUserId,
        category_suggestion: req.body.subject // Use user's selected category from dropdown
      };
      
      logger.info('AppealController: Creating appeal with data', { appealData });
      const appeal = await this.appealModel.create(appealData);
      
      logger.info(`Appeal created`, { 
        appealId: appeal.id, 
        trackingNumber: appeal.tracking_number,
        userId: req.user?.userId 
      });

      // Save the initial message (description) to chat_messages
      try {
        await pool.query(
          `INSERT INTO chat_messages (appeal_id, sender_id, sender_type, message, created_at)
           VALUES ($1, $2, 'citizen', $3, NOW())`,
          [appeal.id, citizenUserId, appealData.description]
        );
        logger.info('Initial message saved to chat', { appealId: appeal.id });
      } catch (chatError: any) {
        logger.error('Failed to save initial message to chat', { 
          appealId: appeal.id, 
          error: chatError.message 
        });
        // Continue anyway - appeal is created
      }
      
      // Enqueue AI analysis and response generation via RabbitMQ
      try {
        await rabbitMQService.enqueueAppealAnalysis(appeal.id, appealData.subject, appealData.description);
        await rabbitMQService.enqueueResponseGeneration(appeal.id, appealData.subject, appealData.description);
        logger.info('Appeal queued for AI processing (RabbitMQ)', { appealId: appeal.id });
      } catch (queueError: any) {
        logger.error('Failed to queue AI processing', { 
          appealId: appeal.id, 
          error: queueError.message 
        });
        // Continue anyway - analysis can be run manually if needed
      }
      
      res.status(201).json({
        success: true,
        message: 'Appeal created successfully',
        data: {
          id: appeal.id,
          tracking_number: appeal.tracking_number,
          status: appeal.status,
          submitted_at: appeal.submitted_at,
          citizen_user_id: citizenUserId
        },
        // Backward compatibility for older frontends expecting appeal.tracking_number
        appeal: {
          tracking_number: appeal.tracking_number
        }
      });
    } catch (error) {
      logger.error('Create appeal controller error', { 
        error: error.message, 
        body: req.body,
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create appeal'
      });
    }
  };

  getAppeals = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: AppealFilters = {
        status: req.query.status as string,
        priority: req.query.priority as string,
        category_id: req.query.category_id as string,
        user_id: req.query.user_id as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        search: req.query.search as string
      };

      // If user is citizen, only show their appeals
      if (req.user?.role === 'citizen') {
        filters.user_id = req.user.userId;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const [appeals, total] = await Promise.all([
        this.appealModel.list(filters, limit, offset),
        this.appealModel.count(filters)
      ]);
      
      res.json({
        success: true,
        data: {
          appeals,
          pagination: {
            total,
            limit,
            offset,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get appeals controller error', { 
        error: error.message,
        query: req.query,
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get appeals'
      });
    }
  };

  getAppealById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      const appeal = await this.appealModel.findById(id);
      
      if (!appeal) {
        res.status(404).json({
          success: false,
          message: 'Appeal not found'
        });
        return;
      }

      // If user is citizen, only allow access to their own appeals
      if (req.user?.role === 'citizen' && appeal.user_id !== req.user.userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
      
      res.json({
        success: true,
        data: { appeal }
      });
    } catch (error) {
      logger.error('Get appeal by ID controller error', { 
        error: error.message,
        appealId: req.params.id,
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get appeal'
      });
    }
  };

  getAppealByTrackingNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const { trackingNumber } = req.params;
      
      const appeal = await this.appealModel.findByTrackingNumber(trackingNumber);
      
      if (!appeal) {
        res.status(404).json({
          success: false,
          message: 'Appeal not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: { appeal }
      });
    } catch (error) {
      logger.error('Get appeal by tracking number controller error', { 
        error: error.message,
        trackingNumber: req.params.trackingNumber 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get appeal'
      });
    }
  };

  updateAppeal = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const updateData: UpdateAppealData = req.body;
      
      // Check if appeal exists
      const existingAppeal = await this.appealModel.findById(id);
      if (!existingAppeal) {
        res.status(404).json({
          success: false,
          message: 'Appeal not found'
        });
        return;
      }

      // If user is citizen, only allow updating their own appeals and only certain fields
      if (req.user?.role === 'citizen') {
        if (existingAppeal.user_id !== req.user.userId) {
          res.status(403).json({
            success: false,
            message: 'Access denied'
          });
          return;
        }

        // Citizens can only update subject, description, and address
        const allowedFields = ['subject', 'description', 'address'];
        const restrictedFields = Object.keys(updateData).filter(key => !allowedFields.includes(key));
        
        if (restrictedFields.length > 0) {
          res.status(400).json({
            success: false,
            message: `You can only update: ${allowedFields.join(', ')}`
          });
          return;
        }
      }
      
      const updatedAppeal = await this.appealModel.update(id, updateData);
      
      if (!updatedAppeal) {
        res.status(500).json({
          success: false,
          message: 'Failed to update appeal'
        });
        return;
      }

      // Если обращение завершено и это Telegram - отправляем уведомление
      if (updateData.status === 'completed' && existingAppeal.source === 'telegram' && existingAppeal.telegram_chat_id) {
        try {
          const telegramBotService = require('../services/TelegramBotService').default;
          await telegramBotService.notifyAppealCompleted(existingAppeal.telegram_chat_id, 'оператором');
          logger.info('Telegram completion notification sent', { appealId: id });
        } catch (telegramError: any) {
          logger.warn('Failed to send Telegram notification', { appealId: id, error: telegramError.message });
        }
      }
      
      logger.info(`Appeal updated`, { 
        appealId: id, 
        updatedFields: Object.keys(updateData),
        userId: req.user?.userId 
      });
      
      res.json({
        success: true,
        message: 'Appeal updated successfully',
        data: { appeal: updatedAppeal }
      });
    } catch (error: any) {
      logger.error('Update appeal controller error', { 
        error: error?.message || String(error),
        stack: error?.stack,
        appealId: req.params.id,
        body: req.body,
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update appeal',
        error: error?.message || String(error)
      });
    }
  };

  deleteAppeal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if appeal exists
      const existingAppeal = await this.appealModel.findById(id);
      if (!existingAppeal) {
        res.status(404).json({
          success: false,
          message: 'Appeal not found'
        });
        return;
      }

      // Only allow citizens to delete their own appeals, and only if status is 'new'
      if (req.user?.role === 'citizen') {
        if (existingAppeal.user_id !== req.user.userId) {
          res.status(403).json({
            success: false,
            message: 'Access denied'
          });
          return;
        }

        if (existingAppeal.status !== 'new') {
          res.status(400).json({
            success: false,
            message: 'Can only delete appeals with status "new"'
          });
          return;
        }
      }
      
      const deleted = await this.appealModel.delete(id);
      
      if (!deleted) {
        res.status(500).json({
          success: false,
          message: 'Failed to delete appeal'
        });
        return;
      }
      
      logger.info(`Appeal deleted`, { 
        appealId: id,
        userId: req.user?.userId 
      });
      
      res.json({
        success: true,
        message: 'Appeal deleted successfully'
      });
    } catch (error) {
      logger.error('Delete appeal controller error', { 
        error: error.message,
        appealId: req.params.id,
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete appeal'
      });
    }
  };

  getAppealStats = async (req: Request, res: Response): Promise<void> => {
    try {
      // Only operators and admins can see stats
      if (req.user?.role === 'citizen') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      const stats = await this.appealModel.getStats();
      
      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      logger.error('Get appeal stats controller error', { 
        error: error.message,
        userId: req.user?.userId 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get appeal statistics'
      });
    }
  };
}