"""
GigaChat Client using official library
Использует официальную библиотеку gigachat для работы с API
"""
import os
import time
from gigachat import GigaChat
from gigachat.models import Chat, Messages, MessagesRole


class GigaChatClient:
    """
    Клиент для работы с GigaChat API через официальную библиотеку
    """
    
    def __init__(self):
        """Инициализация клиента GigaChat"""
        self.credentials = os.getenv('GIGACHAT_AUTH_KEY')
        self.scope = os.getenv('GIGACHAT_SCOPE', 'GIGACHAT_API_PERS')
        
        if not self.credentials:
            raise ValueError("GIGACHAT_AUTH_KEY environment variable is required")
        
        # Создаём клиент с отключением проверки SSL (для работы с российскими сертификатами)
        self.client = GigaChat(
            credentials=self.credentials,
            scope=self.scope,
            verify_ssl_certs=False  # Отключаем проверку SSL
        )
        
        print(f"✅ GigaChat client initialized (scope: {self.scope})")
    
    def generate_answer_from_article(self, question: str, article_content: str, 
                                     article_title: str, max_tokens: int = 512) -> dict:
        """
        Генерирует ответ на вопрос на основе статьи из базы знаний
        
        Args:
            question: Вопрос пользователя
            article_content: Содержимое статьи
            article_title: Название статьи
            max_tokens: Максимальное количество токенов в ответе
            
        Returns:
            dict: {
                'success': bool,
                'answer': str,
                'confidence': float,
                'tokens_used': int,
                'error': str (если success=False)
            }
        """
        try:
            # Формируем промпт
            system_prompt = """Ты — специализированный помощник оператора службы поддержки в сфере ЖКХ и муниципальных услуг.
Твоя задача — составить профессиональный, но понятный ответ гражданину на основе информации из базы знаний.

⚠️ ВАЖНО: НЕ генерируй ответы на следующие типы сообщений:
- Простые приветствия: "Здравствуйте", "Привет", "Добрый день"
- Благодарности: "Спасибо", "Благодарю", "Понял, спасибо"
- Прощания: "До свидания", "Всего доброго", "Пока"
- Короткие подтверждения: "Хорошо", "Ок", "Понятно", "Понял"

Для таких сообщений верни ТОЛЬКО текст: "SKIP_SIMPLE_MESSAGE"

📋 Правила составления ответа для реальных вопросов:
1. Используй ТОЛЬКО информацию из предоставленной статьи базы знаний
2. Структура ответа (если применимо):
   - Краткое объяснение проблемы/ситуации
   - Конкретные действия или рекомендации
   - Контакты/сроки/дополнительная информация (если есть в статье)
3. Стиль:
   - Вежливый и профессиональный тон
   - Ясные, конкретные формулировки
   - Избегай канцеляризмов и сложных терминов
   - 2-5 предложений (не более)
4. Если в статье нет точного ответа — честно скажи об этом и предложи альтернативу

Примеры хороших ответов:
❌ Плохо: "Согласно регламенту, Вам необходимо обратиться в соответствующие инстанции"
✅ Хорошо: "Для замены счётчика обратитесь в диспетчерскую по телефону 123-45-67. Мастер приедет в течение 3 рабочих дней."

❌ Плохо: "Ваше обращение принято к сведению"
✅ Хорошо: "Отопление отключено из-за планового ремонта до 15 октября. Приносим извинения за неудобства."
"""

            user_prompt = f"""Статья из базы знаний: "{article_title}"

Содержание статьи:
{article_content[:3000]}

Вопрос гражданина: {question}

Составь краткий, понятный ответ для оператора (2-5 предложений), который он может отправить гражданину. Используй только информацию из статьи выше."""

            # Создаём payload для чата
            payload = Chat(
                messages=[
                    Messages(
                        role=MessagesRole.SYSTEM,
                        content=system_prompt
                    ),
                    Messages(
                        role=MessagesRole.USER,
                        content=user_prompt
                    )
                ],
                temperature=0.7,
                max_tokens=max_tokens
            )
            
            # Отправляем запрос с retry при 429
            max_retries = 3
            retry_delay = 2  # секунды
            
            for attempt in range(max_retries):
                try:
                    response = self.client.chat(payload)
                    break  # Успех - выходим из цикла
                except Exception as e:
                    error_str = str(e)
                    if '429' in error_str and attempt < max_retries - 1:
                        print(f"⚠️ Rate limit hit, retrying in {retry_delay}s (attempt {attempt + 1}/{max_retries})")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        continue
                    else:
                        raise  # Пробрасываем ошибку дальше
            
            # Извлекаем ответ
            if response.choices and len(response.choices) > 0:
                answer = response.choices[0].message.content
                tokens_used = response.usage.total_tokens if hasattr(response, 'usage') else 0
                
                # Очищаем ответ от лишних пробелов и переносов
                answer = self._clean_response(answer)
                
                return {
                    'success': True,
                    'answer': answer,
                    'confidence': 0.9,  # Высокая уверенность при успешном ответе
                    'tokens_used': tokens_used
                }
            else:
                return {
                    'success': False,
                    'error': 'No response from GigaChat',
                    'answer': '',
                    'confidence': 0.0
                }
                
        except Exception as e:
            error_msg = str(e)
            print(f"❌ GigaChat error: {error_msg}")
            
            return {
                'success': False,
                'error': f'GigaChat API error: {error_msg}',
                'answer': '',
                'confidence': 0.0
            }
    
    def analyze_text(self, text: str, task: str = 'sentiment') -> dict:
        """
        Анализирует текст (тональность, приоритет и т.д.)
        
        Args:
            text: Текст для анализа
            task: Тип анализа ('sentiment', 'priority', 'category')
            
        Returns:
            dict: результаты анализа
        """
        try:
            if task == 'sentiment':
                prompt = f"""Ты — специализированный ИИ-агент, который анализирует текстовые обращения граждан на русском языке.
Твоя задача — точно определить **тональность** сообщения по трём категориям:
- **positive** — если обращение выражает благодарность, одобрение, похвалу, радость или удовлетворение;
- **neutral** — если обращение нейтральное, содержит вопрос, уточнение, описание без эмоциональной окраски;
- **negative** — если обращение выражает недовольство, жалобу, раздражение, агрессию, тревогу или разочарование.

Примеры:
- "Спасибо вашей службе за быструю реакцию!" → positive
- "Когда планируется ремонт дороги?" → neutral
- "Я уже третий день без воды!" → negative

Текст обращения: {text}

Ответь одним словом: positive, neutral или negative"""
                
            elif task == 'priority':
                prompt = f"""Ты — специализированный ИИ-агент, который анализирует текстовые обращения граждан на русском языке и определяет **приоритет обработки**.
Оценивай срочность и потенциальную серьёзность проблемы по смыслу обращения.

Критерии классификации:
- **low** — вопрос общего характера, не требует вмешательства или решения; справочная информация, благодарность.
- **medium** — есть запрос или жалоба, но без угрозы здоровью, имуществу или базовым условиям жизни.
- **high** — серьёзная проблема, создающая значительные неудобства (например, нет отопления, воды, света, уборки территории).
- **critical** — ситуация, представляющая угрозу жизни, здоровью, безопасности людей или имуществу (авария, пожар, затопление, угроза обрушения, замыкание, утечка газа и т.п.).

Если сомневаешься между двумя уровнями — выбирай более высокий.

Примеры:
- "Спасибо за ремонт детской площадки!" → low
- "Когда починят освещение во дворе?" → medium
- "Уже третий день нет отопления в доме, дети мёрзнут!" → high
- "Произошёл прорыв трубы, вся квартира затоплена!" → critical
- "Где можно посмотреть график вывоза мусора?" → low
- "Во дворе повалено дерево, оно висит на проводах!" → critical
- "Не работает лифт уже неделю, просьба починить." → high

Текст обращения: {text}

Ответь одним словом: low, medium, high или critical"""
                
            else:
                return {'success': False, 'error': f'Unknown task: {task}'}
            
            payload = Chat(
                messages=[Messages(role=MessagesRole.USER, content=prompt)],
                temperature=0.3,  # Низкая температура для точности
                max_tokens=50
            )
            
            response = self.client.chat(payload)
            
            if response.choices and len(response.choices) > 0:
                result = response.choices[0].message.content.strip().lower()
                
                return {
                    'success': True,
                    'result': result,
                    'confidence': 0.85
                }
            else:
                return {
                    'success': False,
                    'error': 'No response from GigaChat'
                }
                
        except Exception as e:
            print(f"❌ GigaChat analysis error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _clean_response(self, text: str) -> str:
        """
        Очищает ответ от лишних пробелов и форматирования
        
        Args:
            text: Исходный текст
            
        Returns:
            str: Очищенный текст
        """
        # Убираем множественные пробелы
        text = ' '.join(text.split())
        
        # Убираем лишние переносы строк (оставляем только одинарные)
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        text = ' '.join(lines)
        
        return text.strip()


def get_gigachat_client():
    """
    Возвращает singleton instance клиента GigaChat
    """
    if not hasattr(get_gigachat_client, '_instance'):
        get_gigachat_client._instance = GigaChatClient()
    return get_gigachat_client._instance
