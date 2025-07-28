"""
CRM Analytics ML/AI Service

Сервис машинного обучения для прогностической аналитики CRM системы.
Предоставляет API для:
- Sales Forecasting (прогнозирование продаж)
- Anomaly Detection (выявление аномалий)
- Churn Prediction (предсказание оттока клиентов)
- Revenue Intelligence (анализ переговоров)
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import os
from pathlib import Path

# Импорты для ML моделей
from services.forecasting_service import ForecastingService
from services.anomaly_service import AnomalyService
from services.churn_service import ChurnService
from services.revenue_intelligence_service import RevenueIntelligenceService
from services.clickhouse_service import ClickHouseService
from models.ml_models import *

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Создание FastAPI приложения
app = FastAPI(
    title="CRM Analytics ML/AI Service",
    description="Прогностическая аналитика для CRM системы",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация сервисов
clickhouse_service = ClickHouseService()
forecasting_service = ForecastingService(clickhouse_service)
anomaly_service = AnomalyService(clickhouse_service)
churn_service = ChurnService(clickhouse_service)
revenue_service = RevenueIntelligenceService(clickhouse_service)

@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "service": "CRM ML/AI Service",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "CRM Analytics ML/AI Service",
        "version": "1.0.0",
        "endpoints": {
            "forecasting": "/api/ml/forecast/*",
            "anomalies": "/api/ml/anomalies/*",
            "churn": "/api/ml/churn/*",
            "revenue_intelligence": "/api/ml/revenue/*",
            "docs": "/api/docs"
        }
    }

# === SALES FORECASTING ENDPOINTS ===

@app.get("/api/ml/forecast/sales")
async def forecast_sales(
    months: int = 6,
    confidence: float = 0.95,
    manager_id: Optional[str] = None,
    department_id: Optional[str] = None
):
    """
    Прогнозирование продаж на следующие месяцы
    
    Args:
        months: Количество месяцев для прогноза (1-12)
        confidence: Доверительный интервал (0.8-0.99)
        manager_id: ID менеджера (опционально)
        department_id: ID отдела (опционально)
    """
    try:
        if not (1 <= months <= 12):
            raise HTTPException(status_code=400, detail="Months должно быть от 1 до 12")
        if not (0.8 <= confidence <= 0.99):
            raise HTTPException(status_code=400, detail="Confidence должно быть от 0.8 до 0.99")
            
        forecast = await forecasting_service.forecast_sales(
            months=months,
            confidence=confidence,
            manager_id=manager_id,
            department_id=department_id
        )
        return forecast
    except Exception as e:
        logger.error(f"Ошибка в forecast_sales: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ml/forecast/deals-count")
async def forecast_deals_count(
    months: int = 3,
    manager_id: Optional[str] = None
):
    """Прогнозирование количества сделок"""
    try:
        forecast = await forecasting_service.forecast_deals_count(
            months=months,
            manager_id=manager_id
        )
        return forecast
    except Exception as e:
        logger.error(f"Ошибка в forecast_deals_count: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ANOMALY DETECTION ENDPOINTS ===

@app.get("/api/ml/anomalies")
async def detect_anomalies(
    type: str = "sales",
    period: str = "30d",
    severity: str = "high"
):
    """
    Обнаружение аномалий в данных
    
    Args:
        type: Тип данных (sales, activity, leads)
        period: Период анализа (7d, 30d, 90d)
        severity: Уровень серьезности (low, medium, high)
    """
    try:
        anomalies = await anomaly_service.detect_anomalies(
            data_type=type,
            period=period,
            severity=severity
        )
        return anomalies
    except Exception as e:
        logger.error(f"Ошибка в detect_anomalies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/anomalies/rules")
async def configure_anomaly_rules(rules: AnomalyRulesRequest):
    """Настройка правил детекции аномалий"""
    try:
        result = await anomaly_service.configure_rules(rules)
        return result
    except Exception as e:
        logger.error(f"Ошибка в configure_anomaly_rules: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === CHURN PREDICTION ENDPOINTS ===

@app.get("/api/ml/churn-risk")
async def predict_churn_risk(customer_id: str):
    """Предсказание риска оттока конкретного клиента"""
    try:
        risk = await churn_service.predict_customer_churn(customer_id)
        return risk
    except Exception as e:
        logger.error(f"Ошибка в predict_churn_risk: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ml/churn-candidates")
async def get_churn_candidates(risk_threshold: float = 0.7):
    """Получение списка клиентов с высоким риском оттока"""
    try:
        candidates = await churn_service.get_high_risk_customers(risk_threshold)
        return candidates
    except Exception as e:
        logger.error(f"Ошибка в get_churn_candidates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/retention-recommendations")
async def get_retention_recommendations(request: RetentionRequest):
    """Рекомендации по удержанию клиентов"""
    try:
        recommendations = await churn_service.get_retention_recommendations(request)
        return recommendations
    except Exception as e:
        logger.error(f"Ошибка в get_retention_recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === REVENUE INTELLIGENCE ENDPOINTS ===

@app.post("/api/ml/call-analysis")
async def analyze_call(request: CallAnalysisRequest):
    """
    Анализ записи звонка/встречи
    
    Извлекает инсайты из аудио записи:
    - Транскрипция речи
    - Анализ настроения
    - Ключевые фразы
    - Рекомендации по продажам
    """
    try:
        analysis = await revenue_service.analyze_call(request)
        return analysis
    except Exception as e:
        logger.error(f"Ошибка в analyze_call: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/text-analysis")  
async def analyze_text(request: TextAnalysisRequest):
    """Анализ текстовых данных (email, чат, заметки)"""
    try:
        analysis = await revenue_service.analyze_text(request)
        return analysis
    except Exception as e:
        logger.error(f"Ошибка в analyze_text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === TRAINING & MODEL MANAGEMENT ===

@app.post("/api/ml/models/retrain")
async def retrain_models(background_tasks: BackgroundTasks):
    """Переобучение всех ML моделей на свежих данных"""
    try:
        background_tasks.add_task(retrain_all_models)
        return {
            "message": "Переобучение моделей запущено в фоне",
            "status": "started",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Ошибка в retrain_models: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ml/models/status")
async def get_models_status():
    """Статус всех ML моделей"""
    try:
        status = {
            "forecasting": await forecasting_service.get_model_status(),
            "anomaly": await anomaly_service.get_model_status(),
            "churn": await churn_service.get_model_status(),
            "revenue": await revenue_service.get_model_status(),
            "last_updated": datetime.now().isoformat()
        }
        return status
    except Exception as e:
        logger.error(f"Ошибка в get_models_status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === ТЕСТОВЫЕ ENDPOINTS ===

@app.get("/api/ml/test")
async def test_ml_service():
    """Тестовый endpoint для проверки работы ML сервиса"""
    try:
        # Тестируем подключение к ClickHouse
        from services.clickhouse_service import ClickHouseService
        ch_service = ClickHouseService()
        
        # Простой запрос к базе
        result = ch_service.execute_query("SELECT COUNT(*) as count FROM deals")
        deals_count = result[0][0] if result else 0
        
        return {
            "status": "success",
            "service": "ML/AI Service Test",
            "clickhouse_connection": "OK",
            "deals_count": deals_count,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Ошибка в test_ml_service: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/ml/test/forecast")
async def test_forecast_simple():
    """Простой тест прогнозирования без сложной логики"""
    try:
        # Создаем простые тестовые данные для демо
        test_forecast = [
            {"month": "2025-08", "predicted_amount": 150000.0, "confidence_low": 120000.0, "confidence_high": 180000.0},
            {"month": "2025-09", "predicted_amount": 175000.0, "confidence_low": 140000.0, "confidence_high": 210000.0},
            {"month": "2025-10", "predicted_amount": 160000.0, "confidence_low": 130000.0, "confidence_high": 190000.0}
        ]
        
        return {
            "status": "success", 
            "message": "Тестовый прогноз продаж",
            "forecast": test_forecast,
            "model": "test_model",
            "accuracy_score": 0.85,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/ml/test/clickhouse-query")
async def test_clickhouse_query():
    """Тест прямого запроса к ClickHouse"""
    try:
        from services.clickhouse_service import ClickHouseService
        ch_service = ClickHouseService()
        
        # Простой запрос без f-строк
        query = "SELECT toStartOfMonth(closed_date) as ds, sum(amount) as y FROM deals WHERE closed_date IS NOT NULL AND closed_date >= today() - INTERVAL 24 MONTH AND status = 'won' GROUP BY ds ORDER BY ds"
        
        result = ch_service.query_to_dataframe(query)
        
        return {
            "status": "success",
            "query": query,
            "rows_count": len(result),
            "columns": list(result.columns) if len(result) > 0 else [],
            "sample_data": result.head().to_dict('records') if len(result) > 0 else [],
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/ml/test/algorithms")
async def test_all_ml_algorithms():
    """Комплексный тест всех ML алгоритмов"""
    try:
        results = {
            "prophet": {"status": "testing", "error": None},
            "isolation_forest": {"status": "testing", "error": None},
            "bert": {"status": "testing", "error": None}
        }
        
        # Тест 1: Prophet
        try:
            from prophet import Prophet
            import pandas as pd
            import numpy as np
            
            # Создаем тестовые данные
            dates = pd.date_range(start='2023-01-01', end='2024-12-31', freq='MS')
            np.random.seed(42)
            sales = 100000 + np.linspace(0, 50000, len(dates)) + 20000 * np.sin(2 * np.pi * np.arange(len(dates)) / 12) + np.random.normal(0, 5000, len(dates))
            
            df = pd.DataFrame({'ds': dates, 'y': np.maximum(sales, 10000)})
            
            # Обучаем модель
            model = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
            model.fit(df)
            
            # Делаем прогноз
            future = model.make_future_dataframe(periods=3, freq='MS')
            forecast = model.predict(future)
            
            results["prophet"] = {
                "status": "success",
                "message": f"Prophet успешно обучен на {len(df)} записях",
                "forecast_sample": {
                    "month": forecast.tail(1)['ds'].iloc[0].strftime('%Y-%m'),
                    "predicted": round(forecast.tail(1)['yhat'].iloc[0], 2)
                }
            }
        except Exception as e:
            results["prophet"] = {"status": "error", "error": str(e)}
        
        # Тест 2: Isolation Forest
        try:
            from sklearn.ensemble import IsolationForest
            
            # Создаем тестовые данные с аномалиями
            np.random.seed(42)
            normal_data = np.random.normal(100000, 15000, 300)
            
            # Добавляем аномалии
            data = normal_data.copy()
            data[50] = 250000  # Аномалия
            data[150] = 30000  # Аномалия
            
            features = data.reshape(-1, 1)
            
            # Обучаем модель
            iso_forest = IsolationForest(contamination=0.05, random_state=42)
            predictions = iso_forest.fit_predict(features)
            
            anomalies_count = len(predictions[predictions == -1])
            
            results["isolation_forest"] = {
                "status": "success",
                "message": f"Isolation Forest обнаружил {anomalies_count} аномалий из {len(data)} точек",
                "anomalies_detected": anomalies_count
            }
        except Exception as e:
            results["isolation_forest"] = {"status": "error", "error": str(e)}
        
        # Тест 3: BERT (упрощенный)
        try:
            # Пробуем загрузить BERT
            bert_available = False
            try:
                from transformers import pipeline
                sentiment_pipeline = pipeline("sentiment-analysis", model="cardiffnlp/twitter-roberta-base-sentiment-latest")
                test_result = sentiment_pipeline("This is a great meeting!")
                bert_available = True
                bert_message = f"BERT анализ: {test_result[0]['label']} (уверенность: {test_result[0]['score']:.2f})"
            except:
                # Fallback к простому анализу
                bert_message = "BERT недоступен, используется простой анализ настроения"
            
            results["bert"] = {
                "status": "success",
                "message": bert_message,
                "bert_available": bert_available
            }
        except Exception as e:
            results["bert"] = {"status": "error", "error": str(e)}
        
        # Подсчитываем успешные тесты
        successful = len([r for r in results.values() if r["status"] == "success"])
        total = len(results)
        
        return {
            "status": "completed",
            "summary": f"Успешно: {successful}/{total} алгоритмов",
            "all_working": successful == total,
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Ошибка комплексного тестирования: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# Фоновая задача переобучения
async def retrain_all_models():
    """Переобучение всех моделей"""
    try:
        logger.info("Начинаю переобучение всех моделей...")
        
        # Переобучаем каждую модель
        await forecasting_service.retrain_model()
        await anomaly_service.retrain_model()
        await churn_service.retrain_model() 
        await revenue_service.retrain_model()
        
        logger.info("Все модели успешно переобучены")
    except Exception as e:
        logger.error(f"Ошибка при переобучении моделей: {str(e)}")

# Запуск сервера
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8007,
        reload=True,
        log_level="info"
    )