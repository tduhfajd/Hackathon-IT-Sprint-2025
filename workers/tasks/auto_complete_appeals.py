"""
Celery задача для автозавершения обращений с неактивностью >5 минут

Автоматически переводит обращения в статус 'completed' если:
1. Статус обращения 'in_progress'
2. Последняя активность пользователя была более 5 минут назад
3. Нет непрочитанных сообщений от пользователя
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from celery_app import app
from datetime import datetime, timedelta

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'smart-support-db'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('POSTGRES_DB', 'smart_support'),
    'user': os.getenv('POSTGRES_USER', 'postgres'),
    'password': os.getenv('POSTGRES_PASSWORD', 'StrongPasswordChange2025!')
}


@app.task(name='tasks.auto_complete_appeals')
def auto_complete_appeals():
    """
    Автозавершение неактивных обращений (периодическая задача)
    
    Эта задача должна запускаться по расписанию (например, каждые 2 минуты)
    и проверять обращения в статусе 'in_progress' на неактивность.
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("✅ Connected to database for auto-completion check")
        
        # Порог неактивности: 5 минут
        inactivity_threshold = datetime.now() - timedelta(minutes=5)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Найти обращения с неактивностью >5 минут
            cur.execute("""
                SELECT id, tracking_number, last_activity_at, unread_operator_count,
                       source, telegram_chat_id
                FROM appeals
                WHERE status = 'in_progress'
                AND last_activity_at < %s
                AND (unread_operator_count IS NULL OR unread_operator_count = 0)
            """, [inactivity_threshold])
            
            inactive_appeals = cur.fetchall()
            
            if not inactive_appeals:
                print("ℹ️  No inactive appeals found")
                return {'checked_at': datetime.now().isoformat(), 'auto_completed': 0}
            
            print(f"📋 Found {len(inactive_appeals)} inactive appeals")
            
            completed_count = 0
            for appeal in inactive_appeals:
                try:
                    # Обновить статус на 'completed'
                    cur.execute("""
                        UPDATE appeals
                        SET status = 'completed',
                            completed_at = NOW(),
                            updated_at = NOW()
                        WHERE id = %s
                    """, [appeal['id']])
                    
                    conn.commit()
                    
                    print(f"  ✅ Auto-completed appeal {appeal['tracking_number']} (inactive since {appeal['last_activity_at']})")
                    completed_count += 1
                    
                    # Если обращение из Telegram, отправить уведомление
                    if appeal['source'] == 'telegram' and appeal['telegram_chat_id']:
                        try:
                            # Импортируем здесь, чтобы избежать циклических зависимостей
                            from celery_app import app as celery_app
                            celery_app.send_task(
                                'tasks.send_telegram_notification',
                                args=[
                                    appeal['telegram_chat_id'],
                                    "⏱️ <b>Обращение автоматически завершено</b>\n\n"
                                    "Ваше обращение было автоматически закрыто по причине неактивности (более 5 минут без новых сообщений).\n\n"
                                    "Если вам нужна дополнительная помощь, создайте новое обращение с помощью команды /new\n\n"
                                    "Благодарим за обращение! 👋"
                                ]
                            )
                            print(f"  📱 Sent auto-completion notification to Telegram")
                        except Exception as telegram_error:
                            print(f"  ⚠️  Failed to send Telegram notification: {telegram_error}")
                
                except Exception as appeal_error:
                    print(f"  ❌ Error auto-completing appeal {appeal['tracking_number']}: {appeal_error}")
                    conn.rollback()
                    continue
        
        conn.close()
        
        result = {
            'checked_at': datetime.now().isoformat(),
            'auto_completed': completed_count,
            'threshold_minutes': 5
        }
        
        print(f"✅ Auto-completion check complete: {completed_count} appeals auto-completed")
        return result
    
    except Exception as e:
        print(f"❌ Error in auto_complete_appeals: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}


# Для тестирования: можно запустить вручную
if __name__ == '__main__':
    print("🧪 Testing auto_complete_appeals task...")
    result = auto_complete_appeals()
    print(f"Result: {result}")

