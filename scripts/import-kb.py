#!/usr/bin/env python3
import os
import glob
import subprocess
import json

CATEGORY_MAP = {
    'blagooustroystvo.md': {'category': 'Благоустройство', 'tags': ['благоустройство', 'территория']},
    'dvory-i-territorii.md': {'category': 'Благоустройство', 'tags': ['дворы', 'территории', 'благоустройство']},
    'elektrosnabzhenie.md': {'category': 'Электроснабжение', 'tags': ['электричество', 'электроснабжение', 'свет']},
    'mnogokvartirnye-doma.md': {'category': 'ЖКУ', 'tags': ['МКД', 'многоквартирные дома', 'жилищно-коммунальные услуги']},
    'musor.md': {'category': 'Мусор', 'tags': ['мусор', 'отходы', 'ТКО']},
    'parki-kultury-i-otdykha.md': {'category': 'Благоустройство', 'tags': ['парки', 'культура', 'отдых']},
    'plata-za-zhku.md': {'category': 'ЖКУ', 'tags': ['оплата', 'ЖКУ', 'тарифы', 'платежи']},
    'socialnaya-gazifikatsiya.md': {'category': 'ЖКУ', 'tags': ['газификация', 'газ', 'социальная газификация']},
    'teplosnabzhenie.md': {'category': 'Теплоснабжение', 'tags': ['отопление', 'тепло', 'теплоснабжение']},
    'vodosnabzhenie.md': {'category': 'Водоснабжение', 'tags': ['вода', 'водоснабжение', 'водоотведение']},
    'inoe.md': {'category': None, 'tags': ['прочее', 'иное']}
}

def get_category_id(category_name):
    if not category_name:
        return 'NULL'
    
    cmd = f"docker exec smart-support-db psql -U user -d smart_assistant -t -c \"SELECT id FROM categories WHERE name = '{category_name}' LIMIT 1\""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    cat_id = result.stdout.strip()
    return f"'{cat_id}'" if cat_id else 'NULL'

def escape_sql(text):
    return text.replace("'", "''").replace("\\", "\\\\")

def import_article(filepath, filename):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Извлекаем заголовок
        lines = content.split('\n')
        title = filename.replace('.md', '').replace('-', ' ')
        
        for line in lines:
            if line.startswith('# '):
                title = line.replace('# ', '').strip()
                break
        
        # Получаем категорию и теги
        mapping = CATEGORY_MAP.get(filename, {'category': None, 'tags': []})
        category_id = get_category_id(mapping['category'])
        tags_array = '{' + ','.join(f'"{tag}"' for tag in mapping['tags']) + '}'
        
        # Экранируем для SQL
        title_escaped = escape_sql(title)
        content_escaped = escape_sql(content)
        
        # Проверяем существование
        check_cmd = f"docker exec smart-support-db psql -U user -d smart_assistant -t -c \"SELECT COUNT(*) FROM knowledge_base WHERE title = '{title_escaped}'\""
        result = subprocess.run(check_cmd, shell=True, capture_output=True, text=True)
        exists = int(result.stdout.strip()) > 0
        
        if exists:
            # Обновляем
            sql = f"""
            UPDATE knowledge_base 
            SET content = '{content_escaped}', 
                category_id = {category_id}, 
                tags = '{tags_array}', 
                updated_at = NOW()
            WHERE title = '{title_escaped}';
            """
            print(f"✅ Обновляем: {title}")
        else:
            # Создаем
            sql = f"""
            INSERT INTO knowledge_base (title, content, category_id, tags, is_active, created_at, updated_at)
            VALUES ('{title_escaped}', '{content_escaped}', {category_id}, '{tags_array}', true, NOW(), NOW());
            """
            print(f"✅ Создаём: {title}")
        
        cmd = f"docker exec smart-support-db psql -U user -d smart_assistant -c \"{sql}\""
        subprocess.run(cmd, shell=True, capture_output=True)
        
    except Exception as e:
        print(f"❌ Ошибка при импорте {filename}: {e}")

def main():
    print("🚀 Начинаем импорт статей из knowledge_base/manual...\n")
    
    manual_dir = '/home/macadamm/it-support/knowledge_base/manual'
    files = [f for f in os.listdir(manual_dir) if f.endswith('.md') and f != 'test_queries.md']
    
    print(f"📚 Найдено файлов: {len(files)}\n")
    
    for filename in sorted(files):
        filepath = os.path.join(manual_dir, filename)
        import_article(filepath, filename)
    
    # Статистика
    cmd = "docker exec smart-support-db psql -U user -d smart_assistant -t -c 'SELECT COUNT(*) FROM knowledge_base'"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    total = result.stdout.strip()
    
    print(f"\n✨ Импорт завершен! Всего статей в базе: {total}")

if __name__ == '__main__':
    main()

