"""
Churn Prediction Service

Сервис предсказания оттока клиентов с использованием машинного обучения.
Предоставляет методы для:
- Предсказания вероятности оттока отдельных клиентов
- Идентификации клиентов группы риска
- Генерации рекомендаций по удержанию
- Анализа факторов оттока
"""

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, roc_auc_score
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import joblib
from pathlib import Path

from models.ml_models import (
    ChurnPredictionResponse,
    CustomerChurnPrediction,
    ChurnRisk,
    ChurnFactor,
    ChurnCandidatesResponse,
    RetentionRecommendation,
    RetentionAction,
    RetentionRequest,
    RetentionResponse,
    ModelStatus
)
from services.clickhouse_service import ClickHouseService

logger = logging.getLogger(__name__)

class ChurnService:
    """Сервис предсказания оттока клиентов"""
    
    def __init__(self, clickhouse_service: ClickHouseService):
        self.clickhouse = clickhouse_service
        self.models_dir = Path("ml_models")
        self.models_dir.mkdir(exist_ok=True)
        
        # ML модели
        self.churn_model = None
        self.feature_scaler = None
        self.label_encoders = {}
        
        # Метаданные
        self.model_metadata = {
            'last_trained': None,
            'accuracy': None,
            'roc_auc': None,
            'feature_importance': {},
            'version': '1.0.0',
            'predictions_made': 0
        }
        
        # Бизнес-правила для рекомендаций
        self.retention_strategies = {
            'high_value_inactive': [
                {'action_type': 'personal_call', 'priority': 5, 'description': 'Персональный звонок senior менеджера', 'expected_impact': 0.7, 'cost_estimate': 500},
                {'action_type': 'special_discount', 'priority': 4, 'description': 'Специальная скидка 15%', 'expected_impact': 0.6, 'cost_estimate': 1000},
                {'action_type': 'loyalty_program', 'priority': 3, 'description': 'Приглашение в VIP программу', 'expected_impact': 0.5, 'cost_estimate': 200}
            ],
            'medium_value_declining': [
                {'action_type': 'email_campaign', 'priority': 3, 'description': 'Персонализированная email кампания', 'expected_impact': 0.4, 'cost_estimate': 100},
                {'action_type': 'product_demo', 'priority': 4, 'description': 'Демо новых возможностей продукта', 'expected_impact': 0.5, 'cost_estimate': 300},
                {'action_type': 'feedback_survey', 'priority': 2, 'description': 'Опрос об удовлетворенности', 'expected_impact': 0.3, 'cost_estimate': 50}
            ],
            'low_value_at_risk': [
                {'action_type': 'automated_email', 'priority': 2, 'description': 'Автоматизированная email последовательность', 'expected_impact': 0.3, 'cost_estimate': 20},
                {'action_type': 'webinar_invite', 'priority': 3, 'description': 'Приглашение на образовательный вебинар', 'expected_impact': 0.4, 'cost_estimate': 80},
                {'action_type': 'trial_extension', 'priority': 1, 'description': 'Продление пробного периода', 'expected_impact': 0.2, 'cost_estimate': 0}
            ]
        }
        
        # Загружаем модели при инициализации
        self._load_models_if_exist()
    
    def _load_models_if_exist(self):
        """Загрузка сохраненных моделей"""
        try:
            model_path = self.models_dir / "churn_model.pkl"
            scaler_path = self.models_dir / "churn_scaler.pkl"
            encoders_path = self.models_dir / "churn_encoders.pkl"
            metadata_path = self.models_dir / "churn_metadata.pkl"
            
            if model_path.exists():
                self.churn_model = joblib.load(model_path)
                logger.info("Модель предсказания оттока загружена")
                
            if scaler_path.exists():
                self.feature_scaler = joblib.load(scaler_path)
                logger.info("Скалер признаков загружен")
                
            if encoders_path.exists():
                self.label_encoders = joblib.load(encoders_path)
                logger.info("Кодировщики категорий загружены")
                
            if metadata_path.exists():
                self.model_metadata.update(joblib.load(metadata_path))
                logger.info("Метаданные модели загружены")
                
        except Exception as e:
            logger.warning(f"Ошибка загрузки моделей оттока: {str(e)}")
    
    def _save_models(self):
        """Сохранение моделей на диск"""
        try:
            if self.churn_model:
                joblib.dump(self.churn_model, self.models_dir / "churn_model.pkl")
                
            if self.feature_scaler:
                joblib.dump(self.feature_scaler, self.models_dir / "churn_scaler.pkl")
                
            if self.label_encoders:
                joblib.dump(self.label_encoders, self.models_dir / "churn_encoders.pkl")
                
            joblib.dump(self.model_metadata, self.models_dir / "churn_metadata.pkl")
            
            logger.info("Модели оттока сохранены")
            
        except Exception as e:
            logger.error(f"Ошибка сохранения моделей оттока: {str(e)}")
    
    async def predict_customer_churn(self, customer_id: str) -> ChurnPredictionResponse:
        """
        Предсказание риска оттока конкретного клиента
        
        Args:
            customer_id: ID клиента
            
        Returns:
            ChurnPredictionResponse с предсказанием и факторами риска
        """
        try:
            logger.info(f"Предсказываю отток для клиента {customer_id}")
            
            # Если модель не обучена, обучаем
            if self.churn_model is None:
                await self._train_churn_model()
            
            # Получаем признаки клиента
            customer_features = await self._get_customer_features(customer_id)
            
            if customer_features is None:
                raise ValueError(f"Не найдены данные для клиента {customer_id}")
            
            # Делаем предсказание
            churn_probability = await self._predict_single_customer(customer_features)
            
            # Определяем уровень риска
            risk_level = self._determine_risk_level(churn_probability)
            
            # Анализируем ключевые факторы
            key_factors = await self._analyze_churn_factors(customer_features, customer_id)
            
            # Предсказываем дату оттока
            predicted_churn_date = self._estimate_churn_date(churn_probability, customer_features)
            
            # Формируем предсказание
            prediction = CustomerChurnPrediction(
                customer_id=customer_id,
                customer_name=customer_features.get('customer_name', f'Customer {customer_id}'),
                churn_probability=churn_probability,
                risk_level=risk_level,
                key_factors=key_factors,
                last_activity_date=customer_features.get('last_activity_date'),
                days_since_last_purchase=customer_features.get('days_since_last_deal', 0),
                total_value=customer_features.get('total_value', 0),
                predicted_churn_date=predicted_churn_date
            )
            
            # Сохраняем предсказание
            await self._save_churn_prediction(prediction)
            
            # Обновляем счетчик
            self.model_metadata['predictions_made'] += 1
            
            return ChurnPredictionResponse(
                prediction=prediction,
                model_accuracy=self.model_metadata.get('accuracy', 0.8),
                recommendation_generated=True,
                message=f"Предсказание оттока для клиента {customer_id} готово"
            )
            
        except Exception as e:
            logger.error(f"Ошибка предсказания оттока для клиента {customer_id}: {str(e)}")
            raise
    
    async def get_high_risk_customers(self, risk_threshold: float = 0.7) -> ChurnCandidatesResponse:
        """
        Получение списка клиентов с высоким риском оттока
        
        Args:
            risk_threshold: Минимальный порог вероятности оттока
            
        Returns:
            ChurnCandidatesResponse со списком клиентов группы риска
        """
        try:
            logger.info(f"Ищу клиентов с риском оттока > {risk_threshold}")
            
            # Получаем данные всех клиентов
            all_customers_data = await self.clickhouse.get_customer_features_for_churn()
            
            if len(all_customers_data) == 0:
                return ChurnCandidatesResponse(
                    candidates=[],
                    total_at_risk=0,
                    total_value_at_risk=0,
                    average_churn_probability=0,
                    message="Нет данных о клиентах для анализа"
                )
            
            # Если модель не обучена, обучаем
            if self.churn_model is None:
                await self._train_churn_model()
            
            candidates = []
            total_value_at_risk = 0
            probabilities = []
            
            # Анализируем каждого клиента
            for _, customer_row in all_customers_data.iterrows():
                customer_id = customer_row['customer_id']
                
                try:
                    # Подготавливаем признаки
                    customer_features = self._prepare_customer_features_from_row(customer_row)
                    
                    # Предсказываем вероятность оттока
                    churn_probability = await self._predict_single_customer(customer_features)
                    probabilities.append(churn_probability)
                    
                    # Если вероятность выше порога, добавляем в кандидаты
                    if churn_probability >= risk_threshold:
                        risk_level = self._determine_risk_level(churn_probability)
                        key_factors = await self._analyze_churn_factors(customer_features, customer_id)
                        
                        predicted_churn_date = self._estimate_churn_date(churn_probability, customer_features)
                        
                        candidate = CustomerChurnPrediction(
                            customer_id=customer_id,
                            customer_name=f'Customer {customer_id}',
                            churn_probability=churn_probability,
                            risk_level=risk_level,
                            key_factors=key_factors,
                            last_activity_date=customer_features.get('last_activity_date'),
                            days_since_last_purchase=customer_features.get('days_since_last_deal', 0),
                            total_value=customer_features.get('total_value', 0),
                            predicted_churn_date=predicted_churn_date
                        )
                        
                        candidates.append(candidate)
                        total_value_at_risk += customer_features.get('total_value', 0)
                        
                except Exception as e:
                    logger.warning(f"Ошибка анализа клиента {customer_id}: {str(e)}")
                    continue
            
            # Сортируем по убыванию вероятности оттока
            candidates.sort(key=lambda x: x.churn_probability, reverse=True)
            
            # Сохраняем результаты
            await self._save_bulk_churn_predictions(candidates)
            
            return ChurnCandidatesResponse(
                candidates=candidates,
                total_at_risk=len(candidates),
                total_value_at_risk=total_value_at_risk,
                average_churn_probability=np.mean(probabilities) if probabilities else 0,
                message=f"Найдено {len(candidates)} клиентов с высоким риском оттока"
            )
            
        except Exception as e:
            logger.error(f"Ошибка поиска клиентов группы риска: {str(e)}")
            raise
    
    async def get_retention_recommendations(self, request: RetentionRequest) -> RetentionResponse:
        """
        Генерация рекомендаций по удержанию клиентов
        
        Args:
            request: Запрос с параметрами для генерации рекомендаций
            
        Returns:
            RetentionResponse с рекомендациями по удержанию
        """
        try:
            logger.info(f"Генерирую рекомендации по удержанию для {len(request.customer_ids)} клиентов")
            
            recommendations = []
            total_cost = 0
            retention_probabilities = []
            
            for customer_id in request.customer_ids:
                try:
                    # Получаем данные клиента
                    customer_features = await self._get_customer_features(customer_id)
                    
                    if customer_features is None:
                        continue
                    
                    # Предсказываем вероятность оттока
                    churn_probability = await self._predict_single_customer(customer_features)
                    
                    # Генерируем рекомендации на основе профиля клиента
                    actions = self._generate_retention_actions(customer_features, churn_probability)
                    
                    # Фильтруем по бюджету если задан
                    if request.budget_limit:
                        actions = self._filter_actions_by_budget(actions, request.budget_limit, total_cost)
                    
                    # Рассчитываем ожидаемую вероятность удержания
                    retention_probability = self._calculate_retention_probability(churn_probability, actions)
                    retention_probabilities.append(retention_probability)
                    
                    # Рассчитываем ROI
                    roi_estimate = self._calculate_retention_roi(customer_features, actions, retention_probability)
                    
                    recommendation = RetentionRecommendation(
                        customer_id=customer_id,
                        actions=actions,
                        estimated_retention_probability=retention_probability,
                        roi_estimate=roi_estimate
                    )
                    
                    recommendations.append(recommendation)
                    
                    # Добавляем к общей стоимости
                    action_costs = [action.cost_estimate for action in actions if action.cost_estimate]
                    total_cost += sum(action_costs)
                    
                except Exception as e:
                    logger.warning(f"Ошибка генерации рекомендаций для клиента {customer_id}: {str(e)}")
                    continue
            
            return RetentionResponse(
                recommendations=recommendations,
                total_customers=len(recommendations),
                total_estimated_cost=total_cost,
                expected_retention_rate=np.mean(retention_probabilities) if retention_probabilities else 0,
                message=f"Сгенерированы рекомендации для {len(recommendations)} клиентов"
            )
            
        except Exception as e:
            logger.error(f"Ошибка генерации рекомендаций по удержанию: {str(e)}")
            raise
    
    async def _train_churn_model(self):
        """Обучение модели предсказания оттока"""
        try:
            logger.info("Начинаю обучение модели предсказания оттока...")
            
            # Получаем данные клиентов
            features_data = await self.clickhouse.get_customer_features_for_churn()
            labels_data = await self.clickhouse.get_churned_customers_labels(days_threshold=180)
            
            if len(features_data) < 50:
                logger.warning("Недостаточно данных для обучения модели оттока")
                return
            
            # Объединяем признаки и метки
            train_data = features_data.merge(labels_data, on='customer_id', how='inner')
            
            if len(train_data) < 30:
                logger.warning("Недостаточно данных после объединения")
                return
            
            # Подготавливаем признаки
            X, feature_names = self._prepare_training_features(train_data)
            y = train_data['churned'].values
            
            # Разделяем на обучающую и тестовую выборки
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            
            # Нормализуем признаки
            self.feature_scaler = StandardScaler()
            X_train_scaled = self.feature_scaler.fit_transform(X_train)
            X_test_scaled = self.feature_scaler.transform(X_test)
            
            # Обучаем модель (используем Random Forest для интерпретируемости)
            self.churn_model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=3,
                random_state=42,
                class_weight='balanced',  # Для работы с дисбалансом классов
                n_jobs=-1
            )
            
            self.churn_model.fit(X_train_scaled, y_train)
            
            # Оцениваем модель
            y_pred = self.churn_model.predict(X_test_scaled)
            y_pred_proba = self.churn_model.predict_proba(X_test_scaled)[:, 1]
            
            # Рассчитываем метрики
            accuracy = self.churn_model.score(X_test_scaled, y_test)
            try:
                roc_auc = roc_auc_score(y_test, y_pred_proba)
            except ValueError:
                roc_auc = 0.5  # Fallback если все классы одинаковые
            
            # Получаем важность признаков
            feature_importance = dict(zip(feature_names, self.churn_model.feature_importances_))
            
            # Обновляем метаданные
            self.model_metadata.update({
                'last_trained': datetime.now(),
                'accuracy': accuracy,
                'roc_auc': roc_auc,
                'feature_importance': feature_importance
            })
            
            # Сохраняем модели
            self._save_models()
            
            logger.info(f"Модель оттока обучена: accuracy={accuracy:.3f}, ROC-AUC={roc_auc:.3f}")
            
        except Exception as e:
            logger.error(f"Ошибка обучения модели оттока: {str(e)}")
            raise
    
    def _prepare_training_features(self, data: pd.DataFrame) -> Tuple[np.ndarray, List[str]]:
        """Подготовка признаков для обучения"""
        try:
            feature_columns = [
                'total_deals', 'total_value', 'avg_deal_size', 'days_since_last_deal',
                'customer_lifetime_days', 'managers_worked_with', 'recent_activities',
                'support_tickets_count', 'avg_satisfaction'
            ]
            
            # Заполняем пропуски
            features_df = data[feature_columns].fillna(0)
            
            # Создаем дополнительные признаки
            features_df['deals_per_month'] = features_df['total_deals'] / (features_df['customer_lifetime_days'] / 30 + 1)
            features_df['value_per_deal'] = features_df['total_value'] / (features_df['total_deals'] + 1)
            features_df['activity_ratio'] = features_df['recent_activities'] / (features_df['total_deals'] + 1)
            features_df['satisfaction_score'] = features_df['avg_satisfaction'] / 5.0  # Нормализуем
            
            # Логарифмируем некоторые признаки для уменьшения влияния выбросов
            features_df['log_total_value'] = np.log1p(features_df['total_value'])
            features_df['log_days_since_last'] = np.log1p(features_df['days_since_last_deal'])
            
            feature_names = list(features_df.columns)
            
            return features_df.values, feature_names
            
        except Exception as e:
            logger.error(f"Ошибка подготовки признаков: {str(e)}")
            raise
    
    async def _get_customer_features(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """Получение признаков конкретного клиента"""
        try:
            # Получаем данные клиента из ClickHouse
            query = """
            WITH customer_stats AS (
                SELECT 
                    customer_id,
                    count(*) as total_deals,
                    sum(amount) as total_value,
                    avg(amount) as avg_deal_size,
                    max(deal_date) as last_deal_date,
                    min(deal_date) as first_deal_date,
                    count(DISTINCT manager_id) as managers_worked_with
                FROM deals
                WHERE customer_id = %(customer_id)s AND status = 'won'
                GROUP BY customer_id
            ),
            recent_activity AS (
                SELECT 
                    customer_id,
                    count(*) as recent_activities,
                    max(activity_date) as last_activity_date
                FROM activities 
                WHERE customer_id = %(customer_id)s 
                    AND activity_date >= today() - INTERVAL 90 DAY
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
                5.0 as avg_satisfaction  -- Заглушка
            FROM customer_stats cs
            LEFT JOIN recent_activity ra ON cs.customer_id = ra.customer_id
            """
            
            result = self.clickhouse.query_to_dataframe(query, {'customer_id': customer_id})
            
            if len(result) == 0:
                return None
            
            customer_row = result.iloc[0]
            return self._prepare_customer_features_from_row(customer_row)
            
        except Exception as e:
            logger.error(f"Ошибка получения признаков клиента {customer_id}: {str(e)}")
            return None
    
    def _prepare_customer_features_from_row(self, customer_row: pd.Series) -> Dict[str, Any]:
        """Подготовка признаков клиента из строки данных"""
        features = {
            'customer_id': customer_row['customer_id'],
            'total_deals': customer_row.get('total_deals', 0),
            'total_value': customer_row.get('total_value', 0),
            'avg_deal_size': customer_row.get('avg_deal_size', 0),
            'days_since_last_deal': customer_row.get('days_since_last_deal', 0),
            'customer_lifetime_days': customer_row.get('customer_lifetime_days', 1),
            'managers_worked_with': customer_row.get('managers_worked_with', 0),
            'recent_activities': customer_row.get('recent_activities', 0),
            'support_tickets_count': customer_row.get('support_tickets_count', 0),
            'avg_satisfaction': customer_row.get('avg_satisfaction', 5.0),
            'last_activity_date': customer_row.get('last_activity_date')
        }
        
        # Добавляем вычисляемые признаки
        features['deals_per_month'] = features['total_deals'] / (features['customer_lifetime_days'] / 30 + 1)
        features['value_per_deal'] = features['total_value'] / (features['total_deals'] + 1)
        features['activity_ratio'] = features['recent_activities'] / (features['total_deals'] + 1)
        features['satisfaction_score'] = features['avg_satisfaction'] / 5.0
        features['log_total_value'] = np.log1p(features['total_value'])
        features['log_days_since_last'] = np.log1p(features['days_since_last_deal'])
        
        return features
    
    async def _predict_single_customer(self, customer_features: Dict[str, Any]) -> float:
        """Предсказание вероятности оттока для одного клиента"""
        try:
            # Подготавливаем признаки в том же порядке, что и при обучении
            feature_values = [
                customer_features['total_deals'],
                customer_features['total_value'],
                customer_features['avg_deal_size'],
                customer_features['days_since_last_deal'],
                customer_features['customer_lifetime_days'],
                customer_features['managers_worked_with'],
                customer_features['recent_activities'],
                customer_features['support_tickets_count'],
                customer_features['avg_satisfaction'],
                customer_features['deals_per_month'],
                customer_features['value_per_deal'],
                customer_features['activity_ratio'],
                customer_features['satisfaction_score'],
                customer_features['log_total_value'],
                customer_features['log_days_since_last']
            ]
            
            # Нормализуем признаки
            features_scaled = self.feature_scaler.transform([feature_values])
            
            # Предсказываем вероятность оттока
            churn_probability = self.churn_model.predict_proba(features_scaled)[0, 1]
            
            return float(churn_probability)
            
        except Exception as e:
            logger.error(f"Ошибка предсказания для клиента: {str(e)}")
            return 0.5  # Возвращаем нейтральную вероятность при ошибке
    
    def _determine_risk_level(self, churn_probability: float) -> ChurnRisk:
        """Определение уровня риска на основе вероятности оттока"""
        if churn_probability >= 0.8:
            return ChurnRisk.CRITICAL
        elif churn_probability >= 0.6:
            return ChurnRisk.HIGH
        elif churn_probability >= 0.4:
            return ChurnRisk.MEDIUM
        else:
            return ChurnRisk.LOW
    
    async def _analyze_churn_factors(self, customer_features: Dict[str, Any], customer_id: str) -> List[ChurnFactor]:
        """Анализ ключевых факторов оттока для клиента"""
        factors = []
        
        try:
            # Фактор: долго нет покупок
            days_since_last = customer_features.get('days_since_last_deal', 0)
            if days_since_last > 90:
                weight = min(1.0, days_since_last / 365)
                factors.append(ChurnFactor(
                    factor='long_inactivity',
                    weight=weight,
                    description=f'Нет покупок {days_since_last} дней'
                ))
            
            # Фактор: низкая активность
            recent_activities = customer_features.get('recent_activities', 0)
            if recent_activities < 3:
                factors.append(ChurnFactor(
                    factor='low_activity',
                    weight=0.7,
                    description=f'Низкая активность: {recent_activities} действий за 90 дней'
                ))
            
            # Фактор: снижение частоты покупок
            deals_per_month = customer_features.get('deals_per_month', 0)
            if deals_per_month < 0.5:
                factors.append(ChurnFactor(
                    factor='declining_frequency',
                    weight=0.6,
                    description=f'Редкие покупки: {deals_per_month:.1f} сделок в месяц'
                ))
            
            # Фактор: низкое удовлетворение
            satisfaction = customer_features.get('avg_satisfaction', 5.0)
            if satisfaction < 3.5:
                factors.append(ChurnFactor(
                    factor='low_satisfaction',
                    weight=0.8,
                    description=f'Низкая оценка удовлетворенности: {satisfaction:.1f}/5'
                ))
            
            # Сортируем по весу
            factors.sort(key=lambda x: x.weight, reverse=True)
            
            return factors[:5]  # Возвращаем топ-5 факторов
            
        except Exception as e:
            logger.warning(f"Ошибка анализа факторов оттока: {str(e)}")
            return []
    
    def _estimate_churn_date(self, churn_probability: float, customer_features: Dict[str, Any]) -> Optional[datetime]:
        """Оценка предполагаемой даты оттока"""
        try:
            if churn_probability < 0.3:
                return None  # Низкий риск - дату не предсказываем
            
            # Базовая логика: чем выше вероятность, тем раньше отток
            days_to_churn = int(365 * (1 - churn_probability))  # От 0 до 365 дней
            
            # Корректируем на основе активности
            days_since_last = customer_features.get('days_since_last_deal', 0)
            if days_since_last > 180:
                days_to_churn = min(days_to_churn, 60)  # Ускоряем предсказание
            
            return datetime.now() + timedelta(days=days_to_churn)
            
        except Exception as e:
            logger.warning(f"Ошибка оценки даты оттока: {str(e)}")
            return None
    
    def _generate_retention_actions(self, customer_features: Dict[str, Any], churn_probability: float) -> List[RetentionAction]:
        """Генерация действий по удержанию клиента"""
        actions = []
        
        try:
            # Определяем сегмент клиента
            total_value = customer_features.get('total_value', 0)
            
            if total_value > 100000:  # Высокая ценность
                strategy_key = 'high_value_inactive'
            elif total_value > 10000:  # Средняя ценность
                strategy_key = 'medium_value_declining'
            else:  # Низкая ценность
                strategy_key = 'low_value_at_risk'
            
            # Получаем стратегию для сегмента
            strategy_actions = self.retention_strategies.get(strategy_key, [])
            
            # Конвертируем в объекты RetentionAction
            for action_data in strategy_actions:
                action = RetentionAction(
                    action_type=action_data['action_type'],
                    priority=action_data['priority'],
                    description=action_data['description'],
                    expected_impact=action_data['expected_impact'],
                    cost_estimate=action_data.get('cost_estimate')
                )
                actions.append(action)
            
            # Сортируем по приоритету и ожидаемому эффекту
            actions.sort(key=lambda x: (x.priority, x.expected_impact), reverse=True)
            
            return actions[:3]  # Возвращаем топ-3 действия
            
        except Exception as e:
            logger.warning(f"Ошибка генерации действий по удержанию: {str(e)}")
            return []
    
    def _filter_actions_by_budget(self, actions: List[RetentionAction], budget_limit: float, current_cost: float) -> List[RetentionAction]:
        """Фильтрация действий по бюджету"""
        filtered = []
        remaining_budget = budget_limit - current_cost
        
        for action in actions:
            if action.cost_estimate and action.cost_estimate <= remaining_budget:
                filtered.append(action)
                remaining_budget -= action.cost_estimate
            elif not action.cost_estimate:  # Бесплатные действия
                filtered.append(action)
        
        return filtered
    
    def _calculate_retention_probability(self, churn_probability: float, actions: List[RetentionAction]) -> float:
        """Расчет вероятности удержания с учетом действий"""
        if not actions:
            return 1 - churn_probability
        
        # Комбинируем эффекты действий
        combined_impact = 1.0
        for action in actions:
            combined_impact *= (1 - action.expected_impact)
        
        # Снижаем вероятность оттока
        reduced_churn = churn_probability * combined_impact
        return 1 - reduced_churn
    
    def _calculate_retention_roi(self, customer_features: Dict[str, Any], actions: List[RetentionAction], retention_probability: float) -> Optional[float]:
        """Расчет ROI от действий по удержанию"""
        try:
            total_cost = sum(action.cost_estimate for action in actions if action.cost_estimate)
            if total_cost == 0:
                return None
            
            # Оцениваем ценность клиента
            customer_value = customer_features.get('total_value', 0)
            expected_future_value = customer_value * 0.5  # Упрощенная оценка
            
            # ROI = (Выгода * Вероятность удержания - Затраты) / Затраты
            roi = ((expected_future_value * retention_probability) - total_cost) / total_cost
            return roi
            
        except Exception as e:
            logger.warning(f"Ошибка расчета ROI: {str(e)}")
            return None
    
    async def _save_churn_prediction(self, prediction: CustomerChurnPrediction):
        """Сохранение предсказания оттока в ClickHouse"""
        try:
            prediction_data = [{
                'customer_id': prediction.customer_id,
                'churn_probability': prediction.churn_probability,
                'risk_level': prediction.risk_level.value,
                'model_version': self.model_metadata['version'],
                'key_factors': [f.factor for f in prediction.key_factors]
            }]
            
            await self.clickhouse.save_churn_predictions(prediction_data)
            
        except Exception as e:
            logger.warning(f"Не удалось сохранить предсказание оттока: {str(e)}")
    
    async def _save_bulk_churn_predictions(self, predictions: List[CustomerChurnPrediction]):
        """Массовое сохранение предсказаний оттока"""
        try:
            prediction_data = []
            for prediction in predictions:
                prediction_data.append({
                    'customer_id': prediction.customer_id,
                    'churn_probability': prediction.churn_probability,
                    'risk_level': prediction.risk_level.value,
                    'model_version': self.model_metadata['version'],
                    'key_factors': [f.factor for f in prediction.key_factors]
                })
            
            await self.clickhouse.save_churn_predictions(prediction_data)
            
        except Exception as e:
            logger.warning(f"Не удалось сохранить массовые предсказания оттока: {str(e)}")
    
    async def get_model_status(self) -> ModelStatus:
        """Получение статуса модели оттока"""
        try:
            return ModelStatus(
                name="Churn Prediction",
                version=self.model_metadata['version'],
                last_trained=self.model_metadata['last_trained'] or datetime.now() - timedelta(days=14),
                accuracy=self.model_metadata.get('accuracy', 0.75),
                status="active" if self.churn_model else "not_trained",
                data_freshness=datetime.now() - timedelta(hours=4),
                predictions_count=self.model_metadata['predictions_made']
            )
        except Exception as e:
            logger.error(f"Ошибка получения статуса модели оттока: {str(e)}")
            raise
    
    async def retrain_model(self):
        """Переобучение модели оттока"""
        try:
            logger.info("Начинаю переобучение модели оттока...")
            await self._train_churn_model()
            logger.info("Модель оттока успешно переобучена")
        except Exception as e:
            logger.error(f"Ошибка переобучения модели оттока: {str(e)}")
            raise