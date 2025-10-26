"""
Celery Task: Analyze Appeal
Определяет приоритет, тональность, ключевые слова используя GigaChat
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


@app.task(name='tasks.analyze_appeal')
def analyze_appeal(appeal_id: str, subject: str, description: str):
    """
    Анализирует обращение и сохраняет результаты используя GigaChat AI
    
    Args:
        appeal_id: ID обращения
        subject: Тема (категория из dropdown)
        description: Текст обращения
    """
    print(f"🔍 Analyzing appeal {appeal_id} with GigaChat AI")
    
    text = f"{subject} {description}"
    
    try:
        # Получаем клиент GigaChat
        gigachat = get_gigachat_client()
        
        # 1. Определение приоритета через GigaChat
        priority_result = gigachat.analyze_text(text, task='priority')
        if priority_result['success']:
            priority = priority_result['result']
            print(f"   🎯 Priority (AI): {priority}")
        else:
            # Fallback на простой анализ
            priority = detect_priority(text.lower())
            print(f"   ⚠️ Priority (fallback): {priority}")
        
        # 2. Определение тональности через GigaChat
        sentiment_result = gigachat.analyze_text(text, task='sentiment')
        if sentiment_result['success']:
            sentiment_type = sentiment_result['result']
            sentiment_score = sentiment_result.get('confidence', 0.85)
            print(f"   😊 Sentiment (AI): {sentiment_type}")
        else:
            # Fallback на простой анализ
            sentiment_type, sentiment_score = detect_sentiment(text.lower())
            print(f"   ⚠️ Sentiment (fallback): {sentiment_type}")
        
        # 3. Извлечение ключевых слов (простой метод - достаточно эффективен)
        keywords = extract_keywords(text.lower())
        
        # 4. Краткое резюме
        summary = description[:200] + ('...' if len(description) > 200 else '')
        
        # 5. Уверенность AI
        ai_confidence = 0.9 if (priority_result.get('success') and sentiment_result.get('success')) else 0.75
        
    except Exception as e:
        # При ошибке GigaChat используем fallback
        print(f"⚠️ GigaChat unavailable, using fallback analysis: {e}")
        text_lower = text.lower()
        priority = detect_priority(text_lower)
        sentiment_type, sentiment_score = detect_sentiment(text_lower)
        keywords = extract_keywords(text_lower)
        summary = description[:200] + ('...' if len(description) > 200 else '')
        ai_confidence = 0.6  # Низкая уверенность для fallback
    
    # Сохранить в БД
    save_analysis(
        appeal_id=appeal_id,
        category=subject,  # Категория из формы пользователя
        priority=priority,
        sentiment_type=sentiment_type,
        sentiment_score=sentiment_score,
        keywords=keywords,
        summary=summary,
        ai_confidence=ai_confidence
    )
    
    print(f"✅ Analysis completed for {appeal_id}: priority={priority}, sentiment={sentiment_type}, confidence={ai_confidence}")
    
    return {
        'appeal_id': appeal_id,
        'priority': priority,
        'sentiment_type': sentiment_type,
        'ai_confidence': ai_confidence
    }


def detect_priority(text: str) -> str:
    """Определяет приоритет по ключевым словам"""
    critical_keywords = ['авария', 'опасно', 'угроза', 'немедленно', 'катастрофа']
    high_keywords = ['срочно', 'критично', 'важно', 'проблема', 'неделю', 'месяц']
    
    if any(kw in text for kw in critical_keywords):
        return 'critical'
    elif any(kw in text for kw in high_keywords):
        return 'high'
    else:
        return 'medium'


def detect_sentiment(text: str) -> tuple[str, float]:
    """Определяет тональность"""
    negative_keywords = ['плохо', 'ужасно', 'недовольн', 'возмущен', 'жалоба', 'не работает', 'проблема']
    positive_keywords = ['спасибо', 'благодар', 'хорошо', 'отлично', 'рад']
    
    negative_count = sum(1 for kw in negative_keywords if kw in text)
    positive_count = sum(1 for kw in positive_keywords if kw in text)
    
    if negative_count > positive_count:
        return 'negative', 0.3
    elif positive_count > negative_count:
        return 'positive', 0.8
    else:
        return 'neutral', 0.5


def extract_keywords(text: str) -> list[str]:
    """Извлекает ключевые слова"""
    # Удалить стоп-слова
    stop_words = {'в', 'на', 'и', 'с', 'по', 'для', 'о', 'из', 'к', 'что', 'как', 'же', 'уже', 'а', 'но', 'не'}
    words = re.findall(r'\b\w{4,}\b', text.lower())
    keywords = [w for w in words if w not in stop_words]
    return list(set(keywords))[:10]  # Топ 10 уникальных


def save_analysis(appeal_id, category, priority, sentiment_type, sentiment_score, keywords, summary, ai_confidence):
    """Сохраняет результаты анализа в БД"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE appeals SET
                    category_suggestion = %s,
                    priority_suggestion = %s,
                    sentiment_type = %s,
                    sentiment_score = %s,
                    keywords = %s,
                    summary = %s,
                    ai_confidence = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (category, priority, sentiment_type, sentiment_score, keywords, summary, ai_confidence, appeal_id))
            conn.commit()
    finally:
        conn.close()

