import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface AIAnalysisResult {
  category: string;
  priority: 'low' | 'medium' | 'high';
  sentiment_type: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  keywords: string[];
  summary: string;
}

interface AIResponseResult {
  suggested_text: string;
  confidence: number;
  sources: string[];
}

export class FallbackAIService {
  constructor(private pool: Pool) {}

  async analyzeAppeal(appealId: string, subject: string, description: string): Promise<AIAnalysisResult> {
    logger.info('FallbackAI: Starting analysis', { appealId });

    const text = `${subject} ${description}`.toLowerCase();

    // Category is already selected by user in dropdown - use it directly
    const category = subject;
    const priority = this.detectPriority(text);
    const sentiment = this.detectSentiment(text);
    const keywords = this.extractKeywords(text);
    const summary = this.generateSummary(subject, description);

    // Save to database
    await this.saveAnalysis(appealId, {
      category,
      priority,
      sentiment_type: sentiment.type,
      sentiment_score: sentiment.score,
      keywords,
      summary
    });

    logger.info('FallbackAI: Analysis completed', { appealId, category, priority, sentiment: sentiment.type });

    return {
      category,
      priority,
      sentiment_type: sentiment.type,
      sentiment_score: sentiment.score,
      keywords,
      summary
    };
  }

  async generateResponse(appealId: string, text: string): Promise<AIResponseResult> {
    logger.info('FallbackAI: Generating response', { appealId });

    const category = this.detectCategory(text.toLowerCase());
    
    // Search knowledge base
    const articles = await this.searchKnowledgeBase(category, text);
    
    let suggested_text = '';
    const sources: string[] = [];

    if (articles.length > 0) {
      // Use first relevant article
      const article = articles[0];
      sources.push(article.title);
      
      suggested_text = `Здравствуйте!\n\nПо вашему обращению относительно "${category}" могу предоставить следующую информацию:\n\n${article.content.substring(0, 500)}...\n\nЕсли у вас остались вопросы, пожалуйста, уточните.`;
    } else {
      // Generic response
      suggested_text = `Здравствуйте!\n\nСпасибо за ваше обращение. Я передал вашу информацию в профильный отдел. Специалист свяжется с вами в ближайшее время для решения вопроса.\n\nС уважением,\nСлужба поддержки`;
    }

    // Save suggested response
    await this.saveSuggestedResponse(appealId, suggested_text, sources);

    return {
      suggested_text,
      confidence: articles.length > 0 ? 0.75 : 0.5,
      sources
    };
  }

  private detectCategory(text: string): string {
    const categories: Record<string, string[]> = {
      'Водоснабжение': ['вода', 'водоснабжение', 'горячая вода', 'холодная вода', 'напор', 'отключение воды'],
      'Теплоснабжение': ['отопление', 'тепло', 'батареи', 'радиаторы', 'холодно', 'теплоснабжение'],
      'Электроснабжение': ['электричество', 'свет', 'электроснабжение', 'лампочка', 'проводка'],
      'Мусор': ['мусор', 'контейнер', 'вывоз', 'отходы', 'свалка'],
      'Благоустройство': ['освещение', 'фонарь', 'дорога', 'тротуар', 'лавочка', 'детская площадка'],
      'ЖКУ': ['жкх', 'квитанция', 'тариф', 'оплата', 'счет'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'Другое';
  }

  private detectPriority(text: string): 'low' | 'medium' | 'high' {
    const urgent_keywords = ['срочно', 'аварийн', 'опасно', 'критично', 'немедленно', 'угроза'];
    const high_keywords = ['давно', 'долго', 'третий день', 'неделю', 'месяц'];

    if (urgent_keywords.some(k => text.includes(k))) {
      return 'high';
    }
    if (high_keywords.some(k => text.includes(k))) {
      return 'medium';
    }
    return 'medium';
  }

  private detectSentiment(text: string): { type: 'positive' | 'neutral' | 'negative', score: number } {
    const negative_keywords = ['плохо', 'ужасно', 'недовольн', 'возмущен', 'жалоба', 'не работает'];
    const positive_keywords = ['спасибо', 'благодар', 'хорошо', 'отлично'];

    const negative_count = negative_keywords.filter(k => text.includes(k)).length;
    const positive_count = positive_keywords.filter(k => text.includes(k)).length;

    if (negative_count > positive_count) {
      return { type: 'negative', score: 0.3 };
    } else if (positive_count > negative_count) {
      return { type: 'positive', score: 0.8 };
    }
    return { type: 'neutral', score: 0.5 };
  }

  private extractKeywords(text: string): string[] {
    const common_words = ['в', 'на', 'и', 'с', 'по', 'для', 'о', 'из', 'к', 'что', 'как', 'же', 'уже', 'а', 'но'];
    const words = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !common_words.includes(word))
      .slice(0, 10);
    return [...new Set(words)];
  }

  private generateSummary(subject: string, description: string): string {
    return description.length > 100 
      ? description.substring(0, 100) + '...'
      : description;
  }

  private async searchKnowledgeBase(category: string, text: string): Promise<any[]> {
    try {
      const query = `
        SELECT kb.*, c.name as category_name
        FROM knowledge_base kb
        LEFT JOIN categories c ON kb.category_id = c.id
        WHERE kb.is_active = true 
        AND (c.name ILIKE $1 OR kb.content ILIKE $2)
        ORDER BY 
          CASE WHEN c.name ILIKE $1 THEN 1 ELSE 2 END,
          kb.created_at DESC
        LIMIT 3
      `;
      
      const result = await this.pool.query(query, [`%${category}%`, `%${text.split(' ')[0]}%`]);
      return result.rows;
    } catch (error: any) {
      logger.error('FallbackAI: KB search failed', { error: error.message });
      return [];
    }
  }

  private async saveAnalysis(appealId: string, analysis: any): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO appeal_analysis 
         (appeal_id, category_suggestion, priority_suggestion, sentiment_type, sentiment_score, keywords, summary, ai_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0.7)
         ON CONFLICT (appeal_id) DO UPDATE SET
         category_suggestion = $2, priority_suggestion = $3, sentiment_type = $4, 
         sentiment_score = $5, keywords = $6, summary = $7`,
        [appealId, analysis.category, analysis.priority, analysis.sentiment_type, 
         analysis.sentiment_score, analysis.keywords, analysis.summary]
      );
    } catch (error: any) {
      logger.error('FallbackAI: Failed to save analysis', { error: error.message });
    }
  }

  private async saveSuggestedResponse(appealId: string, text: string, sources: string[]): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO ai_responses (appeal_id, suggested_text, confidence, sources, created_at)
         VALUES ($1, $2, 0.75, $3, NOW())`,
        [appealId, text, sources]
      );
    } catch (error: any) {
      logger.error('FallbackAI: Failed to save response', { error: error.message });
    }
  }
}

