# Миграция 008: Удаление поля address

**Дата:** 27.10.2025  
**Причина:** Поле `address` не использовалось нигде в системе

## Описание

Поле `address` было добавлено в форму пользователя и сохранялось в БД, но:
- ❌ Не отображалось в интерфейсе оператора
- ❌ Не использовалось в чате
- ❌ Не передавалось в AI для анализа
- ❌ Не было в Telegram боте

## SQL команда

```sql
ALTER TABLE appeals DROP COLUMN IF EXISTS address;
```

## Применение

```bash
docker exec -i smart-support-db psql -U postgres -d smart_support < database/migrations/008_remove_address_field.sql
```

## Изменённые файлы

**Frontend:**
- `frontend/user/src/App.tsx` - удалено поле из формы и интерфейса

**Backend:**
- `backend/src/controllers/AppealController.ts` - удалено из allowedFields для граждан
- `backend/src/validators/appealValidators.ts` - удалена валидация
- `backend/src/config/swagger.ts` - удалено из API документации

**Database:**
- `database/migrations/008_remove_address_field.sql` - миграция для удаления

## Статус

✅ Миграция применена  
✅ Фронтенд обновлён  
✅ Бэкенд обновлён  
✅ API документация обновлена

