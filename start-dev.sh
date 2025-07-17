#!/bin/bash

echo "🚀 ЗАПУСК CRM ПРОЕКТА"
echo "======================"

echo ""
echo "📊 Доступная память:"
TOTAL_MEM=$(sysctl -n hw.memsize | awk '{print $0/1024/1024/1024}')
echo "• Общая память: ${TOTAL_MEM%.*}GB"

FREE_MEM=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
FREE_MEM_GB=$(echo "scale=2; $FREE_MEM * 4096 / 1024 / 1024 / 1024" | bc)
echo "• Свободная память: ${FREE_MEM_GB}GB"

echo ""
echo "🎯 ВЫБЕРИТЕ ВЕРСИЮ:"
echo "1. Минимальная (только backend + SQLite) - ~256MB"
echo "2. Разработка (backend + PostgreSQL + Redis) - ~1GB"
echo "3. Полная (все сервисы) - ~4GB"
echo "4. Локальная разработка (без Docker) - ~100MB"

read -p "Введите номер (1-4): " choice

case $choice in
    1)
        echo "🐳 Запуск минимальной версии..."
        docker-compose -f docker-compose.minimal.yml up -d
        echo "✅ Backend доступен на http://localhost:8000"
        echo "📚 API документация: http://localhost:8000/docs"
        ;;
    2)
        echo "🐳 Запуск версии для разработки..."
        docker-compose -f docker-compose.dev.yml up -d
        echo "✅ Backend доступен на http://localhost:8000"
        echo "✅ Frontend доступен на http://localhost:3000"
        echo "📚 API документация: http://localhost:8000/docs"
        ;;
    3)
        echo "🐳 Запуск полной версии..."
        docker-compose up -d
        echo "✅ Backend доступен на http://localhost:8000"
        echo "✅ Frontend доступен на http://localhost:3000"
        echo "📊 Grafana доступен на http://localhost:3001"
        echo "📈 Prometheus доступен на http://localhost:9090"
        echo "📚 API документация: http://localhost:8000/docs"
        ;;
    4)
        echo "💻 Запуск локальной разработки..."
        echo "Установка зависимостей..."
        cd backend && pip3 install -r requirements.txt
        echo "Запуск backend..."
        cd .. && python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
        ;;
    *)
        echo "❌ Неверный выбор"
        exit 1
        ;;
esac

echo ""
echo "📋 КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ:"
echo "• Остановить: docker-compose down"
echo "• Логи: docker-compose logs -f"
echo "• Статус: docker-compose ps" 