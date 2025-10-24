"""
GigaChat Client for Celery Workers
Генерация релевантных ответов на основе статей базы знаний
"""
import os
import json
import requests
import base64
from typing import Optional, Dict, Any


class GigaChatClient:
    """
    Клиент для работы с GigaChat API
    Используется для генерации релевантных ответов
    """
    
    def __init__(self):
        # Загружаем конфигурацию
        config_path = os.getenv('GIGACHAT_CONFIG_PATH', '/app/gigachat-config.json')
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                self.config = json.load(f)
        else:
            # Fallback на переменные окружения
            self.config = {
                'clientId': os.getenv('GIGACHAT_CLIENT_ID'),
                'authKey': os.getenv('GIGACHAT_AUTH_KEY'),
                'scope': os.getenv('GIGACHAT_SCOPE', 'GIGACHAT_API_PERS'),
                'authEndpoint': 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
                'apiEndpoint': 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
                'temperature': 0.7,
                'maxTokens': 1024
            }
        
        self.access_token: Optional[str] = None
        self.token_expires_at: int = 0
    
    def _get_access_token(self) -> str:
        """Получает access token для GigaChat API"""
        import time
        
        # Проверяем, не истёк ли токен
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token
        
        # Получаем новый токен
        auth_url = self.config['authEndpoint']
        
        headers = {
            'Authorization': f'Basic {self.config["authKey"]}',
            'RqUID': f'{int(time.time() * 1000)}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data = {
            'scope': self.config['scope']
        }
        
        try:
            response = requests.post(
                auth_url,
                headers=headers,
                data=data,
                verify=False,  # GigaChat использует самоподписанные сертификаты
                timeout=30
            )
            
            # Логируем детали для отладки
            if response.status_code != 200:
                print(f"❌ GigaChat Auth failed: {response.status_code}")
                print(f"   Response: {response.text[:200]}")
            
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data['access_token']
            # Токен действителен 30 минут, но обновим за 5 минут до истечения
            self.token_expires_at = time.time() + (25 * 60)
            
            print(f"✅ GigaChat access token получен")
            
            return self.access_token
            
        except Exception as e:
            print(f"❌ Failed to get GigaChat access token: {e}")
            print(f"   Auth URL: {auth_url}")
            print(f"   Scope: {self.config['scope']}")
            raise
    
    def generate_answer_from_article(
        self,
        question: str,
        article_content: str,
        article_title: str,
        max_tokens: int = 512
    ) -> Dict[str, Any]:
        """
        Генерирует ответ на вопрос на основе статьи из базы знаний
        
        Args:
            question: Вопрос гражданина
            article_content: Содержимое статьи
            article_title: Заголовок статьи
            max_tokens: Максимальная длина ответа
            
        Returns:
            Dict с ключами:
                - success: bool
                - answer: str (если success=True)
                - confidence: float (0.0-1.0)
                - error: str (если success=False)
        """
        try:
            token = self._get_access_token()
            
            # Формируем промпт для GigaChat
            system_prompt = """Ты - опытный специалист службы поддержки ЖКХ. 
Твоя задача - дать краткий, профессиональный и понятный ответ гражданину 
на основе информации из базы знаний.

ВАЖНО:
- Используй ТОЛЬКО информацию из предоставленной статьи
- Ответ должен быть кратким (2-4 предложения)
- Пиши понятным языком, без сложных терминов
- Если в статье нет ответа, так и скажи
- НЕ добавляй приветствия и подписи
- Отвечай по существу вопроса"""

            user_prompt = f"""Статья из базы знаний:

Заголовок: {article_title}

{article_content}

---

Вопрос гражданина: {question}

Дай краткий ответ на основе этой статьи:"""

            # Запрос к GigaChat API
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'model': 'GigaChat',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'temperature': self.config.get('temperature', 0.7),
                'max_tokens': max_tokens,
                'top_p': 0.9
            }
            
            response = requests.post(
                self.config['apiEndpoint'],
                headers=headers,
                json=payload,
                verify=False,
                timeout=60
            )
            response.raise_for_status()
            
            result = response.json()
            
            if 'choices' in result and len(result['choices']) > 0:
                answer = result['choices'][0]['message']['content'].strip()
                
                # Убираем лишние пустые строки
                answer = '\n'.join(line for line in answer.split('\n') if line.strip())
                
                # Вычисляем уверенность на основе длины ответа и finish_reason
                finish_reason = result['choices'][0].get('finish_reason', 'stop')
                confidence = 0.9 if finish_reason == 'stop' else 0.7
                
                # Если ответ очень короткий или содержит "нет информации", снижаем уверенность
                if len(answer) < 50 or 'нет информации' in answer.lower() or 'не найдено' in answer.lower():
                    confidence = 0.5
                
                return {
                    'success': True,
                    'answer': answer,
                    'confidence': confidence,
                    'tokens_used': result.get('usage', {}).get('total_tokens', 0)
                }
            else:
                return {
                    'success': False,
                    'error': 'No response from GigaChat',
                    'confidence': 0.0
                }
                
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'error': 'GigaChat API timeout',
                'confidence': 0.0
            }
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': f'GigaChat API error: {str(e)}',
                'confidence': 0.0
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'confidence': 0.0
            }


# Глобальный экземпляр клиента
_gigachat_client: Optional[GigaChatClient] = None


def get_gigachat_client() -> GigaChatClient:
    """Возвращает singleton экземпляр GigaChatClient"""
    global _gigachat_client
    
    if _gigachat_client is None:
        _gigachat_client = GigaChatClient()
    
    return _gigachat_client

