"""
Celery Task: Contextual AI Response
Генерирует ответ с учётом всей истории диалога
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


@app.task(name='tasks.contextual_response')
def contextual_response(appeal_id: str):
    """
    Генерирует AI ответ с учётом всей истории чата
    
    Args:
        appeal_id: ID обращения
    """
    print(f"💬 Generating contextual response for appeal {appeal_id}")
    
    # 1. Получить всю историю чата
    chat_history = get_chat_history(appeal_id)
    
    if len(chat_history) == 0:
        print(f"⚠️  No chat history for appeal {appeal_id}")
        return {'appeal_id': appeal_id, 'no_context': True}
    
    # 2. Получить информацию об обращении
    appeal_info = get_appeal_info(appeal_id)
    
    # 3. Найти релевантные статьи с учётом всего диалога
    full_context = build_context_string(chat_history, appeal_info)
    articles = search_knowledge_base_contextual(appeal_info.get('category_suggestion', ''), full_context)
    
    # 4. Определить последний вопрос пользователя
    last_citizen_message = next((msg for msg in reversed(chat_history) if msg['sender_type'] == 'citizen'), None)
    
    if not last_citizen_message:
        print(f"⚠️  No citizen messages in chat for {appeal_id}")
        return {'appeal_id': appeal_id, 'no_citizen_message': True}
    
    # 5. Сгенерировать контекстный ответ
    if articles:
        # Есть релевантная статья
        article = articles[0]
        suggested_text = f"""Здравствуйте!

Учитывая вашу ситуацию, могу дополнить:

{article['content'][:400]}

Если у вас остались вопросы по этой или другим темам, пожалуйста, уточните.

С уважением,
Служба поддержки"""
        confidence = 0.7
        sources = [article['title']]
    else:
        # Общий контекстный ответ
        suggested_text = f"""Здравствуйте!

Благодарю за дополнительный вопрос. Я передал всю информацию специалисту профильного отдела с учётом нашего предыдущего общения.

Если у вас появятся ещё вопросы, буду рад помочь.

С уважением,
Служба поддержки"""
        confidence = 0.4
        sources = []
    
    # 6. Сохранить контекстный ответ
    save_contextual_response(appeal_id, suggested_text, confidence, sources, len(chat_history))
    
    print(f"✅ Contextual response generated for {appeal_id} (messages: {len(chat_history)})")
    
    return {
        'appeal_id': appeal_id,
        'suggested_text': suggested_text[:100],
        'confidence': confidence,
        'context_length': len(chat_history)
    }


def get_chat_history(appeal_id: str) -> list:
    """Получить историю чата"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT sender_type, message, created_at
                FROM chat_messages
                WHERE appeal_id = %s
                ORDER BY created_at ASC
            """, (appeal_id,))
            return cur.fetchall()
    finally:
        conn.close()


def get_appeal_info(appeal_id: str) -> dict:
    """Получить информацию об обращении"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT subject, description, category_suggestion, priority_suggestion
                FROM appeals
                WHERE id = %s
            """, (appeal_id,))
            result = cur.fetchone()
            return dict(result) if result else {}
    finally:
        conn.close()


def build_context_string(chat_history: list, appeal_info: dict) -> str:
    """Построить контекстную строку из всего диалога"""
    context_parts = [
        f"Изначальное обращение: {appeal_info.get('subject', '')} - {appeal_info.get('description', '')}"
    ]
    
    for msg in chat_history[-5:]:  # Последние 5 сообщений
        sender = "Гражданин" if msg['sender_type'] == 'citizen' else "Оператор"
        context_parts.append(f"{sender}: {msg['message']}")
    
    return " | ".join(context_parts)


def search_knowledge_base_contextual(category: str, context: str) -> list:
    """Поиск в базе знаний с учётом контекста"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Извлечь ключевые слова из контекста
            keywords = [word for word in context.lower().split() if len(word) > 4][:5]
            
            # Поиск по категории и ключевым словам
            search_pattern = '%' + '%'.join(keywords[:3]) + '%' if keywords else f'%{category}%'
            
            cur.execute("""
                SELECT kb.id, kb.title, kb.content, c.name as category_name
                FROM knowledge_base kb
                LEFT JOIN categories c ON kb.category_id = c.id
                WHERE kb.is_active = true 
                AND (c.name ILIKE %s OR kb.title ILIKE %s OR kb.content ILIKE %s)
                ORDER BY kb.created_at DESC
                LIMIT 2
            """, (f'%{category}%', search_pattern, search_pattern))
            return cur.fetchall()
    finally:
        conn.close()


def save_contextual_response(appeal_id: str, suggested_text: str, confidence: float, sources: list, context_length: int):
    """Сохранить контекстный ответ"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ai_responses (appeal_id, suggested_text, confidence, sources, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (appeal_id, suggested_text, confidence, sources))
            conn.commit()
            print(f"💾 Saved contextual response (context: {context_length} messages)")
    finally:
        conn.close()

