"""
Celery Task: Contextual AI Response
Генерирует ответ с учётом всей истории диалога
"""
import os
import re
from celery_app import app
import psycopg2
from psycopg2.extras import RealDictCursor
from gigachat_client import get_gigachat_client

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'db'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('POSTGRES_DB', 'smart_assistant'),
    'user': os.getenv('POSTGRES_USER', 'user'),
    'password': os.getenv('POSTGRES_PASSWORD', 'password')
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
    
    # 3. Найти статью по ОРИГИНАЛЬНОЙ категории обращения (не искать заново!)
    category = appeal_info.get('category_suggestion', '')
    article = find_article_by_category(category)
    
    # 4. Определить последний вопрос пользователя
    last_citizen_message = next((msg for msg in reversed(chat_history) if msg['sender_type'] == 'citizen'), None)
    
    if not last_citizen_message:
        print(f"⚠️  No citizen messages in chat for {appeal_id}")
        return {'appeal_id': appeal_id, 'no_citizen_message': True}
    
    # Проверка на простое сообщение (уже делает generate_response.py, но для страховки)
    simple_patterns = [
        r'^(спасибо|благодарю|спс|ok|ок|понял|понятно|хорошо|ясно)[\.\!\?]*$',
        r'^(до свидания|всего доброго|пока|bye)[\.\!\?]*$'
    ]
    message_normalized = last_citizen_message['message'].strip().lower()
    for pattern in simple_patterns:
        if re.match(pattern, message_normalized):
            print(f"  ⏭️ Простое сообщение ('{message_normalized}') - пропускаем")
            return {'appeal_id': appeal_id, 'skipped': True, 'reason': 'simple_message'}
    
    # 5. Сгенерировать контекстный ответ через GigaChat
    if article:
        print(f"  📄 Использую статью: '{article['title']}' (категория: {category})")
        
        try:
            gigachat = get_gigachat_client()
            
            # Формируем контекст диалога (последние 5 сообщений)
            dialog_context = "\n".join([
                f"{'Гражданин' if msg['sender_type'] == 'citizen' else 'Оператор'}: {msg['message']}"
                for msg in chat_history[-5:]
            ])
            
            # Отправляем в GigaChat с контекстом
            result = gigachat.generate_answer_from_article(
                question=f"[История диалога]\n{dialog_context}\n\n[Новый вопрос]\n{last_citizen_message['message']}",
                article_content=article['content'],
                article_title=article['title'],
                max_tokens=512
            )
            
            # Проверяем успешность ответа
            if not result.get('success', False):
                raise Exception(result.get('error', 'Unknown error from GigaChat'))
            
            suggested_text = result['answer']
            
            # Проверка на SKIP_SIMPLE_MESSAGE
            if suggested_text.strip() == "SKIP_SIMPLE_MESSAGE":
                print(f"  ⏭️ GigaChat распознал простое сообщение - пропускаем")
                return {'appeal_id': appeal_id, 'skipped': True, 'reason': 'gigachat_skip'}
            
            confidence = result.get('confidence', 0.85)
            sources = [article['title']]
            print(f"  ✅ GigaChat сгенерировал контекстный ответ (confidence: {confidence:.2f})")
        
        except Exception as e:
            print(f"  ⚠️ Ошибка GigaChat: {e}")
            # Fallback: общий ответ
            suggested_text = f"""Здравствуйте!

Благодарю за дополнительный вопрос. Я передал всю информацию специалисту профильного отдела с учётом нашего предыдущего общения.

Если у вас появятся ещё вопросы, буду рад помочь.

С уважением,
Служба поддержки"""
            confidence = 0.4
            sources = []
    else:
        # Статья не найдена - общий ответ
        print(f"  ⚠️ Статья для категории '{category}' не найдена")
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


def find_article_by_category(category: str):
    """
    Находит статью СТРОГО по категории обращения (не ищет по ключевым словам!)
    Это гарантирует, что контекстные ответы останутся в рамках темы первого вопроса
    """
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT kb.id, kb.title, kb.content, c.name as category_name
                FROM knowledge_base kb
                LEFT JOIN categories c ON kb.category_id = c.id
                WHERE kb.is_active = true 
                AND c.name ILIKE %s
                ORDER BY kb.updated_at DESC
                LIMIT 1
            """, [f'%{category}%'])
            
            result = cur.fetchone()
            return dict(result) if result else None
    finally:
        conn.close()


def generate_contextual_human_response(last_question: str, article_content: str, article_title: str) -> str:
    """
    Генерирует человекоподобный контекстный ответ
    """
    # Извлекаем ключевые слова из вопроса
    keywords = [w.strip('.,!?;:').lower() for w in last_question.split() if len(w) > 3][:8]
    
    # Находим релевантные части статьи
    relevant_parts = find_relevant_parts(article_content, keywords)
    
    if relevant_parts:
        answer = f"""Здравствуйте!

Отвечаю на ваш дополнительный вопрос:

{relevant_parts}

Если нужны ещё уточнения, пожалуйста, напишите.

С уважением,
Служба поддержки"""
    else:
        # Fallback - берём начало статьи
        clean_content = re.sub(r'^#+\s+.+$', '', article_content, flags=re.MULTILINE)
        preview = clean_content[:600]
        last_dot = preview.rfind('.')
        if last_dot > 200:
            preview = preview[:last_dot + 1]
        
        answer = f"""Здравствуйте!

По вашему дополнительному вопросу:

{preview}

Если требуется более детальная информация, уточните.

С уважением,
Служба поддержки"""
    
    return answer


def find_relevant_parts(content: str, keywords: list) -> str:
    """Находит релевантные части текста по ключевым словам"""
    # Убираем заголовки
    clean_content = re.sub(r'^#+\s+.+$', '', content, flags=re.MULTILINE)
    paragraphs = [p.strip() for p in clean_content.split('\n') if p.strip() and len(p) > 50]
    
    # Ищем параграфы с ключевыми словами
    scored = []
    for para in paragraphs:
        score = sum(1 for kw in keywords if kw in para.lower())
        if score > 0:
            clean_para = re.sub(r'\*\*(.+?)\*\*', r'\1', para)
            clean_para = re.sub(r'^[\-\*]\s+', '', clean_para)
            scored.append((score, clean_para))
    
    # Берём топ-2 самых релевантных
    scored.sort(reverse=True, key=lambda x: x[0])
    result = '\n\n'.join([p[1] for p in scored[:2]])
    
    return result if result else ''


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
    """
    Поиск в ВСЕЙ базе знаний с учётом контекста диалога
    Может найти статьи по любой теме, не только из категории обращения
    """
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Извлечь ключевые слова из контекста диалога
            keywords = [word.strip('.,!?;:').lower() for word in context.split() if len(word) > 3]
            
            # Приоритезируем последние слова (свежий контекст)
            keywords = keywords[-10:]  # Последние 10 ключевых слов
            
            if not keywords:
                keywords = [category.lower()]
            
            # Строим условия поиска по всей БЗ
            conditions = []
            params = []
            
            # Добавляем условия для каждого ключевого слова
            for word in keywords[:6]:  # Топ-6 слов
                conditions.append("(kb.title ILIKE %s OR kb.content ILIKE %s OR %s = ANY(kb.tags) OR c.name ILIKE %s)")
                params.extend([f'%{word}%', f'%{word}%', word, f'%{word}%'])
            
            where_clause = ' OR '.join(conditions) if conditions else "1=1"
            
            # Ранжируем результаты по релевантности
            cur.execute(f"""
                SELECT 
                    kb.id, 
                    kb.title, 
                    kb.content, 
                    c.name as category_name,
                    (
                        CASE WHEN kb.title ILIKE %s THEN 80 ELSE 0 END +
                        CASE WHEN c.name ILIKE %s THEN 60 ELSE 0 END +
                        CASE WHEN %s = ANY(kb.tags) THEN 50 ELSE 0 END +
                        CASE WHEN kb.content ILIKE %s THEN 20 ELSE 0 END
                    ) as relevance_score
                FROM knowledge_base kb
                LEFT JOIN categories c ON kb.category_id = c.id
                WHERE kb.is_active = true 
                AND ({where_clause})
                ORDER BY relevance_score DESC, kb.updated_at DESC
                LIMIT 3
            """, [
                f'%{keywords[0]}%' if keywords else '%',  # первое слово в title
                f'%{keywords[0]}%' if keywords else '%',  # первое слово в category
                keywords[0] if keywords else '',  # первое слово в tags
                f'%{keywords[0]}%' if keywords else '%',  # первое слово в content
                *params  # параметры для WHERE
            ])
            
            results = cur.fetchall()
            
            # Логируем что нашли
            for r in results:
                print(f"  📄 Контекстная статья: '{r['title']}' (score: {r.get('relevance_score', 0)})")
            
            return results
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

