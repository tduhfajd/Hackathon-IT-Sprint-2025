const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Маппинг названий файлов на категории и теги
const CATEGORY_MAP = {
  'blagooustroystvo.md': { category: 'Благоустройство', tags: ['благоустройство', 'территория'] },
  'dvory-i-territorii.md': { category: 'Благоустройство', tags: ['дворы', 'территории', 'благоустройство'] },
  'elektrosnabzhenie.md': { category: 'Электроснабжение', tags: ['электричество', 'электроснабжение', 'свет'] },
  'mnogokvartirnye-doma.md': { category: 'ЖКУ', tags: ['МКД', 'многоквартирные дома', 'жилищно-коммунальные услуги'] },
  'musor.md': { category: 'Мусор', tags: ['мусор', 'отходы', 'ТКО'] },
  'parki-kultury-i-otdykha.md': { category: 'Благоустройство', tags: ['парки', 'культура', 'отдых'] },
  'plata-za-zhku.md': { category: 'ЖКУ', tags: ['оплата', 'ЖКУ', 'тарифы', 'платежи'] },
  'socialnaya-gazifikatsiya.md': { category: 'ЖКУ', tags: ['газификация', 'газ', 'социальная газификация'] },
  'teplosnabzhenie.md': { category: 'Теплоснабжение', tags: ['отопление', 'тепло', 'теплоснабжение'] },
  'vodosnabzhenie.md': { category: 'Водоснабжение', tags: ['вода', 'водоснабжение', 'водоотведение'] },
  'inoe.md': { category: null, tags: ['прочее', 'иное'] }
};

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smart_assistant',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'StrongPasswordChange2025!'
});

async function getCategoryId(categoryName) {
  if (!categoryName) return null;
  
  const result = await pool.query(
    'SELECT id FROM categories WHERE name = $1',
    [categoryName]
  );
  
  return result.rows.length > 0 ? result.rows[0].id : null;
}

async function importArticle(filePath, fileName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Извлекаем заголовок (первая строка с #)
    const lines = content.split('\n');
    let title = fileName.replace('.md', '').replace(/-/g, ' ');
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        title = line.replace('# ', '').trim();
        break;
      }
    }
    
    // Получаем категорию и теги
    const mapping = CATEGORY_MAP[fileName] || { category: null, tags: [] };
    const categoryId = await getCategoryId(mapping.category);
    
    // Проверяем, существует ли уже статья с таким названием
    const existing = await pool.query(
      'SELECT id FROM knowledge_base WHERE title = $1',
      [title]
    );
    
    if (existing.rows.length > 0) {
      // Обновляем существующую статью
      await pool.query(
        `UPDATE knowledge_base 
         SET content = $1, category_id = $2, tags = $3, updated_at = NOW()
         WHERE title = $4`,
        [content, categoryId, mapping.tags, title]
      );
      console.log(`✅ Обновлена статья: ${title}`);
    } else {
      // Создаем новую статью
      await pool.query(
        `INSERT INTO knowledge_base (title, content, category_id, tags, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [title, content, categoryId, mapping.tags]
      );
      console.log(`✅ Создана статья: ${title}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при импорте ${fileName}:`, error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Начинаем импорт статей из knowledge_base/manual...\n');
    
    const manualDir = path.join(__dirname, '../knowledge_base/manual');
    const files = fs.readdirSync(manualDir).filter(f => f.endsWith('.md') && f !== 'test_queries.md');
    
    console.log(`📚 Найдено файлов: ${files.length}\n`);
    
    for (const file of files) {
      const filePath = path.join(manualDir, file);
      await importArticle(filePath, file);
    }
    
    // Статистика
    const stats = await pool.query('SELECT COUNT(*) as total FROM knowledge_base');
    console.log(`\n✨ Импорт завершен! Всего статей в базе: ${stats.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await pool.end();
  }
}

main();

