#!/usr/bin/env python3
"""
Скрипт для обновления URL в frontend файлах с прямого обращения к CRM backend
на обращение через API Gateway
"""

import os
import re
import glob

def update_urls_in_file(file_path):
    """Обновляет URL в файле"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Заменяем все occurrence of localhost:8000 на localhost:3001
        updated_content = content.replace('http://localhost:8000', 'http://localhost:3001')
        
        # Если изменения были сделаны
        if content != updated_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            print(f"✅ Updated: {file_path}")
            return True
        else:
            print(f"📝 No changes needed: {file_path}")
            return False
            
    except Exception as e:
        print(f"❌ Error updating {file_path}: {e}")
        return False

def main():
    """Основная функция"""
    frontend_dir = "frontend/src"
    
    if not os.path.exists(frontend_dir):
        print(f"❌ Directory {frontend_dir} not found!")
        return
    
    # Находим все .tsx и .ts файлы
    patterns = [
        f"{frontend_dir}/**/*.tsx",
        f"{frontend_dir}/**/*.ts"
    ]
    
    files_updated = 0
    total_files = 0
    
    print("🔄 Updating frontend API URLs from localhost:8000 to localhost:3001...")
    print("-" * 60)
    
    for pattern in patterns:
        for file_path in glob.glob(pattern, recursive=True):
            total_files += 1
            if update_urls_in_file(file_path):
                files_updated += 1
    
    print("-" * 60)
    print(f"✅ Summary: Updated {files_updated} out of {total_files} files")
    print("🎯 Frontend is now configured to use API Gateway at localhost:3001")

if __name__ == "__main__":
    main()