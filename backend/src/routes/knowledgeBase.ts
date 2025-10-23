import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/knowledge-base - Получить список всех статей
router.get('/', async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        kb.id,
        kb.title,
        kb.content,
        kb.category_id,
        c.name as category_name,
        kb.tags,
        kb.is_active,
        kb.created_at,
        kb.updated_at
      FROM knowledge_base kb
      LEFT JOIN categories c ON kb.category_id = c.id
      ORDER BY kb.updated_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      articles: result.rows
    });
  } catch (error: any) {
    logger.error('Failed to fetch knowledge base articles', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch articles',
      message: error.message
    });
  }
});

// GET /api/knowledge-base/:id - Получить одну статью по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        kb.id,
        kb.title,
        kb.content,
        kb.category_id,
        c.name as category_name,
        kb.tags,
        kb.is_active,
        kb.created_at,
        kb.updated_at
      FROM knowledge_base kb
      LEFT JOIN categories c ON kb.category_id = c.id
      WHERE kb.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    res.json({
      success: true,
      article: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Failed to fetch article', { error: error.message, id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch article',
      message: error.message
    });
  }
});

// POST /api/knowledge-base - Создать новую статью
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, content, category_id, tags, is_active } = req.body;
    
    // Валидация
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }
    
    const query = `
      INSERT INTO knowledge_base (
        title,
        content,
        category_id,
        tags,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING 
        id,
        title,
        content,
        category_id,
        tags,
        is_active,
        created_at,
        updated_at
    `;
    
    const result = await pool.query(query, [
      title,
      content,
      category_id || null,
      tags || [],
      is_active !== undefined ? is_active : true
    ]);
    
    logger.info('Knowledge base article created', { id: result.rows[0].id, title });
    
    res.status(201).json({
      success: true,
      article: result.rows[0],
      message: 'Article created successfully'
    });
  } catch (error: any) {
    logger.error('Failed to create article', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create article',
      message: error.message
    });
  }
});

// PUT /api/knowledge-base/:id - Обновить статью
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, category_id, tags, is_active } = req.body;
    
    // Валидация
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }
    
    const query = `
      UPDATE knowledge_base
      SET 
        title = $1,
        content = $2,
        category_id = $3,
        tags = $4,
        is_active = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING 
        id,
        title,
        content,
        category_id,
        tags,
        is_active,
        created_at,
        updated_at
    `;
    
    const result = await pool.query(query, [
      title,
      content,
      category_id || null,
      tags || [],
      is_active !== undefined ? is_active : true,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    logger.info('Knowledge base article updated', { id, title });
    
    res.json({
      success: true,
      article: result.rows[0],
      message: 'Article updated successfully'
    });
  } catch (error: any) {
    logger.error('Failed to update article', { error: error.message, id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to update article',
      message: error.message
    });
  }
});

// DELETE /api/knowledge-base/:id - Удалить статью
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const query = `DELETE FROM knowledge_base WHERE id = $1 RETURNING id, title`;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }
    
    logger.info('Knowledge base article deleted', { id, title: result.rows[0].title });
    
    res.json({
      success: true,
      message: 'Article deleted successfully',
      deleted: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Failed to delete article', { error: error.message, id: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete article',
      message: error.message
    });
  }
});

// GET /api/knowledge-base/categories - Получить список категорий
router.get('/meta/categories', async (_req: Request, res: Response) => {
  try {
    const query = `SELECT id, name, description FROM categories ORDER BY name`;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      categories: result.rows
    });
  } catch (error: any) {
    logger.error('Failed to fetch categories', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

// GET /api/knowledge-base/search?q=query - Поиск по статьям
router.get('/search/query', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }
    
    const query = `
      SELECT 
        kb.id,
        kb.title,
        kb.content,
        kb.category_id,
        c.name as category_name,
        kb.tags,
        kb.is_active,
        kb.created_at,
        kb.updated_at
      FROM knowledge_base kb
      LEFT JOIN categories c ON kb.category_id = c.id
      WHERE 
        kb.title ILIKE $1 
        OR kb.content ILIKE $1
        OR $2 = ANY(kb.tags)
      ORDER BY kb.updated_at DESC
    `;
    
    const searchPattern = `%${q}%`;
    const result = await pool.query(query, [searchPattern, q]);
    
    res.json({
      success: true,
      count: result.rows.length,
      query: q,
      articles: result.rows
    });
  } catch (error: any) {
    logger.error('Failed to search articles', { error: error.message, query: req.query.q });
    res.status(500).json({
      success: false,
      error: 'Failed to search articles',
      message: error.message
    });
  }
});

export default router;

