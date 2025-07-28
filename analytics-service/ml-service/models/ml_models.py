"""
Pydantic модели для ML/AI сервиса CRM аналитики

Определяет схемы данных для:
- Запросов к API
- Ответов от API
- Внутренних структур данных
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum

# === БАЗОВЫЕ МОДЕЛИ ===

class BaseResponse(BaseModel):
    """Базовый класс для всех ответов API"""
    success: bool = True
    timestamp: datetime = Field(default_factory=datetime.now)
    message: Optional[str] = None

class ErrorResponse(BaseResponse):
    """Модель для ошибок"""
    success: bool = False
    error_code: str
    error_details: Optional[Dict[str, Any]] = None

# === SALES FORECASTING MODELS ===

class ForecastPeriod(BaseModel):
    """Период прогноза"""
    month: str = Field(..., description="Месяц в формате YYYY-MM")
    predicted_amount: float = Field(..., description="Прогнозируемая сумма")
    confidence_low: float = Field(..., description="Нижняя граница доверительного интервала")
    confidence_high: float = Field(..., description="Верхняя граница доверительного интервала")
    
    @field_validator('month')
    @classmethod
    def validate_month_format(cls, v):
        try:
            datetime.strptime(v, '%Y-%m')
            return v
        except ValueError:
            raise ValueError('Месяц должен быть в формате YYYY-MM')
    
class SalesForecastResponse(BaseResponse):
    """Ответ API для прогноза продаж"""
    forecast: List[ForecastPeriod]
    accuracy_score: float = Field(..., description="Точность модели (0-1)")
    model: str = Field(..., description="Используемая модель (Prophet, ARIMA, etc.)")
    factors: List[str] = Field(..., description="Факторы, влияющие на прогноз")
    total_predicted: float = Field(..., description="Общий прогнозируемый объем")
    
class DealsCountForecast(BaseModel):
    """Прогноз количества сделок"""
    month: str
    predicted_count: int
    confidence_low: int
    confidence_high: int
    
    @field_validator('month')
    @classmethod
    def validate_month_format(cls, v):
        try:
            datetime.strptime(v, '%Y-%m')
            return v
        except ValueError:
            raise ValueError('Месяц должен быть в формате YYYY-MM')

class DealsCountForecastResponse(BaseResponse):
    """Ответ для прогноза количества сделок"""
    forecast: List[DealsCountForecast]
    average_deal_size: float
    model: str

# === ANOMALY DETECTION MODELS ===

class AnomalySeverity(str, Enum):
    """Уровни серьезности аномалий"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AnomalyType(str, Enum):
    """Типы аномалий"""
    SALES = "sales"
    ACTIVITY = "activity"
    LEADS = "leads"
    PERFORMANCE = "performance"

class Anomaly(BaseModel):
    """Обнаруженная аномалия"""
    id: str = Field(..., description="Уникальный ID аномалии")
    type: AnomalyType
    severity: AnomalySeverity
    timestamp: datetime
    description: str = Field(..., description="Описание аномалии")
    affected_entity: str = Field(..., description="Затронутая сущность (менеджер, регион, продукт)")
    actual_value: float
    expected_value: float
    deviation_percentage: float
    confidence: float = Field(..., ge=0, le=1, description="Уверенность в аномалии")
    
class AnomalyDetectionResponse(BaseResponse):
    """Ответ для детекции аномалий"""
    anomalies: List[Anomaly]
    total_count: int
    period_analyzed: str
    model_used: str
    next_check: datetime

class AnomalyRule(BaseModel):
    """Правило детекции аномалий"""
    metric: str = Field(..., description="Метрика для отслеживания")
    threshold: float = Field(..., description="Порог срабатывания")
    comparison: str = Field(..., description="Тип сравнения: gt, lt, eq")
    enabled: bool = True

class AnomalyRulesRequest(BaseModel):
    """Запрос на настройку правил аномалий"""
    rules: List[AnomalyRule]
    notification_channels: List[str] = Field(default=["email"], description="Каналы уведомлений")

# === CHURN PREDICTION MODELS ===

class ChurnRisk(str, Enum):
    """Уровни риска оттока"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ChurnFactor(BaseModel):
    """Фактор риска оттока"""
    factor: str
    weight: float = Field(..., ge=0, le=1)
    description: str

class CustomerChurnPrediction(BaseModel):
    """Предсказание оттока клиента"""
    customer_id: str
    customer_name: str
    churn_probability: float = Field(..., ge=0, le=1)
    risk_level: ChurnRisk
    key_factors: List[ChurnFactor]
    last_activity_date: Optional[datetime]
    days_since_last_purchase: int
    total_value: float
    predicted_churn_date: Optional[datetime]

class ChurnPredictionResponse(BaseResponse):
    """Ответ для предсказания оттока"""
    prediction: CustomerChurnPrediction
    model_accuracy: float
    recommendation_generated: bool

class ChurnCandidatesResponse(BaseResponse):
    """Список кандидатов на отток"""
    candidates: List[CustomerChurnPrediction]
    total_at_risk: int
    total_value_at_risk: float
    average_churn_probability: float

class RetentionAction(BaseModel):
    """Действие по удержанию клиента"""
    action_type: str = Field(..., description="Тип действия")
    priority: int = Field(..., ge=1, le=5, description="Приоритет 1-5")
    description: str
    expected_impact: float = Field(..., ge=0, le=1, description="Ожидаемый эффект")
    cost_estimate: Optional[float] = None

class RetentionRecommendation(BaseModel):
    """Рекомендация по удержанию"""
    customer_id: str
    actions: List[RetentionAction]
    estimated_retention_probability: float
    roi_estimate: Optional[float] = None

class RetentionRequest(BaseModel):
    """Запрос рекомендаций по удержанию"""
    customer_ids: List[str]
    budget_limit: Optional[float] = None
    priority_segments: Optional[List[str]] = None

class RetentionResponse(BaseResponse):
    """Ответ с рекомендациями по удержанию"""
    recommendations: List[RetentionRecommendation]
    total_customers: int
    total_estimated_cost: float
    expected_retention_rate: float

# === REVENUE INTELLIGENCE MODELS ===

class SentimentScore(BaseModel):
    """Оценка настроения"""
    overall: str = Field(..., description="Общее настроение: positive, negative, neutral")
    client: str = Field(..., description="Настроение клиента")
    manager: str = Field(..., description="Настроение менеджера")
    confidence: float = Field(..., ge=0, le=1)

class CallAnalysisRequest(BaseModel):
    """Запрос на анализ звонка"""
    audio_url: str = Field(..., description="URL аудио файла")
    participants: List[str] = Field(..., description="Участники звонка")
    call_duration: int = Field(..., description="Длительность в секундах")
    call_type: str = Field(default="demo", description="Тип звонка")
    deal_id: Optional[str] = None

class CallAnalysisResponse(BaseResponse):
    """Результат анализа звонка"""
    transcript: str = Field(..., description="Полная транскрипция")
    sentiment: SentimentScore
    key_phrases: List[str] = Field(..., description="Ключевые фразы и темы")
    recommendations: List[str] = Field(..., description="Рекомендации по продажам")
    next_best_action: str = Field(..., description="Рекомендуемое следующее действие")
    deal_probability: float = Field(..., ge=0, le=1, description="Вероятность закрытия сделки")
    talk_time_ratio: Dict[str, float] = Field(..., description="Соотношение времени говорения")
    action_items: List[str] = Field(default=[], description="Задачи и договоренности")

class TextAnalysisRequest(BaseModel):
    """Запрос на анализ текста"""
    text: str = Field(..., min_length=10, description="Текст для анализа")
    context: str = Field(default="email", description="Контекст: email, chat, note")
    customer_id: Optional[str] = None
    deal_id: Optional[str] = None

class TextAnalysisResponse(BaseResponse):
    """Результат анализа текста"""
    sentiment: SentimentScore
    key_topics: List[str]
    urgency_level: str = Field(..., description="Уровень срочности: low, medium, high")
    intent: str = Field(..., description="Намерение клиента")
    action_required: bool
    suggested_response: Optional[str] = None

# === MODEL STATUS MODELS ===

class ModelStatus(BaseModel):
    """Статус ML модели"""
    name: str
    version: str
    last_trained: datetime
    accuracy: Optional[float] = None
    status: str = Field(..., description="active, training, error")
    data_freshness: datetime = Field(..., description="Дата последних данных")
    predictions_count: int = Field(default=0, description="Количество предсказаний")

class ModelsStatusResponse(BaseResponse):
    """Статус всех моделей"""  
    models: Dict[str, ModelStatus]
    system_health: str
    last_retrain: Optional[datetime] = None

# === ВАЛИДАТОРЫ ===
# Валидаторы встроены в модели с field_validator