# Demo Credentials

## Demo User Accounts

Система предустановлена с тестовыми пользователями для демонстрации функционала:

### Оператор
- **Email:** `operator@demo.local`
- **Password:** `operator123`
- **UUID:** `00000000-0000-0000-0000-000000000001`
- **Имя:** Иванова Мария Петровна
- **Роль:** operator

### Администратор
- **Email:** `admin@demo.local`
- **Password:** `admin123`
- **UUID:** `00000000-0000-0000-0000-000000000002`
- **Имя:** Петров Иван Сергеевич
- **Роль:** admin

### Гражданин (для тестов)
- **Email:** `citizen@demo.local`
- **Password:** `citizen123`
- **UUID:** `00000000-0000-0000-0000-000000000003`
- **Имя:** Сидоров Петр Иванович
- **Роль:** citizen

## Использование

### Operator Panel
Используйте учетные данные оператора для входа в панель оператора:
```
https://operator-smartsupport.vadimevgrafov.ru
```

### Admin Panel
Используйте учетные данные администратора для управления базой знаний:
```
https://admin-smartsupport.vadimevgrafov.ru
```

### User Interface
Для подачи обращения регистрация не требуется - система автоматически создает анонимного гражданина:
```
https://user-smartsupport.vadimevgrafov.ru
```

## API Endpoints

### Login
```bash
curl -X POST https://api-smartsupport.vadimevgrafov.ru/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@demo.local","password":"operator123"}'
```

### Create Appeal (as citizen)
```bash
curl -X POST https://api-smartsupport.vadimevgrafov.ru/api/appeals \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Иван Иванов",
    "phone": "+79991234567",
    "subject": "Водоснабжение",
    "description": "Нет горячей воды"
  }'
```

## Пересоздание Demo Users

Если нужно пересоздать demo users:

```bash
docker exec smart-support-backend node /app/seed-demo-users.js
```

Скрипт автоматически пропускает существующих пользователей.

