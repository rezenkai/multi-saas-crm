#!/usr/bin/env python3
"""
Скрипт для автоматического исправления проблем с tenant_id в API endpoints
"""

import os
import re

def fix_file(file_path):
    """Исправляет один файл"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. Добавляем импорт get_current_tenant_id если его нет
    if 'get_current_tenant_id' not in content:
        content = content.replace(
            'from ...core.deps import get_current_user',
            'from ...core.deps import get_current_user, get_current_tenant_id'
        )
    
    # 2. Добавляем tenant_id parameter в функции
    # Паттерн для поиска функций с current_user parameter
    pattern = r'(async def \w+\([^)]*current_user: [^=]+ = Depends\(get_current_user\))(\s*\):)'
    matches = re.findall(pattern, content)
    
    for match in matches:
        old_signature = match[0] + match[1]
        new_signature = match[0] + ',\n    tenant_id: str = Depends(get_current_tenant_id)' + match[1]
        content = content.replace(old_signature, new_signature)
    
    # 3. Заменяем все current_user.tenant_id на tenant_id
    content = content.replace('current_user.tenant_id', 'tenant_id')
    
    # 4. Исправляем UUID сериализацию в f-strings и других местах
    content = content.replace('current_user.id', 'str(current_user.id)')
    
    # Сохраняем только если были изменения
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Исправлен файл: {file_path}")
        return True
    
    return False

def main():
    """Основная функция"""
    api_dir = "/mnt/d/CRM project/backend/app/api/v1"
    files_to_fix = [
        "companies.py",
        "contacts.py", 
        "opportunities.py",
        "dashboard.py",
        "users.py"
    ]
    
    fixed_count = 0
    
    for filename in files_to_fix:
        file_path = os.path.join(api_dir, filename)
        if os.path.exists(file_path):
            if fix_file(file_path):
                fixed_count += 1
        else:
            print(f"Файл не найден: {file_path}")
    
    print(f"\nИсправлено файлов: {fixed_count}")

if __name__ == "__main__":
    main()