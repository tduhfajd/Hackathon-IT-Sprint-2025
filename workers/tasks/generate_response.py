"""
Celery Task: Generate AI Response
Генерирует вариант ответа на основе базы знаний
"""
import os
from celery_app import app
import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'db'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'smart_assistant'),
    'user': os.getenv('DB_USER', 'user'),
    'password': os.getenv('DB_PASSWORD', 'password')
}


@app.task(name='tasks.generate_response')
def generate_response(appeal_id: str, subject: str, description: str):
    """
    Генерирует вариант ответа оператору
    
    Args:
        appeal_id: ID обращения
        subject: Тема (категория)
        description: Текст обращения
    """
    print(f"💬 Generating response for appeal {appeal_id}")
    
    # 1. Поиск релевантных статей в базе знаний
    articles = search_knowledge_base(subject, description)
    
    # 2. Генерация ответа
    if articles:
        # Есть статьи в KB
        article = articles[0]
        # Берем первые 800 символов для ответа
        content_preview = article['content'][:800]
        # Обрезаем по последнему предложению
        last_period = content_preview.rfind('.')
        if last_period > 200:
            content_preview = content_preview[:last_period + 1]
        
        suggested_text = f"""Здравствуйте!

По вашему обращению относительно "{subject}" предоставляю информацию из базы знаний:

{content_preview}

Если у вас остались вопросы или нужна дополнительная информация, пожалуйста, уточните.

С уважением,
Служба поддержки"""
        confidence = 0.85
        sources = [article['title']]
        print(f"✅ Найдена статья в БЗ: {article['title']}")
    else:
        # ⚠️ Нет статей - важное уведомление для оператора
        suggested_text = f"""⚠️ ВНИМАНИЕ: В базе знаний не найдена информация по теме "{subject}"

Здравствуйте!

Благодарю за ваше обращение. К сожалению, по данному вопросу в базе знаний отсутствует готовая информация. 

Я передал ваше обращение специалисту профильного отдела. Он свяжется с вами в ближайшее время для детального рассмотрения вопроса и предоставления актуальной информации.

Пожалуйста, ожидайте звонка или письма от специалиста.

С уважением,
Служба поддержки

---
⚠️ ОПЕРАТОРУ: Рекомендуется добавить информацию по этой теме в базу знаний."""
        confidence = 0.3  # Низкая уверенность при отсутствии статей
        sources = []
        print(f"⚠️ Статьи НЕ НАЙДЕНЫ для категории '{subject}'")
        print(f"⚠️ Оператор должен обработать вручную или добавить в БЗ")
    
    # 3. Сохранить предложенный ответ
    save_response(appeal_id, suggested_text, confidence, sources)
    
    print(f"✅ Response generated for {appeal_id}")
    
    return {
        'appeal_id': appeal_id,
        'suggested_text': suggested_text[:100],
        'confidence': confidence
    }


def search_knowledge_base(category: str, text: str) -> list:
    """Ищет релевантные статьи в базе знаний с улучшенным поиском"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Извлекаем ключевые слова из текста (первые 3-5 значимых слов)
            words = [w.strip('.,!?;:').lower() for w in text.split() if len(w) > 3][:5]
            
            # Поиск по категории (приоритет 1)
            cur.execute("""
                SELECT kb.id, kb.title, kb.content, c.name as category_name, 1 as relevance
                FROM knowledge_base kb
                LEFT JOIN categories c ON kb.category_id = c.id
                WHERE kb.is_active = true AND c.name ILIKE %s
                LIMIT 2
            """, (f'%{category}%',))
            results = list(cur.fetchall())
            
            # Если не нашли по категории, ищем по ключевым словам
            if not results and words:
                search_pattern = ' | '.join(words)  # PostgreSQL full-text search
                cur.execute("""
                    SELECT kb.id, kb.title, kb.content, c.name as category_name, 2 as relevance
                    FROM knowledge_base kb
                    LEFT JOIN categories c ON kb.category_id = c.id
                    WHERE kb.is_active = true 
                    AND (kb.title ILIKE %s OR kb.content ILIKE %s OR %s = ANY(kb.tags))
                    ORDER BY kb.created_at DESC
                    LIMIT 2
                """, (f'%{words[0]}%', f'%{words[0]}%', words[0]))
                results = list(cur.fetchall())
            
            return results
    finally:
        conn.close()


def save_response(appeal_id: str, suggested_text: str, confidence: float, sources: list):
    """Сохраняет предложенный ответ в БД"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ai_responses (appeal_id, suggested_text, confidence, sources, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (appeal_id, suggested_text, confidence, sources))
            conn.commit()
    finally:
        conn.close()

