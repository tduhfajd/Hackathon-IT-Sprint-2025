import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface Appeal {
  id: string;
  user_id: string | null;
  tracking_number: string;
  subject: string;
  description: string;
  category_id: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'processing' | 'completed' | 'rejected' | 'in_progress' | 'resolved' | 'closed';
  submitted_at: Date;
  processed_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  source?: 'web' | 'telegram' | 'email' | 'phone' | 'other';
  telegram_chat_id?: string;
  telegram_username?: string;
  user_name?: string;
  user_last_name?: string;
  user_email?: string;
  unread_operator_count?: number;
  last_activity_at?: Date;
}

export interface CreateAppealData {
  user_id?: string;
  subject: string;
  description: string;
  category_id?: string;
  category_suggestion?: string; // Category selected by user from dropdown
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface UpdateAppealData {
  subject?: string;
  description?: string;
  category_id?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'new' | 'processing' | 'completed' | 'rejected' | 'in_progress' | 'resolved';
  processed_at?: Date;
  completed_at?: Date;
}

export interface AppealFilters {
  status?: string;
  priority?: string;
  category_id?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export class AppealModel {
  constructor(private db: Pool) {}

  async create(appealData: CreateAppealData): Promise<Appeal> {
    const { user_id, subject, description, category_id = null, category_suggestion = null, priority = 'medium' } = appealData;
    
    const id = uuidv4();
    const tracking_number = this.generateTrackingNumber();
    
    const query = `
      INSERT INTO appeals (id, user_id, tracking_number, subject, description, category_id, category_suggestion, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [id, user_id, tracking_number, subject, description, category_id, category_suggestion, priority];
    const result = await this.db.query(query, values);
    
    return result.rows[0];
  }

  async findById(id: string): Promise<Appeal | null> {
    const query = 'SELECT * FROM appeals WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rows[0] || null;
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Appeal | null> {
    const query = 'SELECT * FROM appeals WHERE tracking_number = $1';
    const result = await this.db.query(query, [trackingNumber]);
    
    return result.rows[0] || null;
  }

  async update(id: string, appealData: UpdateAppealData): Promise<Appeal | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (appealData.subject !== undefined) {
      fields.push(`subject = $${paramCount++}`);
      values.push(appealData.subject);
    }
    
    if (appealData.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(appealData.description);
    }
    
    if (appealData.category_id !== undefined) {
      fields.push(`category_id = $${paramCount++}`);
      values.push(appealData.category_id);
    }
    
    if (appealData.priority !== undefined) {
      fields.push(`priority = $${paramCount++}`);
      values.push(appealData.priority);
    }
    
    if (appealData.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(appealData.status);
      
      // Set processed_at when status changes to processing or in_progress
      if ((appealData.status === 'processing' || appealData.status === 'in_progress') && !appealData.processed_at) {
        fields.push(`processed_at = NOW()`);
      }
      
      // Set completed_at when status changes to completed, resolved, or rejected
      if ((appealData.status === 'completed' || appealData.status === 'resolved' || appealData.status === 'rejected') && !appealData.completed_at) {
        fields.push(`completed_at = NOW()`);
      }
    }
    
    if (appealData.processed_at !== undefined) {
      fields.push(`processed_at = $${paramCount++}`);
      values.push(appealData.processed_at);
    }
    
    if (appealData.completed_at !== undefined) {
      fields.push(`completed_at = $${paramCount++}`);
      values.push(appealData.completed_at);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE appeals 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM appeals WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rowCount > 0;
  }

  async list(filters: AppealFilters = {}, limit = 50, offset = 0): Promise<Appeal[]> {
    let query = `
      SELECT a.*, c.name as category_name, u.full_name as user_name
      FROM appeals a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.user_id = u.id
    `;
    
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.status) {
      conditions.push(`a.status = $${paramCount++}`);
      values.push(filters.status);
    }
    
    if (filters.priority) {
      conditions.push(`a.priority = $${paramCount++}`);
      values.push(filters.priority);
    }
    
    if (filters.category_id) {
      conditions.push(`a.category_id = $${paramCount++}`);
      values.push(filters.category_id);
    }
    
    if (filters.user_id) {
      conditions.push(`a.user_id = $${paramCount++}`);
      values.push(filters.user_id);
    }
    
    if (filters.date_from) {
      conditions.push(`a.submitted_at >= $${paramCount++}`);
      values.push(filters.date_from);
    }
    
    if (filters.date_to) {
      conditions.push(`a.submitted_at <= $${paramCount++}`);
      values.push(filters.date_to);
    }
    
    if (filters.search) {
      conditions.push(`(a.subject ILIKE $${paramCount} OR a.description ILIKE $${paramCount} OR a.tracking_number ILIKE $${paramCount})`);
      values.push(`%${filters.search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY a.submitted_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limit, offset);

    const result = await this.db.query(query, values);
    return result.rows;
  }

  async count(filters: AppealFilters = {}): Promise<number> {
    let query = 'SELECT COUNT(*) FROM appeals a';
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.status) {
      conditions.push(`a.status = $${paramCount++}`);
      values.push(filters.status);
    }
    
    if (filters.priority) {
      conditions.push(`a.priority = $${paramCount++}`);
      values.push(filters.priority);
    }
    
    if (filters.category_id) {
      conditions.push(`a.category_id = $${paramCount++}`);
      values.push(filters.category_id);
    }
    
    if (filters.user_id) {
      conditions.push(`a.user_id = $${paramCount++}`);
      values.push(filters.user_id);
    }
    
    if (filters.date_from) {
      conditions.push(`a.submitted_at >= $${paramCount++}`);
      values.push(filters.date_from);
    }
    
    if (filters.date_to) {
      conditions.push(`a.submitted_at <= $${paramCount++}`);
      values.push(filters.date_to);
    }
    
    if (filters.search) {
      conditions.push(`(a.subject ILIKE $${paramCount} OR a.description ILIKE $${paramCount} OR a.tracking_number ILIKE $${paramCount})`);
      values.push(`%${filters.search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await this.db.query(query, values);
    return parseInt(result.rows[0].count);
  }

  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_category: Array<{ category_name: string; count: number }>;
  }> {
    // Total count
    const totalResult = await this.db.query('SELECT COUNT(*) FROM appeals');
    const total = parseInt(totalResult.rows[0].count);

    // By status
    const statusResult = await this.db.query(`
      SELECT status, COUNT(*) as count 
      FROM appeals 
      GROUP BY status
    `);
    const by_status = statusResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    // By priority
    const priorityResult = await this.db.query(`
      SELECT priority, COUNT(*) as count 
      FROM appeals 
      GROUP BY priority
    `);
    const by_priority = priorityResult.rows.reduce((acc, row) => {
      acc[row.priority] = parseInt(row.count);
      return acc;
    }, {});

    // By category
    const categoryResult = await this.db.query(`
      SELECT c.name as category_name, COUNT(a.id) as count
      FROM appeals a
      LEFT JOIN categories c ON a.category_id = c.id
      GROUP BY c.name
      ORDER BY count DESC
    `);
    const by_category = categoryResult.rows.map(row => ({
      category_name: row.category_name || 'Без категории',
      count: parseInt(row.count)
    }));

    return {
      total,
      by_status,
      by_priority,
      by_category
    };
  }

  private generateTrackingNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `AP${timestamp}${random}`.toUpperCase();
  }
}