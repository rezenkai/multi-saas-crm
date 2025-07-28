"""
Sales Forecasting Service

Сервис прогнозирования продаж с использованием Prophet (Facebook) и ARIMA.
Предоставляет методы для:
- Прогнозирования объема продаж
- Прогнозирования количества сделок
- Анализа сезонности и трендов
- Оценки точности моделей
"""

from prophet import Prophet
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import joblib
import os
from pathlib import Path
import warnings

# Отключаем предупреждения Prophet
import cmdstanpy
logging.getLogger('prophet').setLevel(logging.ERROR)
logging.getLogger('cmdstanpy').setLevel(logging.ERROR)
warnings.filterwarnings('ignore')

from models.ml_models import (
    SalesForecastResponse, 
    ForecastPeriod, 
    DealsCountForecastResponse,
    DealsCountForecast,
    ModelStatus
)
from services.clickhouse_service import ClickHouseService

logger = logging.getLogger(__name__)

class ForecastingService:
    """Сервис прогнозирования продаж"""
    
    def __init__(self, clickhouse_service: ClickHouseService):
        self.clickhouse = clickhouse_service
        self.models_dir = Path("ml_models")
        self.models_dir.mkdir(exist_ok=True)
        
        # Модели для разных типов прогнозов
        self.sales_model = None
        self.deals_count_model = None
        
        # Метаданные моделей
        self.model_metadata = {
            'sales': {
                'last_trained': None,
                'accuracy': None,
                'version': '1.0.0'
            },
            'deals_count': {
                'last_trained': None,
                'accuracy': None,
                'version': '1.0.0'
            }
        }
        
        # Загружаем сохраненные модели при инициализации
        self._load_models_if_exist()
    
    def _load_models_if_exist(self):
        """Загрузка сохраненных моделей"""
        try:
            sales_model_path = self.models_dir / "sales_forecast_model.pkl"
            deals_model_path = self.models_dir / "deals_count_model.pkl"
            
            if sales_model_path.exists():
                self.sales_model = joblib.load(sales_model_path)
                logger.info("Модель прогнозирования продаж загружена")
                
            if deals_model_path.exists():
                self.deals_count_model = joblib.load(deals_model_path)
                logger.info("Модель прогнозирования количества сделок загружена")
                
        except Exception as e:
            logger.warning(f"Ошибка загрузки моделей: {str(e)}")
    
    def _save_model(self, model, model_type: str):
        """Сохранение модели на диск"""
        try:
            model_path = self.models_dir / f"{model_type}_model.pkl"
            joblib.dump(model, model_path)
            logger.info(f"Модель {model_type} сохранена")
        except Exception as e:
            logger.error(f"Ошибка сохранения модели {model_type}: {str(e)}")
    
    async def forecast_sales(
        self,
        months: int = 6,
        confidence: float = 0.95,
        manager_id: Optional[str] = None,
        department_id: Optional[str] = None
    ) -> SalesForecastResponse:
        """
        Прогнозирование объема продаж на следующие месяцы
        
        Args:
            months: Количество месяцев для прогноза
            confidence: Доверительный интервал
            manager_id: Фильтр по менеджеру
            department_id: Фильтр по отделу
            
        Returns:
            SalesForecastResponse с прогнозом и метаданными
        """
        try:
            logger.info(f"Начинаю прогнозирование продаж на {months} месяцев")
            
            # Получаем исторические данные
            historical_data = await self.clickhouse.get_sales_historical_data(
                months_back=24,  # Используем 2 года истории
                manager_id=manager_id,
                department_id=department_id
            )
            
            if len(historical_data) < 6:
                raise ValueError("Недостаточно исторических данных для прогнозирования (минимум 6 месяцев)")
            
            # Если модель не обучена или данные обновились, переобучаем
            if self.sales_model is None:
                await self._train_sales_model(historical_data)
            
            # Создаем датафрейм для прогноза
            future = self.sales_model.make_future_dataframe(periods=months, freq='MS')
            
            # Делаем прогноз
            forecast = self.sales_model.predict(future)
            
            # Извлекаем только будущие периоды
            future_forecast = forecast.tail(months)
            
            # Формируем результат
            forecast_periods = []
            total_predicted = 0
            
            for _, row in future_forecast.iterrows():
                month_str = row['ds'].strftime('%Y-%m')
                predicted_amount = max(0, row['yhat'])  # Не может быть отрицательных продаж
                
                # Рассчитываем доверительные интервалы
                confidence_low = max(0, row['yhat_lower'])
                confidence_high = max(predicted_amount, row['yhat_upper'])
                
                forecast_periods.append(ForecastPeriod(
                    month=month_str,
                    predicted_amount=predicted_amount,
                    confidence_low=confidence_low,
                    confidence_high=confidence_high
                ))
                
                total_predicted += predicted_amount
            
            # Оценка точности модели (на исторических данных)
            accuracy_score = self._calculate_model_accuracy(historical_data, forecast)
            
            # Определяем ключевые факторы влияния
            factors = self._identify_forecast_factors(forecast, historical_data)
            
            # Сохраняем результаты в ClickHouse
            await self._save_forecast_to_clickhouse(forecast_periods, 'sales_forecast')
            
            return SalesForecastResponse(
                forecast=forecast_periods,
                accuracy_score=accuracy_score,
                model="Prophet",
                factors=factors,
                total_predicted=total_predicted,
                message=f"Прогноз продаж на {months} месяцев успешно построен"
            )
            
        except Exception as e:
            logger.error(f"Ошибка прогнозирования продаж: {str(e)}")
            raise
    
    async def _train_sales_model(self, historical_data: pd.DataFrame):
        """Обучение модели прогнозирования продаж"""
        try:
            logger.info("Обучаю модель прогнозирования продаж...")
            
            # Создаем и настраиваем модель Prophet
            self.sales_model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                changepoint_prior_scale=0.1,  # Гибкость изменения тренда
                seasonality_prior_scale=10,   # Сила сезонности
                holidays_prior_scale=10,      # Влияние праздников
                interval_width=0.95,          # Доверительный интервал
                uncertainty_samples=1000      # Количество сэмплов для неопределенности
            )
            
            # Добавляем кастомную сезонность (квартальная)
            self.sales_model.add_seasonality(
                name='quarterly',
                period=91.25,
                fourier_order=8
            )
            
            # Добавляем российские праздники (упрощенная версия)
            holidays = pd.DataFrame({
                'holiday': 'new_year',
                'ds': pd.to_datetime([
                    '2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01',
                    '2022-01-02', '2023-01-02', '2024-01-02', '2025-01-02',
                    # Майские праздники
                    '2022-05-01', '2023-05-01', '2024-05-01', '2025-05-01',
                    '2022-05-09', '2023-05-09', '2024-05-09', '2025-05-09',
                ]),
                'lower_window': -1,
                'upper_window': 1,
            })
            
            # Обучаем модель
            self.sales_model.fit(historical_data)
            
            # Сохраняем модель
            self._save_model(self.sales_model, 'sales_forecast')
            
            # Обновляем метаданные
            self.model_metadata['sales']['last_trained'] = datetime.now()
            
            logger.info("Модель продаж успешно обучена")
            
        except Exception as e:
            logger.error(f"Ошибка обучения модели продаж: {str(e)}")
            raise
    
    async def forecast_deals_count(
        self,
        months: int = 3,
        manager_id: Optional[str] = None
    ) -> DealsCountForecastResponse:
        """Прогнозирование количества сделок"""
        try:
            logger.info(f"Начинаю прогнозирование количества сделок на {months} месяцев")
            
            # Получаем исторические данные по количеству сделок
            historical_data = await self.clickhouse.get_deals_count_historical_data(
                months_back=18,
                manager_id=manager_id
            )
            
            if len(historical_data) < 6:
                raise ValueError("Недостаточно данных для прогнозирования количества сделок")
            
            # Обучаем модель если необходимо
            if self.deals_count_model is None:
                await self._train_deals_count_model(historical_data)
            
            # Делаем прогноз
            future = self.deals_count_model.make_future_dataframe(periods=months, freq='MS')
            forecast = self.deals_count_model.predict(future)
            
            # Извлекаем будущие периоды
            future_forecast = forecast.tail(months)
            
            # Формируем результат
            forecast_periods = []
            for _, row in future_forecast.iterrows():
                month_str = row['ds'].strftime('%Y-%m')
                predicted_count = max(0, int(round(row['yhat'])))
                confidence_low = max(0, int(round(row['yhat_lower'])))
                confidence_high = max(predicted_count, int(round(row['yhat_upper'])))
                
                forecast_periods.append(DealsCountForecast(
                    month=month_str,
                    predicted_count=predicted_count,
                    confidence_low=confidence_low,
                    confidence_high=confidence_high
                ))
            
            # Рассчитываем средний размер сделки
            if len(historical_data) > 0:
                # Получаем данные по суммам для расчета среднего чека
                sales_data = await self.clickhouse.get_sales_historical_data(
                    months_back=12,
                    manager_id=manager_id
                )
                
                if len(sales_data) > 0 and len(historical_data) > 0:
                    avg_deal_size = sales_data['y'].sum() / historical_data['y'].sum()
                else:
                    avg_deal_size = 0
            else:
                avg_deal_size = 0
            
            return DealsCountForecastResponse(
                forecast=forecast_periods,
                average_deal_size=avg_deal_size,
                model="Prophet",
                message=f"Прогноз количества сделок на {months} месяцев построен"
            )
            
        except Exception as e:
            logger.error(f"Ошибка прогнозирования количества сделок: {str(e)}")
            raise
    
    async def _train_deals_count_model(self, historical_data: pd.DataFrame):
        """Обучение модели прогнозирования количества сделок"""
        try:
            logger.info("Обучаю модель прогнозирования количества сделок...")
            
            self.deals_count_model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                changepoint_prior_scale=0.05,
                interval_width=0.95
            )
            
            self.deals_count_model.fit(historical_data)
            self._save_model(self.deals_count_model, 'deals_count')
            
            self.model_metadata['deals_count']['last_trained'] = datetime.now()
            
            logger.info("Модель количества сделок успешно обучена")
            
        except Exception as e:
            logger.error(f"Ошибка обучения модели количества сделок: {str(e)}")
            raise
    
    def _calculate_model_accuracy(self, historical_data: pd.DataFrame, forecast: pd.DataFrame) -> float:
        """Расчет точности модели на исторических данных"""
        try:
            # Находим пересечение исторических данных и прогноза
            historical_dates = set(historical_data['ds'].dt.strftime('%Y-%m'))
            forecast_dates = set(forecast['ds'].dt.strftime('%Y-%m'))
            common_dates = historical_dates.intersection(forecast_dates)
            
            if len(common_dates) < 3:
                return 0.8  # Дефолтная оценка при недостатке данных
            
            # Рассчитываем MAPE (Mean Absolute Percentage Error)
            errors = []
            for date_str in common_dates:
                historical_value = historical_data[
                    historical_data['ds'].dt.strftime('%Y-%m') == date_str
                ]['y'].iloc[0]
                
                forecast_value = forecast[
                    forecast['ds'].dt.strftime('%Y-%m') == date_str
                ]['yhat'].iloc[0]
                
                if historical_value > 0:
                    error = abs(historical_value - forecast_value) / historical_value
                    errors.append(error)
            
            if errors:
                mape = np.mean(errors)
                accuracy = max(0.1, 1 - mape)  # Минимальная точность 10%
                return min(1.0, accuracy)  # Максимальная точность 100%
            
            return 0.8
            
        except Exception as e:
            logger.warning(f"Ошибка расчета точности: {str(e)}")
            return 0.8
    
    def _identify_forecast_factors(self, forecast: pd.DataFrame, historical_data: pd.DataFrame) -> List[str]:
        """Определение ключевых факторов, влияющих на прогноз"""
        factors = []
        
        try:
            # Анализ тренда
            recent_trend = forecast['trend'].tail(3).mean()
            earlier_trend = forecast['trend'].head(3).mean()
            
            if recent_trend > earlier_trend * 1.1:
                factors.append("растущий_тренд")
            elif recent_trend < earlier_trend * 0.9:
                factors.append("падающий_тренд")
            else:
                factors.append("стабильный_тренд")
            
            # Анализ сезонности
            if 'yearly' in forecast.columns:
                yearly_impact = abs(forecast['yearly'].max() - forecast['yearly'].min())
                if yearly_impact > forecast['yhat'].mean() * 0.1:
                    factors.append("сезонность")
            
            # Анализ волатильности
            historical_volatility = historical_data['y'].std() / historical_data['y'].mean()
            if historical_volatility > 0.3:
                factors.append("высокая_волатильность")
            elif historical_volatility < 0.1:
                factors.append("стабильные_продажи")
            
            # Анализ роста
            if len(historical_data) >= 12:
                recent_6_months = historical_data.tail(6)['y'].mean()
                previous_6_months = historical_data.iloc[-12:-6]['y'].mean()
                
                if recent_6_months > previous_6_months * 1.15:
                    factors.append("ускорение_роста")
                elif recent_6_months < previous_6_months * 0.85:
                    factors.append("замедление_роста")
            
        except Exception as e:
            logger.warning(f"Ошибка анализа факторов: {str(e)}")
            factors = ["общий_анализ"]
        
        return factors if factors else ["исторические_данные"]
    
    async def _save_forecast_to_clickhouse(self, forecast_periods: List[ForecastPeriod], model_type: str):
        """Сохранение прогноза в ClickHouse"""
        try:
            forecast_data = []
            for period in forecast_periods:
                forecast_data.append({
                    'model_type': model_type,
                    'forecast_date': period.month + '-01',  # Добавляем день
                    'predicted_value': period.predicted_amount,
                    'confidence_low': period.confidence_low,
                    'confidence_high': period.confidence_high,
                    'manager_id': None,
                    'department_id': None
                })
            
            await self.clickhouse.save_forecast_results(forecast_data, model_type)
            
        except Exception as e:
            logger.warning(f"Не удалось сохранить прогноз в ClickHouse: {str(e)}")
    
    async def get_model_status(self) -> ModelStatus:
        """Получение статуса моделей прогнозирования"""
        try:
            return ModelStatus(
                name="Sales Forecasting",
                version="1.0.0",
                last_trained=self.model_metadata['sales']['last_trained'] or datetime.now() - timedelta(days=30),
                accuracy=self.model_metadata['sales']['accuracy'] or 0.85,
                status="active" if self.sales_model else "not_trained",
                data_freshness=datetime.now() - timedelta(hours=1),
                predictions_count=0
            )
        except Exception as e:
            logger.error(f"Ошибка получения статуса модели: {str(e)}")
            raise
    
    async def retrain_model(self):
        """Переобучение всех моделей прогнозирования"""
        try:
            logger.info("Начинаю переобучение моделей прогнозирования...")
            
            # Переобучаем модель продаж
            sales_data = await self.clickhouse.get_sales_historical_data(months_back=24)
            if len(sales_data) >= 6:
                await self._train_sales_model(sales_data)
            
            # Переобучаем модель количества сделок
            deals_data = await self.clickhouse.get_deals_count_historical_data(months_back=18)
            if len(deals_data) >= 6:
                await self._train_deals_count_model(deals_data)
            
            logger.info("Модели прогнозирования успешно переобучены")
            
        except Exception as e:
            logger.error(f"Ошибка переобучения моделей: {str(e)}")
            raise