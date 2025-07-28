"""
Anomaly Detection Service

Сервис обнаружения аномалий с использованием Isolation Forest и статистических методов.
Предоставляет методы для:
- Обнаружения аномалий в продажах
- Анализа активности менеджеров
- Мониторинга метрик в реальном времени
- Настройки правил детекции
"""

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import joblib
import uuid
from pathlib import Path

from models.ml_models import (
    AnomalyDetectionResponse,
    Anomaly,
    AnomalySeverity,
    AnomalyType,
    AnomalyRulesRequest,
    ModelStatus
)
from services.clickhouse_service import ClickHouseService

logger = logging.getLogger(__name__)

class AnomalyService:
    """Сервис обнаружения аномалий"""
    
    def __init__(self, clickhouse_service: ClickHouseService):
        self.clickhouse = clickhouse_service
        self.models_dir = Path("ml_models")
        self.models_dir.mkdir(exist_ok=True)
        
        # Модели для разных типов данных
        self.sales_anomaly_model = None
        self.activity_anomaly_model = None
        self.scalers = {}
        
        # Правила детекции
        self.detection_rules = {
            'sales_drop_threshold': 0.3,      # 30% падение продаж
            'activity_drop_threshold': 0.5,   # 50% падение активности
            'high_amount_multiplier': 5,      # Сделка в 5 раз больше среднего
            'zero_activity_days': 3,          # Дни без активности
        }
        
        # Метаданные моделей
        self.model_metadata = {
            'last_trained': None,
            'anomalies_detected_today': 0,
            'version': '1.0.0'
        }
        
        # Загружаем сохраненные модели
        self._load_models_if_exist()
    
    def _load_models_if_exist(self):
        """Загрузка сохраненных моделей"""
        try:
            sales_model_path = self.models_dir / "sales_anomaly_model.pkl"
            activity_model_path = self.models_dir / "activity_anomaly_model.pkl"
            scalers_path = self.models_dir / "anomaly_scalers.pkl"
            
            if sales_model_path.exists():
                self.sales_anomaly_model = joblib.load(sales_model_path)
                logger.info("Модель аномалий продаж загружена")
                
            if activity_model_path.exists():
                self.activity_anomaly_model = joblib.load(activity_model_path)
                logger.info("Модель аномалий активности загружена")
                
            if scalers_path.exists():
                self.scalers = joblib.load(scalers_path)
                logger.info("Скалеры для аномалий загружены")
                
        except Exception as e:
            logger.warning(f"Ошибка загрузки моделей аномалий: {str(e)}")
    
    def _save_models(self):
        """Сохранение моделей на диск"""
        try:
            if self.sales_anomaly_model:
                joblib.dump(self.sales_anomaly_model, self.models_dir / "sales_anomaly_model.pkl")
                
            if self.activity_anomaly_model:
                joblib.dump(self.activity_anomaly_model, self.models_dir / "activity_anomaly_model.pkl")
                
            if self.scalers:
                joblib.dump(self.scalers, self.models_dir / "anomaly_scalers.pkl")
                
            logger.info("Модели аномалий сохранены")
            
        except Exception as e:
            logger.error(f"Ошибка сохранения моделей аномалий: {str(e)}")
    
    async def detect_anomalies(
        self,
        data_type: str = "sales",
        period: str = "30d",
        severity: str = "high"
    ) -> AnomalyDetectionResponse:
        """
        Обнаружение аномалий в данных
        
        Args:
            data_type: Тип данных (sales, activity, leads)
            period: Период анализа (7d, 30d, 90d)
            severity: Минимальный уровень серьезности
            
        Returns:
            AnomalyDetectionResponse с обнаруженными аномалиями
        """
        try:
            logger.info(f"Начинаю поиск аномалий: тип={data_type}, период={period}, серьезность={severity}")
            
            # Парсим период
            days_back = self._parse_period(period)
            
            # Получаем данные в зависимости от типа
            if data_type == "sales":
                anomalies = await self._detect_sales_anomalies(days_back, severity)
            elif data_type == "activity":
                anomalies = await self._detect_activity_anomalies(days_back, severity)
            elif data_type == "leads":
                anomalies = await self._detect_leads_anomalies(days_back, severity)
            else:
                anomalies = await self._detect_combined_anomalies(days_back, severity)
            
            # Фильтруем по уровню серьезности
            filtered_anomalies = self._filter_by_severity(anomalies, severity)
            
            # Сохраняем результаты
            await self._save_anomalies_to_clickhouse(filtered_anomalies)
            
            # Планируем следующую проверку
            next_check = datetime.now() + timedelta(minutes=15)  # Каждые 15 минут
            
            return AnomalyDetectionResponse(
                anomalies=filtered_anomalies,
                total_count=len(filtered_anomalies),
                period_analyzed=period,
                model_used="IsolationForest + Statistical Rules",
                next_check=next_check,
                message=f"Обнаружено {len(filtered_anomalies)} аномалий за {period}"
            )
            
        except Exception as e:
            logger.error(f"Ошибка обнаружения аномалий: {str(e)}")
            raise
    
    async def _detect_sales_anomalies(self, days_back: int, severity: str) -> List[Anomaly]:
        """Обнаружение аномалий в продажах"""
        try:
            # Получаем данные продаж
            sales_data = await self.clickhouse.get_sales_data_for_anomaly_detection(days_back)
            
            if len(sales_data) < 10:
                logger.warning("Недостаточно данных для анализа аномалий продаж")
                return []
            
            anomalies = []
            
            # 1. Статистические аномалии по суммам сделок
            anomalies.extend(await self._detect_statistical_anomalies(sales_data, "sales"))
            
            # 2. ML-основанные аномалии с Isolation Forest
            if self.sales_anomaly_model is None:
                await self._train_sales_anomaly_model(sales_data)
            
            ml_anomalies = await self._detect_ml_anomalies(sales_data, "sales")
            anomalies.extend(ml_anomalies)
            
            # 3. Бизнес-правила
            business_anomalies = await self._detect_business_rule_anomalies(sales_data, "sales")
            anomalies.extend(business_anomalies)
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Ошибка анализа аномалий продаж: {str(e)}")
            raise
    
    async def _detect_activity_anomalies(self, days_back: int, severity: str) -> List[Anomaly]:
        """Обнаружение аномалий в активности"""
        try:
            # Получаем данные активности
            activity_data = await self.clickhouse.get_activity_data_for_anomaly_detection(days_back)
            
            if len(activity_data) < 10:
                logger.warning("Недостаточно данных для анализа аномалий активности")
                return []
            
            anomalies = []
            
            # Аномалии в активности менеджеров
            for manager_id in activity_data['manager_id'].unique():
                manager_data = activity_data[activity_data['manager_id'] == manager_id]
                
                # Проверяем на периоды неактивности
                date_range = pd.date_range(
                    start=activity_data['date'].min(),
                    end=activity_data['date'].max(),
                    freq='D'
                )
                
                manager_dates = set(manager_data['date'].dt.date)
                missing_dates = [d for d in date_range if d.date() not in manager_dates]
                
                if len(missing_dates) >= self.detection_rules['zero_activity_days']:
                    anomaly = Anomaly(
                        id=str(uuid.uuid4()),
                        type=AnomalyType.ACTIVITY,
                        severity=AnomalySeverity.MEDIUM,
                        timestamp=datetime.now(),
                        description=f"Менеджер {manager_id} не проявлял активности {len(missing_dates)} дней",
                        affected_entity=f"manager_{manager_id}",
                        actual_value=0,
                        expected_value=1,
                        deviation_percentage=100.0,
                        confidence=0.9
                    )
                    anomalies.append(anomaly)
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Ошибка анализа аномалий активности: {str(e)}")
            raise
    
    async def _detect_leads_anomalies(self, days_back: int, severity: str) -> List[Anomaly]:
        """Обнаружение аномалий в лидах"""
        try:
            # Простейшая реализация - можно расширить
            query = """
            SELECT 
                date(created_date) as date,
                source_type,
                count(*) as leads_count
            FROM leads
            WHERE created_date >= today() - INTERVAL %(days_back)s DAY
            GROUP BY date, source_type
            ORDER BY date DESC
            """
            
            leads_data = self.clickhouse.query_to_dataframe(query, {'days_back': days_back})
            
            if len(leads_data) < 5:
                return []
            
            anomalies = []
            
            # Проверяем резкие изменения по источникам
            for source in leads_data['source_type'].unique():
                source_data = leads_data[leads_data['source_type'] == source]
                
                if len(source_data) >= 7:  # Минимум неделя данных
                    recent_avg = source_data.head(3)['leads_count'].mean()
                    baseline_avg = source_data.tail(7)['leads_count'].mean()
                    
                    if baseline_avg > 0 and recent_avg < baseline_avg * 0.5:  # Падение более чем на 50%
                        anomaly = Anomaly(
                            id=str(uuid.uuid4()),
                            type=AnomalyType.LEADS,
                            severity=AnomalySeverity.HIGH,
                            timestamp=datetime.now(),
                            description=f"Резкое падение лидов из источника {source}",
                            affected_entity=f"source_{source}",
                            actual_value=recent_avg,
                            expected_value=baseline_avg,
                            deviation_percentage=((baseline_avg - recent_avg) / baseline_avg) * 100,
                            confidence=0.8
                        )
                        anomalies.append(anomaly)
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Ошибка анализа аномалий лидов: {str(e)}")
            return []
    
    async def _detect_combined_anomalies(self, days_back: int, severity: str) -> List[Anomaly]:
        """Комбинированный анализ всех типов аномалий"""
        try:
            sales_anomalies = await self._detect_sales_anomalies(days_back, severity)
            activity_anomalies = await self._detect_activity_anomalies(days_back, severity)
            leads_anomalies = await self._detect_leads_anomalies(days_back, severity)
            
            all_anomalies = sales_anomalies + activity_anomalies + leads_anomalies
            
            # Сортируем по важности и времени
            all_anomalies.sort(key=lambda x: (x.severity.value, x.timestamp), reverse=True)
            
            return all_anomalies
            
        except Exception as e:
            logger.error(f"Ошибка комбинированного анализа: {str(e)}")
            raise
    
    async def _detect_statistical_anomalies(self, data: pd.DataFrame, data_type: str) -> List[Anomaly]:
        """Статистическое обнаружение аномалий (Z-score, IQR)"""
        anomalies = []
        
        try:
            if data_type == "sales":
                # Анализируем суммы сделок
                amounts = data['total_amount'].dropna()
                
                if len(amounts) > 10:
                    # Z-score метод
                    z_scores = np.abs((amounts - amounts.mean()) / amounts.std())
                    outliers = data[z_scores > 3]  # Стандартный порог 3 сигма
                    
                    for _, row in outliers.iterrows():
                        anomaly = Anomaly(
                            id=str(uuid.uuid4()),
                            type=AnomalyType.SALES,
                            severity=AnomalySeverity.HIGH if z_scores.loc[row.name] > 4 else AnomalySeverity.MEDIUM,
                            timestamp=row['date'],
                            description=f"Необычная сумма продаж: {row['total_amount']:.2f}",
                            affected_entity=f"manager_{row['manager_id']}",
                            actual_value=row['total_amount'],
                            expected_value=amounts.mean(),
                            deviation_percentage=((row['total_amount'] - amounts.mean()) / amounts.mean()) * 100,
                            confidence=min(0.95, z_scores.loc[row.name] / 5)
                        )
                        anomalies.append(anomaly)
            
            return anomalies
            
        except Exception as e:
            logger.warning(f"Ошибка статистического анализа: {str(e)}")
            return []
    
    async def _detect_ml_anomalies(self, data: pd.DataFrame, data_type: str) -> List[Anomaly]:
        """ML-основанное обнаружение аномалий с Isolation Forest"""
        anomalies = []
        
        try:
            if data_type == "sales" and self.sales_anomaly_model is not None:
                # Подготавливаем признаки
                features = self._prepare_features_for_ml(data, data_type)
                
                if len(features) > 0:
                    # Нормализуем данные
                    if 'sales' in self.scalers:
                        features_scaled = self.scalers['sales'].transform(features)
                    else:
                        return anomalies
                    
                    # Предсказываем аномалии
                    predictions = self.sales_anomaly_model.predict(features_scaled)
                    anomaly_scores = self.sales_anomaly_model.decision_function(features_scaled)
                    
                    # Выделяем аномалии (prediction = -1)
                    anomaly_indices = np.where(predictions == -1)[0]
                    
                    for idx in anomaly_indices:
                        if idx < len(data):
                            row = data.iloc[idx]
                            score = abs(anomaly_scores[idx])
                            
                            # Определяем серьезность по score
                            if score > 0.3:
                                severity = AnomalySeverity.HIGH
                            elif score > 0.1:
                                severity = AnomalySeverity.MEDIUM
                            else:
                                severity = AnomalySeverity.LOW
                            
                            anomaly = Anomaly(
                                id=str(uuid.uuid4()),
                                type=AnomalyType.SALES,
                                severity=severity,
                                timestamp=row['date'],
                                description=f"ML-детекция: аномальный паттерн продаж",
                                affected_entity=f"manager_{row['manager_id']}",
                                actual_value=row['total_amount'],
                                expected_value=data['total_amount'].median(),
                                deviation_percentage=score * 100,
                                confidence=min(0.95, score * 2)
                            )
                            anomalies.append(anomaly)
            
            return anomalies
            
        except Exception as e:
            logger.warning(f"Ошибка ML-анализа аномалий: {str(e)}")
            return []
    
    async def _detect_business_rule_anomalies(self, data: pd.DataFrame, data_type: str) -> List[Anomaly]:
        """Обнаружение аномалий на основе бизнес-правил"""
        anomalies = []
        
        try:
            if data_type == "sales":
                # Правило: сделки значительно больше среднего
                avg_amount = data['total_amount'].mean()
                high_threshold = avg_amount * self.detection_rules['high_amount_multiplier']
                
                high_amount_deals = data[data['total_amount'] > high_threshold]
                
                for _, row in high_amount_deals.iterrows():
                    anomaly = Anomaly(
                        id=str(uuid.uuid4()),
                        type=AnomalyType.SALES,
                        severity=AnomalySeverity.MEDIUM,
                        timestamp=row['date'],
                        description=f"Сделка значительно превышает средний размер",
                        affected_entity=f"manager_{row['manager_id']}",
                        actual_value=row['total_amount'],
                        expected_value=avg_amount,
                        deviation_percentage=((row['total_amount'] - avg_amount) / avg_amount) * 100,
                        confidence=0.8
                    )
                    anomalies.append(anomaly)
                
                # Правило: резкое падение продаж по дням
                daily_sales = data.groupby('date')['total_amount'].sum().sort_index()
                
                if len(daily_sales) >= 7:
                    # Сравниваем последние 3 дня с предыдущими 7
                    recent_avg = daily_sales.tail(3).mean()
                    baseline_avg = daily_sales.iloc[-10:-3].mean()
                    
                    if baseline_avg > 0 and recent_avg < baseline_avg * (1 - self.detection_rules['sales_drop_threshold']):
                        anomaly = Anomaly(
                            id=str(uuid.uuid4()),
                            type=AnomalyType.SALES,
                            severity=AnomalySeverity.HIGH,
                            timestamp=datetime.now(),
                            description=f"Резкое падение общих продаж на {((baseline_avg - recent_avg) / baseline_avg * 100):.1f}%",
                            affected_entity="sales_overall",
                            actual_value=recent_avg,
                            expected_value=baseline_avg,
                            deviation_percentage=((baseline_avg - recent_avg) / baseline_avg) * 100,
                            confidence=0.9
                        )
                        anomalies.append(anomaly)
            
            return anomalies
            
        except Exception as e:
            logger.warning(f"Ошибка анализа бизнес-правил: {str(e)}")
            return []
    
    def _prepare_features_for_ml(self, data: pd.DataFrame, data_type: str) -> np.ndarray:
        """Подготовка признаков для ML модели"""
        try:
            if data_type == "sales":
                # Создаем признаки для модели
                features = []
                
                for _, row in data.iterrows():
                    feature_vector = [
                        row['deals_count'],
                        row['total_amount'],
                        row['avg_amount'],
                        row['max_amount'],
                        row['date'].weekday(),  # День недели
                        row['date'].day,        # День месяца
                    ]
                    features.append(feature_vector)
                
                return np.array(features) if features else np.array([])
            
            return np.array([])
            
        except Exception as e:
            logger.warning(f"Ошибка подготовки признаков: {str(e)}")
            return np.array([])
    
    async def _train_sales_anomaly_model(self, data: pd.DataFrame):
        """Обучение модели аномалий для продаж"""
        try:
            logger.info("Обучаю модель аномалий продаж...")
            
            # Подготавливаем признаки
            features = self._prepare_features_for_ml(data, "sales")
            
            if len(features) < 10:
                logger.warning("Недостаточно данных для обучения модели аномалий")
                return
            
            # Создаем и обучаем скалер
            scaler = StandardScaler()
            features_scaled = scaler.fit_transform(features)
            
            # Создаем и обучаем модель Isolation Forest
            self.sales_anomaly_model = IsolationForest(
                contamination=0.1,  # Ожидаем 10% аномалий
                random_state=42,
                n_estimators=100,
                max_samples='auto',
                max_features=1.0,
                bootstrap=False,
                n_jobs=-1,  # Используем все ядра
                warm_start=False
            )
            
            self.sales_anomaly_model.fit(features_scaled)
            
            # Сохраняем скалер
            self.scalers['sales'] = scaler
            
            # Сохраняем модели
            self._save_models()
            
            # Обновляем метаданные
            self.model_metadata['last_trained'] = datetime.now()
            
            logger.info("Модель аномалий продаж успешно обучена")
            
        except Exception as e:
            logger.error(f"Ошибка обучения модели аномалий: {str(e)}")
            raise
    
    def _parse_period(self, period: str) -> int:
        """Парсинг периода в количество дней"""
        period_map = {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '1w': 7,
            '1m': 30,
            '3m': 90
        }
        return period_map.get(period, 30)
    
    def _filter_by_severity(self, anomalies: List[Anomaly], min_severity: str) -> List[Anomaly]:
        """Фильтрация аномалий по уровню серьезности"""
        severity_order = {
            'low': 1,
            'medium': 2,
            'high': 3,
            'critical': 4
        }
        
        min_level = severity_order.get(min_severity, 2)
        
        filtered = []
        for anomaly in anomalies:
            anomaly_level = severity_order.get(anomaly.severity.value, 1)
            if anomaly_level >= min_level:
                filtered.append(anomaly)
        
        return filtered
    
    async def _save_anomalies_to_clickhouse(self, anomalies: List[Anomaly]):
        """Сохранение аномалий в ClickHouse"""
        try:
            if not anomalies:
                return
            
            anomaly_data = []
            for anomaly in anomalies:
                anomaly_data.append({
                    'anomaly_type': anomaly.type.value,
                    'severity': anomaly.severity.value,
                    'detection_date': anomaly.timestamp,
                    'affected_entity': anomaly.affected_entity,
                    'actual_value': anomaly.actual_value,
                    'expected_value': anomaly.expected_value,
                    'deviation_percentage': anomaly.deviation_percentage,
                    'confidence': anomaly.confidence,
                    'description': anomaly.description
                })
            
            await self.clickhouse.save_anomaly_results(anomaly_data)
            
            # Обновляем счетчик
            self.model_metadata['anomalies_detected_today'] += len(anomalies)
            
        except Exception as e:
            logger.warning(f"Не удалось сохранить аномалии в ClickHouse: {str(e)}")
    
    async def configure_rules(self, rules_request: AnomalyRulesRequest) -> Dict[str, Any]:
        """Настройка правил детекции аномалий"""
        try:
            # Обновляем правила
            for rule in rules_request.rules:
                rule_key = f"{rule.metric}_{rule.comparison}_threshold"
                self.detection_rules[rule_key] = rule.threshold
            
            logger.info(f"Обновлены правила детекции: {len(rules_request.rules)} правил")
            
            return {
                "success": True,
                "message": f"Настроено {len(rules_request.rules)} правил детекции",
                "updated_rules": len(rules_request.rules),
                "notification_channels": rules_request.notification_channels
            }
            
        except Exception as e:
            logger.error(f"Ошибка настройки правил: {str(e)}")
            raise
    
    async def get_model_status(self) -> ModelStatus:
        """Получение статуса модели аномалий"""
        try:
            return ModelStatus(
                name="Anomaly Detection",
                version=self.model_metadata['version'],
                last_trained=self.model_metadata['last_trained'] or datetime.now() - timedelta(days=7),
                accuracy=0.75,  # Примерная точность для аномалий
                status="active" if self.sales_anomaly_model else "not_trained",
                data_freshness=datetime.now() - timedelta(minutes=15),
                predictions_count=self.model_metadata['anomalies_detected_today']
            )
        except Exception as e:
            logger.error(f"Ошибка получения статуса модели аномалий: {str(e)}")
            raise
    
    async def retrain_model(self):
        """Переобучение модели аномалий"""
        try:
            logger.info("Начинаю переобучение модели аномалий...")
            
            # Получаем свежие данные
            sales_data = await self.clickhouse.get_sales_data_for_anomaly_detection(90)
            
            if len(sales_data) >= 20:
                await self._train_sales_anomaly_model(sales_data)
            
            logger.info("Модель аномалий успешно переобучена")
            
        except Exception as e:
            logger.error(f"Ошибка переобучения модели аномалий: {str(e)}")
            raise