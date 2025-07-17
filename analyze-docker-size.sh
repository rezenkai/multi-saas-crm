#!/bin/bash

echo "🐳 АНАЛИЗ РАЗМЕРОВ DOCKER"
echo "=========================="

echo ""
echo "📊 Размеры образов:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -20

echo ""
echo "📦 Размеры контейнеров:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Size}}" | head -20

echo ""
echo "💾 Использование диска:"
docker system df

echo ""
echo "📈 Детальная статистика:"
docker system df -v

echo ""
echo "🧮 РАСЧЕТ ПАМЯТИ ДЛЯ CRM ПРОЕКТА:"
echo "=================================="

echo ""
echo "📋 Размеры образов (приблизительно):"
echo "• postgres:15-alpine     ~ 200MB"
echo "• redis:7-alpine         ~ 30MB"
echo "• python:3.11-slim       ~ 120MB"
echo "• node:18-alpine         ~ 180MB"
echo "• elasticsearch:8.11.0   ~ 800MB"
echo "• kafka:7.4.0            ~ 400MB"
echo "• zookeeper:7.4.0        ~ 200MB"
echo "• prometheus:latest      ~ 150MB"
echo "• grafana:latest         ~ 200MB"

echo ""
echo "💡 ОПТИМИЗИРОВАННАЯ ВЕРСИЯ (dev):"
echo "• postgres:15-alpine     ~ 200MB"
echo "• redis:7-alpine         ~ 30MB"
echo "• python:3.11-slim       ~ 120MB"
echo "• node:18-alpine         ~ 180MB"
echo "• ИТОГО: ~ 530MB образов"

echo ""
echo "🚀 ПАМЯТЬ В РАБОТЕ:"
echo "• PostgreSQL: 256MB (лимит)"
echo "• Redis: 128MB (лимит)"
echo "• Backend: 512MB (лимит)"
echo "• Frontend: 1GB (лимит)"
echo "• ИТОГО: ~ 2GB в работе"

echo ""
echo "⚡ РЕКОМЕНДАЦИИ:"
echo "1. Используйте docker-compose.dev.yml для разработки"
echo "2. Отключите Elasticsearch, Kafka, Prometheus, Grafana"
echo "3. Используйте SQLite вместо PostgreSQL для MVP"
echo "4. Запускайте только backend для тестирования API" 