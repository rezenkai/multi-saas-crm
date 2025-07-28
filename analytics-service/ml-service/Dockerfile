# Multi-stage Dockerfile для ML/AI сервиса
FROM python:3.11-slim as base

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Создаем пользователя для безопасности
RUN groupadd -r mluser && useradd -r -g mluser mluser

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем requirements
COPY requirements.txt .

# Устанавливаем Python зависимости поэтапно с retry
RUN pip install --no-cache-dir --upgrade pip

# Базовые зависимости первыми
RUN pip install --no-cache-dir --retries 5 --timeout 300 \
    fastapi==0.104.1 \
    uvicorn[standard]==0.24.0 \
    pydantic==2.5.2 \
    requests==2.31.0 \
    python-dotenv==1.0.0

# Математические библиотеки
RUN pip install --no-cache-dir --retries 5 --timeout 300 \
    numpy==1.24.4 \
    pandas==2.1.4

# Остальные зависимости
RUN pip install --no-cache-dir --retries 3 --timeout 600 \
    scikit-learn==1.3.2 \
    clickhouse-connect==0.6.23 \
    aiofiles==23.2.1 \
    python-multipart==0.0.6 \
    joblib==1.3.2 \
    matplotlib==3.8.2 \
    seaborn==0.13.0 \
    plotly==5.17.0 \
    httpx==0.25.2

# ML библиотеки (опционально - если не получится, закомментировать)
RUN pip install --no-cache-dir --retries 2 --timeout 900 \
    prophet==1.1.5 \
    openai==1.3.7 \
    transformers==4.36.2 \
    torch==2.1.2 \
    librosa==0.10.1 \
    openai-whisper==20231117 || echo "Warning: некоторые ML библиотеки не установлены"

# Создаем директории для моделей, логов и кэша
RUN mkdir -p /app/ml_models /app/logs /home/mluser/.cache /home/mluser/.config && \
    chown -R mluser:mluser /app /home/mluser

# Production стадия
FROM base as production

# Копируем код приложения
COPY --chown=mluser:mluser . .

# Устанавливаем права
RUN chmod +x /app/main.py

# Переключаемся на непривилегированного пользователя
USER mluser

# Открываем порт
EXPOSE 8007

# Настраиваем переменные окружения
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV TRANSFORMERS_CACHE=/app/ml_models/transformers
ENV MPLCONFIGDIR=/app/ml_models/matplotlib

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8007/health || exit 1

# Запускаем приложение
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8007", "--workers", "1"]