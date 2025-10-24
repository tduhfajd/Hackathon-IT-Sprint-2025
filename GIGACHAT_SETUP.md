# 🤖 Настройка GigaChat API

## Получение ключей доступа

1. Зарегистрируйтесь на [GigaChat](https://developers.sber.ru/gigachat)
2. Создайте приложение в личном кабинете
3. Получите:
   - `Client ID` (UUID формат)
   - `Client Secret` (UUID формат)

## Настройка конфигурации

1. Скопируйте файл-шаблон:
   ```bash
   cp gigachat-config.example.json gigachat-config.json
   ```

2. Откройте `gigachat-config.json` и замените:
   - `YOUR_CLIENT_ID_HERE` → ваш Client ID
   - `YOUR_BASE64_ENCODED_AUTH_KEY_HERE` → ваш закодированный ключ

## Генерация authKey

`authKey` - это base64-encoded строка в формате `{clientId}:{clientSecret}`.

### Вариант 1: Node.js
```javascript
const clientId = 'ваш-client-id';
const clientSecret = 'ваш-client-secret';
const authKey = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
console.log(authKey);
```

### Вариант 2: Bash
```bash
echo -n "client-id:client-secret" | base64
```

### Вариант 3: Python
```python
import base64
client_id = "ваш-client-id"
client_secret = "ваш-client-secret"
auth_key = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
print(auth_key)
```

## Проверка настройки

После создания `gigachat-config.json` проверьте подключение:

```bash
cd backend
npm run test:gigachat
```

## ⚠️ Безопасность

- ❌ **НЕ коммитьте** файл `gigachat-config.json` в git
- ❌ **НЕ публикуйте** ключи в публичных репозиториях
- ✅ Используйте только `gigachat-config.example.json` как шаблон
- ✅ Реальные ключи храните локально или в переменных окружения

## Переменные окружения (альтернатива)

Вместо файла конфигурации можно использовать env переменные:

```bash
export GIGACHAT_CLIENT_ID="ваш-client-id"
export GIGACHAT_CLIENT_SECRET="ваш-client-secret"
export GIGACHAT_SCOPE="GIGACHAT_API_PERS"
```

## Дополнительная информация

- [Документация GigaChat API](https://developers.sber.ru/docs/ru/gigachat/api/overview)
- [Получение токена доступа](https://developers.sber.ru/docs/ru/gigachat/api/authorization)
- [Примеры использования](https://developers.sber.ru/docs/ru/gigachat/examples)

