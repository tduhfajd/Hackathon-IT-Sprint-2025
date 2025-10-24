"""
Celery Task: Generate AI Response
Генерирует вариант ответа на основе базы знаний
"""
import os
import re
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
        # Есть статьи в KB - генерируем человекоподобный ответ
        article = articles[0]
        
        # Генерируем персонализированный ответ на основе статьи
        suggested_text = generate_human_like_response(
            question=description,
            category=subject,
            knowledge_base_article=article['content'],
            article_title=article['title']
        )
        
        confidence = 0.85
        sources = [article['title']]
        print(f"✅ Найдена статья в БЗ: {article['title']}")
        print(f"✅ Сгенерирован персонализированный ответ")
    else:
        # ⚠️ Нет статей - краткий профессиональный ответ для гражданина
        # Оператор увидит низкий confidence и поймёт что нужна ручная обработка
        suggested_text = "Благодарю за обращение. Для решения вашего вопроса потребуется дополнительное время. Я уточню информацию и свяжусь с вами."
        confidence = 0.3  # Низкая уверенность = сигнал оператору что нужна ручная обработка
        sources = []
        print(f"⚠️ Статьи НЕ НАЙДЕНЫ для категории '{subject}'")
        print(f"⚠️ Низкий confidence (0.3) - оператор увидит что нужна ручная обработка")
        print(f"⚠️ Рекомендуется добавить информацию в базу знаний")
    
    # 3. Сохранить предложенный ответ
    save_response(appeal_id, suggested_text, confidence, sources)
    
    print(f"✅ Response generated for {appeal_id}")
    
    return {
        'appeal_id': appeal_id,
        'suggested_text': suggested_text[:100],
        'confidence': confidence
    }


def generate_human_like_response(question: str, category: str, knowledge_base_article: str, article_title: str) -> str:
    """
    Генерирует человекоподобный ответ на основе статьи из базы знаний
    Использует простую логику извлечения релевантной информации
    """
    # Извлекаем ключевые слова из вопроса
    keywords = extract_keywords(question)
    
    # Находим релевантные секции в статье
    relevant_sections = find_relevant_sections(knowledge_base_article, keywords)
    
    # Формируем структурированный ответ
    if relevant_sections:
        # Есть конкретная информация по вопросу
        answer_parts = []
        
        # Добавляем релевантные части БЕЗ пробелов
        for i, section in enumerate(relevant_sections[:3]):  # Максимум 3 секции
            # Убираем bullet points и лишние переносы
            clean_section = re.sub(r'^\s*[-•*]\s*', '', section, flags=re.MULTILINE)
            clean_section = re.sub(r'\n+', ' ', clean_section).strip()
            
            # Разбиваем длинные секции на предложения для читаемости
            sentences = re.split(r'(?<=[.!?])\s+', clean_section)
            formatted_section = ' '.join(sentences)
            
            answer_parts.append(f"• {formatted_section}")
        
        return "\n".join(answer_parts)
    else:
        # Общий ответ со всей информацией из статьи (без подписи для чата)
        content_preview = knowledge_base_article[:800]
        last_period = content_preview.rfind('.')
        if last_period > 200:
            content_preview = content_preview[:last_period + 1]
        
        # Убираем markdown и лишние переносы
        clean_content = re.sub(r'^#+\s+.+$', '', content_preview, flags=re.MULTILINE)
        clean_content = re.sub(r'\n+', '\n', clean_content).strip()
        
        return clean_content


def extract_keywords(text: str) -> list:
    """Извлекает ключевые слова из текста"""
    # Удаляем стоп-слова и короткие слова
    stop_words = {'как', 'что', 'где', 'когда', 'почему', 'это', 'для', 'при', 'или', 'нужно', 'можно', 'есть'}
    words = re.findall(r'\b\w+\b', text.lower())
    keywords = [w for w in words if len(w) > 3 and w not in stop_words]
    return keywords[:10]  # Первые 10 ключевых слов


def find_relevant_sections(article: str, keywords: list) -> list:
    """Находит релевантные секции в статье на основе ключевых слов"""
    sections = []
    
    # Убираем все заголовки markdown и разбиваем на параграфы
    clean_article = re.sub(r'^#+\s+.+$', '', article, flags=re.MULTILINE)
    paragraphs = [p.strip() for p in clean_article.split('\n') if p.strip()]
    
    # Объединяем короткие строки в параграфы (пункты списков и т.д.)
    combined_paragraphs = []
    current = []
    
    for para in paragraphs:
        current.append(para)
        # Если параграф заканчивается точкой или набралось 3+ строки
        if para.endswith('.') or para.endswith('?') or para.endswith('!') or len(current) >= 3:
            combined = ' '.join(current)
            if len(combined) > 50:  # Только значимые параграфы
                combined_paragraphs.append(combined)
            current = []
    
    if current:  # Остаток
        combined = ' '.join(current)
        if len(combined) > 50:
            combined_paragraphs.append(combined)
    
    # Ищем параграфы с ключевыми словами
    for paragraph in combined_paragraphs:
        # Подсчитываем совпадения ключевых слов
        matches = sum(1 for keyword in keywords if keyword in paragraph.lower())
        
        if matches > 0:
            # Очищаем от markdown
            clean_para = re.sub(r'\*\*(.+?)\*\*', r'\1', paragraph)
            clean_para = re.sub(r'^[\-\*]\s+', '', clean_para)
            sections.append((matches, clean_para))
    
    # Сортируем по количеству совпадений и берем лучшие
    sections.sort(reverse=True, key=lambda x: x[0])
    return [s[1] for s in sections[:4]]  # Топ-4 релевантных секции


def search_knowledge_base(category: str, text: str) -> list:
    """
    Ищет релевантные статьи в ВСЕЙ базе знаний с ранжированием
    Не ограничивается категорией - ищет по всем статьям
    """
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Извлекаем ключевые слова из текста
            words = [w.strip('.,!?;:').lower() for w in text.split() if len(w) > 3][:8]
            
            if not words:
                words = [category.lower()]
            
            # Строим запрос с ранжированием релевантности
            # Приоритет 1: совпадение с категорией обращения
            # Приоритет 2: совпадение ключевых слов в названии
            # Приоритет 3: совпадение ключевых слов в тегах
            # Приоритет 4: совпадение ключевых слов в содержании
            
            conditions = []
            params = []
            
            # Категория (высший приоритет)
            conditions.append("c.name ILIKE %s")
            params.append(f'%{category}%')
            
            # Ключевые слова в разных полях
            for word in words[:5]:  # Топ-5 слов
                conditions.append(f"(kb.title ILIKE %s OR kb.content ILIKE %s OR %s = ANY(kb.tags))")
                params.extend([f'%{word}%', f'%{word}%', word])
            
            where_clause = ' OR '.join(conditions)
            
            cur.execute(f"""
                SELECT 
                    kb.id, 
                    kb.title, 
                    kb.content, 
                    c.name as category_name,
                    -- Рассчитываем релевантность
                    (
                        CASE WHEN c.name ILIKE %s THEN 100 ELSE 0 END +
                        CASE WHEN kb.title ILIKE %s THEN 50 ELSE 0 END +
                        CASE WHEN kb.title ILIKE %s THEN 30 ELSE 0 END +
                        CASE WHEN %s = ANY(kb.tags) THEN 40 ELSE 0 END +
                        CASE WHEN kb.content ILIKE %s THEN 10 ELSE 0 END
                    ) as relevance_score
                FROM knowledge_base kb
                LEFT JOIN categories c ON kb.category_id = c.id
                WHERE kb.is_active = true 
                AND ({where_clause})
                ORDER BY relevance_score DESC, kb.updated_at DESC
                LIMIT 3
            """, [
                f'%{category}%',  # категория в score
                f'%{words[0]}%' if words else '%',  # первое слово в title
                f'%{words[1]}%' if len(words) > 1 else '%',  # второе слово в title
                words[0] if words else '',  # первое слово в tags
                f'%{words[0]}%' if words else '%',  # первое слово в content
                *params  # параметры для WHERE
            ])
            
            results = cur.fetchall()
            
            # Логируем релевантность
            for r in results:
                print(f"  📄 Найдена статья: '{r['title']}' (релевантность: {r.get('relevance_score', 0)})")
            
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

