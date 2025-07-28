"""
ClickHouse сервис для ML/AI аналитики

Предоставляет методы для работы с ClickHouse базой данных:
- Получение исторических данных для обучения моделей
- Загрузка данных для предсказаний
- Сохранение результатов ML моделей
"""

import clickhouse_connect
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import os
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

class ClickHouseService:
    """Сервис для работы с ClickHouse"""
    
    def __init__(self):
        self.host = os.getenv('CLICKHOUSE_HOST', 'localhost')
        self.port = int(os.getenv('CLICKHOUSE_PORT', '8123'))  # Исправлен порт на HTTP интерфейс
        self.database = os.getenv('CLICKHOUSE_DATABASE', 'crm_analytics')
        self.user = os.getenv('CLICKHOUSE_USER', 'default')
        self.password = os.getenv('CLICKHOUSE_PASSWORD', '')
        
        self.client = None
        self._connect()
        
    def _connect(self):
        """Подключение к ClickHouse с использованием clickhouse-connect"""
        try:
            # Используем clickhouse-connect (HTTP интерфейс)
            # Он более стабильный и не имеет проблем с lz4
            self.client = clickhouse_connect.get_client(
                host=self.host,
                port=8123,  # HTTP порт для clickhouse-connect
                database=self.database,
                username=self.user,
                password=self.password
            )
            logger.info(f"Подключен к ClickHouse HTTP: {self.host}:8123/{self.database}")
        except Exception as e:
            logger.error(f"Ошибка подключения к ClickHouse: {str(e)}")
            raise
    
    def execute_query(self, query: str, params: Optional[Dict] = None) -> List[Tuple]:
        """Выполнение SQL запроса"""
        try:
            if params:
                # clickhouse-connect использует parameters вместо params
                result = self.client.query(query, parameters=params)
            else:
                result = self.client.query(query)
            # Возвращаем результат в том же формате что и clickhouse-driver
            return result.result_rows
        except Exception as e:
            logger.error(f"Ошибка выполнения запроса: {str(e)}")
            raise
    
    def query_to_dataframe(self, query: str, params: Optional[Dict] = None) -> pd.DataFrame:
        """Выполнение запроса и возврат DataFrame"""
        try:
            logger.info(f"Executing query: {query[:200]}...")
            if params:
                logger.info(f"With parameters: {params}")
                # clickhouse-connect использует parameters вместо params
                df = self.client.query_df(query, parameters=params)
            else:
                df = self.client.query_df(query)
            
            logger.info(f"Query returned {len(df)} rows")
            return df
        except Exception as e:
            logger.error(f"Ошибка выполнения запроса в DataFrame: {str(e)}")
            logger.error(f"Query was: {query}")
            raise
    
    # === МЕТОДЫ ДЛЯ SALES FORECASTING ===
    
    async def get_sales_historical_data(
        self, 
        months_back: int = 24,
        manager_id: Optional[str] = None,
        department_id: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Получение исторических данных продаж для обучения модели прогнозирования
        
        Returns:
            DataFrame с колонками: ds (дата), y (сумма продаж)
        """
        try:
            # Базовый запрос для получения помесячных продаж
            base_query = f"""
            SELECT 
                toStartOfMonth(closed_date) as ds,
                sum(amount) as y
            FROM deals 
            WHERE closed_date IS NOT NULL 
                AND closed_date >= today() - INTERVAL {months_back} MONTH
                AND status = 'won'
            """
            
            conditions = []
            
            if manager_id:
                conditions.append(f"AND manager_id = '{manager_id}'")
                
            if department_id:
                conditions.append(f"AND department_id = '{department_id}'")
            
            query = base_query + " ".join(conditions) + """
            GROUP BY ds 
            ORDER BY ds
            """
            
            df = self.query_to_dataframe(query)
            
            # Преобразуем типы для Prophet
            df['ds'] = pd.to_datetime(df['ds'])
            df['y'] = df['y'].astype(float)
            
            logger.info(f"Получено {len(df)} записей исторических продаж")
            return df
            
        except Exception as e:
            logger.error(f"Ошибка получения исторических данных продаж: {str(e)}")
            raise
    
    async def get_deals_count_historical_data(
        self,
        months_back: int = 18,
        manager_id: Optional[str] = None
    ) -> pd.DataFrame:
        """Получение исторических данных по количеству сделок"""
        try:
            # Исправлен на правильное название поля
            base_query = f"""
            SELECT 
                toStartOfMonth(closed_date) as ds,
                count(*) as y
            FROM deals 
            WHERE closed_date IS NOT NULL 
                AND closed_date >= today() - INTERVAL {months_back} MONTH
                AND status = 'won'
            """
            
            conditions = []
            
            if manager_id:
                conditions.append(f"AND manager_id = '{manager_id}'")
            
            query = base_query + " ".join(conditions) + """
            GROUP BY ds 
            ORDER BY ds
            """
            
            df = self.query_to_dataframe(query)
            df['ds'] = pd.to_datetime(df['ds'])
            df['y'] = df['y'].astype(float)
            
            return df
            
        except Exception as e:
            logger.error(f"Ошибка получения данных количества сделок: {str(e)}")
            raise
    
    # === МЕТОДЫ ДЛЯ ANOMALY DETECTION ===
    
    async def get_sales_data_for_anomaly_detection(
        self, 
        days_back: int = 90
    ) -> pd.DataFrame:
        """Получение данных продаж для детекции аномалий"""
        try:
            query = f"""
            SELECT 
                date(closed_date) as date,
                manager_id,
                department_id,
                count(*) as deals_count,
                sum(amount) as total_amount,
                avg(amount) as avg_amount,
                max(amount) as max_amount
            FROM deals
            WHERE closed_date >= today() - INTERVAL {days_back} DAY
                AND status = 'won'
            GROUP BY date, manager_id, department_id
            ORDER BY date DESC
            """
            
            df = self.query_to_dataframe(query)
            df['date'] = pd.to_datetime(df['date'])
            
            return df
            
        except Exception as e:
            logger.error(f"Ошибка получения данных для детекции аномалий: {str(e)}")
            raise
    
    async def get_activity_data_for_anomaly_detection(
        self, 
        days_back: int = 90
    ) -> pd.DataFrame:
        """Получение данных активности для детекции аномалий"""
        try:
            query = f"""
            SELECT 
                date(activity_date) as date,
                manager_id,
                activity_type,
                count(*) as activity_count
            FROM activities
            WHERE activity_date >= today() - INTERVAL {days_back} DAY
            GROUP BY date, manager_id, activity_type
            ORDER BY date DESC
            """
            
            df = self.query_to_dataframe(query)
            df['date'] = pd.to_datetime(df['date'])
            
            return df
            
        except Exception as e:
            logger.error(f"Ошибка получения данных активности для аномалий: {str(e)}")
            raise
    
    # === МЕТОДЫ ДЛЯ CHURN PREDICTION ===
    
    async def get_customer_features_for_churn(self) -> pd.DataFrame:
        """Получение признаков клиентов для модели оттока"""
        try:
            query = """
            WITH customer_stats AS (
                SELECT 
                    customer_id,
                    count(*) as total_deals,
                    sum(amount) as total_value,
                    avg(amount) as avg_deal_size,
                    max(closed_date) as last_deal_date,
                    min(closed_date) as first_deal_date,
                    count(DISTINCT manager_id) as managers_worked_with
                FROM deals
                WHERE status = 'won'
                GROUP BY customer_id
            ),
            recent_activity AS (
                SELECT 
                    customer_id,
                    count(*) as recent_activities,
                    max(activity_date) as last_activity_date
                FROM activities 
                WHERE activity_date >= today() - INTERVAL 90 DAY
                GROUP BY customer_id
            ),
            support_tickets AS (
                SELECT 
                    customer_id,
                    count(*) as support_tickets_count,
                    avg(satisfaction_score) as avg_satisfaction
                FROM support_tickets
                WHERE created_date >= today() - INTERVAL 180 DAY
                GROUP BY customer_id
            )
            SELECT 
                cs.customer_id,
                cs.total_deals,
                cs.total_value,
                cs.avg_deal_size,
                cs.last_deal_date,
                dateDiff('day', cs.last_deal_date, today()) as days_since_last_deal,
                dateDiff('day', cs.first_deal_date, cs.last_deal_date) as customer_lifetime_days,
                cs.managers_worked_with,
                coalesce(ra.recent_activities, 0) as recent_activities,
                ra.last_activity_date,
                coalesce(st.support_tickets_count, 0) as support_tickets_count,
                coalesce(st.avg_satisfaction, 5.0) as avg_satisfaction
            FROM customer_stats cs
            LEFT JOIN recent_activity ra ON cs.customer_id = ra.customer_id
            LEFT JOIN support_tickets st ON cs.customer_id = st.customer_id
            WHERE cs.total_deals > 0
            """
            
            df = self.query_to_dataframe(query)
            
            # Преобразуем даты
            df['last_deal_date'] = pd.to_datetime(df['last_deal_date'])
            if 'last_activity_date' in df.columns:
                df['last_activity_date'] = pd.to_datetime(df['last_activity_date'])
            
            return df
            
        except Exception as e:
            logger.error(f"Ошибка получения признаков клиентов: {str(e)}")
            raise
    
    async def get_churned_customers_labels(self, days_threshold: int = 180) -> pd.DataFrame:
        """Получение меток для обучения модели оттока"""
        try:
            query = f"""
            SELECT 
                customer_id,
                CASE 
                    WHEN max(closed_date) < today() - INTERVAL {days_threshold} DAY THEN 1
                    ELSE 0
                END as churned
            FROM deals
            WHERE status = 'won'
            GROUP BY customer_id
            """
            
            df = self.query_to_dataframe(query)
            return df
            
        except Exception as e:
            logger.error(f"Ошибка получения меток оттока: {str(e)}")
            raise
    
    # === МЕТОДЫ ДЛЯ СОХРАНЕНИЯ РЕЗУЛЬТАТОВ ===
    
    async def save_forecast_results(
        self, 
        forecast_data: List[Dict[str, Any]], 
        model_type: str
    ):
        """Сохранение результатов прогнозирования"""
        try:
            # Создаем таблицу если не существует
            create_table_query = """
            CREATE TABLE IF NOT EXISTS ml_forecasts (
                id UUID DEFAULT generateUUIDv4(),
                model_type String,
                forecast_date Date,
                predicted_value Float64,
                confidence_low Float64,
                confidence_high Float64,
                manager_id Nullable(String),
                department_id Nullable(String),
                created_at DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            ORDER BY (model_type, forecast_date, created_at)
            """
            
            self.execute_query(create_table_query)
            
            # Вставляем данные
            if forecast_data:
                insert_query = """
                INSERT INTO ml_forecasts 
                (model_type, forecast_date, predicted_value, confidence_low, confidence_high, manager_id, department_id)
                VALUES
                """
                
                self.client.insert('ml_forecasts', forecast_data)
                logger.info(f"Сохранено {len(forecast_data)} записей прогноза")
                
        except Exception as e:
            logger.error(f"Ошибка сохранения прогноза: {str(e)}")
            raise
    
    async def save_anomaly_results(self, anomalies: List[Dict[str, Any]]):
        """Сохранение обнаруженных аномалий"""
        try:
            create_table_query = """
            CREATE TABLE IF NOT EXISTS ml_anomalies (
                id UUID DEFAULT generateUUIDv4(),
                anomaly_type String,
                severity String,
                detection_date DateTime,
                affected_entity String,
                actual_value Float64,
                expected_value Float64,
                deviation_percentage Float64,
                confidence Float64,
                description String,
                created_at DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            ORDER BY (detection_date, severity, created_at)
            """
            
            self.execute_query(create_table_query)
            
            if anomalies:
                self.client.insert('ml_anomalies', anomalies)
                logger.info(f"Сохранено {len(anomalies)} аномалий")
                
        except Exception as e:
            logger.error(f"Ошибка сохранения аномалий: {str(e)}")
            raise
    
    async def save_churn_predictions(self, predictions: List[Dict[str, Any]]):
        """Сохранение предсказаний оттока"""
        try:
            create_table_query = """
            CREATE TABLE IF NOT EXISTS ml_churn_predictions (
                customer_id String,
                churn_probability Float64,
                risk_level String,
                prediction_date DateTime DEFAULT now(),
                model_version String,
                key_factors Array(String)
            ) ENGINE = ReplacingMergeTree()
            ORDER BY (customer_id, prediction_date)
            """
            
            self.execute_query(create_table_query)
            
            if predictions:
                self.client.insert('ml_churn_predictions', predictions)
                logger.info(f"Сохранено {len(predictions)} предсказаний оттока")
                
        except Exception as e:
            logger.error(f"Ошибка сохранения предсказаний оттока: {str(e)}")
            raise
    
    def close(self):
        """Закрытие соединения"""
        if self.client:
            self.client.close()
            logger.info("Соединение с ClickHouse закрыто")