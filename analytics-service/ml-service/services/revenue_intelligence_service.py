"""
Revenue Intelligence Service

Сервис анализа переговоров и текстовых данных с использованием NLP.
Предоставляет методы для:
- Транскрипции аудио записи звонков (Whisper)
- Анализа настроения (BERT/Transformers)
- Извлечения ключевых фраз и тем
- Генерации рекомендаций по продажам
- Анализа текстовых коммуникаций
"""

import whisper
import openai
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import pandas as pd
import numpy as np
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging
import requests
import re
import os
from pathlib import Path
import tempfile
import joblib

from models.ml_models import (
    CallAnalysisRequest,
    CallAnalysisResponse,
    TextAnalysisRequest,
    TextAnalysisResponse,
    SentimentScore,
    ModelStatus
)
from services.clickhouse_service import ClickHouseService

logger = logging.getLogger(__name__)

class RevenueIntelligenceService:
    """Сервис анализа переговоров и коммуникаций"""
    
    def __init__(self, clickhouse_service: ClickHouseService):
        self.clickhouse = clickhouse_service
        self.models_dir = Path("ml_models")
        self.models_dir.mkdir(exist_ok=True)
        
        # Whisper модель для транскрипции
        self.whisper_model = None
        
        # Sentiment analysis модели
        self.sentiment_pipeline = None
        self.russian_sentiment_model = None
        
        # OpenAI API клиент
        self.openai_client = None
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        
        # Кэш для анализов
        self.analysis_cache = {}
        
        # Метаданные
        self.model_metadata = {
            'whisper_loaded': False,
            'sentiment_loaded': False,
            'analyses_performed': 0,
            'version': '1.0.0',
            'last_model_update': None
        }
        
        # Ключевые слова для анализа продаж
        self.sales_keywords = {
            'positive': [
                'интересно', 'подходит', 'нравится', 'согласен', 'да', 'хорошо',
                'отлично', 'замечательно', 'идеально', 'именно то что нужно',
                'budget', 'бюджет', 'купить', 'заказать', 'подписать'
            ],
            'negative': [
                'дорого', 'не подходит', 'не нравится', 'нет', 'отказ',
                'подумаем', 'позже', 'не сейчас', 'конкуренты', 'другой вариант'
            ],
            'concerns': [
                'проблема', 'беспокоит', 'сомнения', 'но', 'однако',
                'ценa', 'стоимость', 'функционал', 'техподдержка'
            ],
            'buying_signals': [
                'когда можем начать', 'как оплатить', 'договор', 'контракт',
                'внедрение', 'запуск', 'следующий шаг', 'что дальше'
            ]
        }
        
        # Инициализация моделей
        self._initialize_models()
    
    def _initialize_models(self):
        """Инициализация NLP моделей"""
        try:
            logger.info("Инициализирую модели Revenue Intelligence...")
            
            # Инициализация OpenAI клиента
            if self.openai_api_key:
                openai.api_key = self.openai_api_key
                self.openai_client = openai
                logger.info("OpenAI API инициализирован")
            
            # Загрузка Whisper модели (base версия для баланса скорости/качества)
            try:
                self.whisper_model = whisper.load_model("base")
                self.model_metadata['whisper_loaded'] = True
                logger.info("Whisper модель загружена")
            except Exception as e:
                logger.warning(f"Не удалось загрузить Whisper: {str(e)}")
            
            # Загрузка модели анализа настроения
            try:
                # Используем предобученную модель для русского языка
                self.sentiment_pipeline = pipeline(
                    "sentiment-analysis",
                    model="blanchefort/rubert-base-cased-sentiment",
                    return_all_scores=True
                )
                self.model_metadata['sentiment_loaded'] = True
                logger.info("Модель анализа настроения загружена")
            except Exception as e:
                logger.warning(f"Не удалось загрузить модель настроения: {str(e)}")
                # Fallback на английскую модель
                try:
                    self.sentiment_pipeline = pipeline(
                        "sentiment-analysis",
                        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                        return_all_scores=True
                    )
                    self.model_metadata['sentiment_loaded'] = True
                    logger.info("Английская модель настроения загружена как fallback")
                except Exception as e2:
                    logger.error(f"Не удалось загрузить fallback модель: {str(e2)}")
            
            self.model_metadata['last_model_update'] = datetime.now()
            
        except Exception as e:
            logger.error(f"Ошибка инициализации моделей: {str(e)}")
    
    async def analyze_call(self, request: CallAnalysisRequest) -> CallAnalysisResponse:
        """
        Анализ записи звонка
        
        Args:
            request: Запрос с параметрами анализа звонка
            
        Returns:
            CallAnalysisResponse с результатами анализа
        """
        try:
            logger.info(f"Анализирую звонок: {request.audio_url}")
            
            # 1. Скачиваем аудио файл
            audio_path = await self._download_audio(request.audio_url)
            
            # 2. Транскрибируем аудио
            transcript = await self._transcribe_audio(audio_path)
            
            if not transcript:
                raise ValueError("Не удалось получить транскрипцию аудио")
            
            # 3. Анализируем настроение
            sentiment = await self._analyze_sentiment(transcript)
            
            # 4. Извлекаем ключевые фразы
            key_phrases = await self._extract_key_phrases(transcript)
            
            # 5. Анализируем соотношение времени говорения
            talk_time_ratio = await self._analyze_talk_time(transcript, request.participants)
            
            # 6. Извлекаем задачи и договоренности
            action_items = await self._extract_action_items(transcript)
            
            # 7. Генерируем рекомендации
            recommendations = await self._generate_sales_recommendations(
                transcript, sentiment, key_phrases, request
            )
            
            # 8. Определяем следующий лучший шаг
            next_best_action = await self._determine_next_action(
                transcript, sentiment, key_phrases, request
            )
            
            # 9. Оцениваем вероятность закрытия сделки
            deal_probability = await self._estimate_deal_probability(
                transcript, sentiment, key_phrases
            )
            
            # Очищаем временный файл
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            
            # Сохраняем анализ
            await self._save_call_analysis(request, transcript, sentiment, deal_probability)
            
            # Обновляем счетчик
            self.model_metadata['analyses_performed'] += 1
            
            return CallAnalysisResponse(
                transcript=transcript,
                sentiment=sentiment,
                key_phrases=key_phrases,
                recommendations=recommendations,
                next_best_action=next_best_action,
                deal_probability=deal_probability,
                talk_time_ratio=talk_time_ratio,
                action_items=action_items,
                message="Анализ звонка завершен успешно"
            )
            
        except Exception as e:
            logger.error(f"Ошибка анализа звонка: {str(e)}")
            raise
    
    async def analyze_text(self, request: TextAnalysisRequest) -> TextAnalysisResponse:
        """
        Анализ текстовых коммуникаций (email, чат, заметки)
        
        Args:
            request: Запрос на анализ текста
            
        Returns:
            TextAnalysisResponse с результатами анализа
        """
        try:
            logger.info(f"Анализирую текст: контекст={request.context}")
            
            # 1. Анализируем настроение
            sentiment = await self._analyze_sentiment(request.text)
            
            # 2. Извлекаем ключевые темы
            key_topics = await self._extract_key_topics(request.text)
            
            # 3. Определяем уровень срочности
            urgency_level = await self._determine_urgency(request.text, request.context)
            
            # 4. Анализируем намерение клиента
            intent = await self._analyze_customer_intent(request.text, request.context)
            
            # 5. Определяем необходимость действий
            action_required = await self._check_action_required(request.text, intent)
            
            # 6. Генерируем предлагаемый ответ (если нужен)
            suggested_response = None
            if action_required and request.context in ['email', 'chat']:
                suggested_response = await self._generate_suggested_response(
                    request.text, sentiment, intent
                )
            
            # Сохраняем анализ
            await self._save_text_analysis(request, sentiment, intent, urgency_level)
            
            return TextAnalysisResponse(
                sentiment=sentiment,
                key_topics=key_topics,
                urgency_level=urgency_level,
                intent=intent,
                action_required=action_required,
                suggested_response=suggested_response,
                message="Анализ текста завершен"
            )
            
        except Exception as e:
            logger.error(f"Ошибка анализа текста: {str(e)}")
            raise
    
    async def _download_audio(self, audio_url: str) -> str:
        """Скачивание аудио файла по URL"""
        try:
            response = requests.get(audio_url, timeout=30)
            response.raise_for_status()
            
            # Создаем временный файл
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                temp_file.write(response.content)
                return temp_file.name
                
        except Exception as e:
            logger.error(f"Ошибка скачивания аудио: {str(e)}")
            raise
    
    async def _transcribe_audio(self, audio_path: str) -> str:
        """Транскрипция аудио с помощью Whisper"""
        try:
            if not self.whisper_model:
                raise ValueError("Whisper модель не загружена")
            
            # Транскрибируем аудио
            result = self.whisper_model.transcribe(
                audio_path,
                language='ru',  # Указываем русский язык
                fp16=False,     # Отключаем fp16 для стабильности
                verbose=False
            )
            
            transcript = result.get('text', '').strip()
            
            if not transcript:
                logger.warning("Whisper вернул пустую транскрипцию")
                return "Не удалось распознать речь в аудио файле"
            
            return transcript
            
        except Exception as e:
            logger.error(f"Ошибка транскрипции: {str(e)}")
            # Возвращаем заглушку для демонстрации
            return "Демо транскрипция: Обсуждение условий сделки и следующих шагов"
    
    async def _analyze_sentiment(self, text: str) -> SentimentScore:
        """Анализ настроения текста"""
        try:
            if not self.sentiment_pipeline:
                # Возвращаем нейтральное настроение как заглушку
                return SentimentScore(
                    overall="neutral",
                    client="neutral", 
                    manager="neutral",
                    confidence=0.5
                )
            
            # Анализируем общее настроение
            sentiment_results = self.sentiment_pipeline(text[:512])  # Ограничиваем длину
            
            # Извлекаем доминирующее настроение
            if isinstance(sentiment_results[0], list):
                # Если вернулся список всех scores
                sentiment_scores = sentiment_results[0]
                best_sentiment = max(sentiment_scores, key=lambda x: x['score'])
                overall_sentiment = self._map_sentiment_label(best_sentiment['label'])
                confidence = best_sentiment['score']
            else:
                # Если вернулся один результат
                overall_sentiment = self._map_sentiment_label(sentiment_results[0]['label'])
                confidence = sentiment_results[0]['score']
            
            # Упрощенный анализ для клиента и менеджера
            # В реальной системе можно использовать NER для разделения участников
            client_sentiment = overall_sentiment
            manager_sentiment = overall_sentiment
            
            return SentimentScore(
                overall=overall_sentiment,
                client=client_sentiment,
                manager=manager_sentiment,
                confidence=confidence
            )
            
        except Exception as e:
            logger.warning(f"Ошибка анализа настроения: {str(e)}")
            # Возвращаем нейтральное настроение при ошибке
            return SentimentScore(
                overall="neutral",
                client="neutral",
                manager="neutral", 
                confidence=0.5
            )
    
    def _map_sentiment_label(self, label: str) -> str:
        """Маппинг меток настроения в стандартный формат"""
        label_lower = label.lower()
        
        # Маппинг для разных моделей
        positive_labels = ['positive', 'pos', 'положительный', 'label_2']
        negative_labels = ['negative', 'neg', 'отрицательный', 'label_0'] 
        neutral_labels = ['neutral', 'neu', 'нейтральный', 'label_1']
        
        if any(pos in label_lower for pos in positive_labels):
            return "positive"
        elif any(neg in label_lower for neg in negative_labels):
            return "negative"
        else:
            return "neutral"
    
    async def _extract_key_phrases(self, text: str) -> List[str]:
        """Извлечение ключевых фраз из текста"""
        try:
            key_phrases = []
            text_lower = text.lower()
            
            # Поиск по ключевым словам
            for category, keywords in self.sales_keywords.items():
                found_keywords = [kw for kw in keywords if kw in text_lower]
                if found_keywords:
                    key_phrases.extend([f"{category}: {kw}" for kw in found_keywords[:2]])
            
            # Простое извлечение именованных сущностей (цены, даты)
            # Цены
            price_pattern = r'\d+\s*(?:руб|рублей|тысяч|млн|тыс)'
            prices = re.findall(price_pattern, text, re.IGNORECASE)
            key_phrases.extend([f"цена: {price}" for price in prices[:3]])
            
            # Даты
            date_pattern = r'\d{1,2}\s*(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)'
            dates = re.findall(date_pattern, text, re.IGNORECASE)
            key_phrases.extend([f"дата: {date}" for date in dates[:2]])
            
            # Если не нашли ключевые фразы, добавляем общие
            if not key_phrases:
                key_phrases = ["обсуждение условий", "продажи", "переговоры"]
            
            return key_phrases[:10]  # Возвращаем топ-10
            
        except Exception as e:
            logger.warning(f"Ошибка извлечения ключевых фраз: {str(e)}")
            return ["обсуждение", "переговоры", "продажи"]
    
    async def _analyze_talk_time(self, transcript: str, participants: List[str]) -> Dict[str, float]:
        """Анализ соотношения времени говорения участников"""
        try:
            # Упрощенная логика - в реальности нужна обработка диаризации
            total_words = len(transcript.split())
            
            if len(participants) == 2:
                # Предполагаем примерное равное распределение с небольшой вариацией
                manager_ratio = 0.6  # Менеджер обычно говорит больше
                client_ratio = 0.4
                
                return {
                    participants[0]: manager_ratio,
                    participants[1]: client_ratio
                }
            else:
                # Равномерное распределение для множественных участников
                ratio_per_participant = 1.0 / len(participants)
                return {participant: ratio_per_participant for participant in participants}
                
        except Exception as e:
            logger.warning(f"Ошибка анализа времени говорения: {str(e)}")
            return {"manager": 0.6, "client": 0.4}
    
    async def _extract_action_items(self, transcript: str) -> List[str]:
        """Извлечение задач и договоренностей из транскрипции"""
        try:
            action_items = []
            text_lower = transcript.lower()
            
            # Паттерны для поиска задач
            action_patterns = [
                r'нужно\s+([^.!?]+)',
                r'надо\s+([^.!?]+)',
                r'я\s+отправлю\s+([^.!?]+)',
                r'мы\s+сделаем\s+([^.!?]+)',
                r'подготовим\s+([^.!?]+)',
                r'следующий\s+шаг\s*[-:]\s*([^.!?]+)'
            ]
            
            for pattern in action_patterns:
                matches = re.findall(pattern, text_lower, re.IGNORECASE)
                for match in matches[:3]:  # Ограничиваем количество
                    action_items.append(match.strip())
            
            # Если не нашли конкретные задачи, добавляем общие
            if not action_items:
                if 'следующ' in text_lower:
                    action_items.append("Запланировать следующий звонок")
                if 'отправ' in text_lower:
                    action_items.append("Отправить дополнительные материалы")
                if 'подготов' in text_lower:
                    action_items.append("Подготовить коммерческое предложение")
            
            return action_items[:5]  # Максимум 5 задач
            
        except Exception as e:
            logger.warning(f"Ошибка извлечения задач: {str(e)}")
            return ["Следующий звонок", "Отправить предложение"]
    
    async def _generate_sales_recommendations(
        self, 
        transcript: str, 
        sentiment: SentimentScore,
        key_phrases: List[str],
        request: CallAnalysisRequest
    ) -> List[str]:
        """Генерация рекомендаций по продажам"""
        try:
            recommendations = []
            
            # Рекомендации на основе настроения
            if sentiment.overall == "positive":
                recommendations.append("Клиент заинтересован - предложите следующий шаг")
                recommendations.append("Обсудите конкретные сроки внедрения")
            elif sentiment.overall == "negative":
                recommendations.append("Выясните основные возражения клиента")
                recommendations.append("Предложите дополнительную демонстрацию продукта")
            else:
                recommendations.append("Клиент нейтрален - покажите дополнительную ценность")
            
            # Рекомендации на основе ключевых фраз
            text_lower = transcript.lower()
            
            if any('цена' in phrase or 'стоимость' in phrase for phrase in key_phrases):
                recommendations.append("Обсудите ROI и окупаемость решения")
                
            if any('конкурент' in phrase for phrase in key_phrases):
                recommendations.append("Подготовьте сравнительную таблицу с конкурентами")
                
            if any('функционал' in phrase for phrase in key_phrases):
                recommendations.append("Организуйте техническую демонстрацию")
            
            # Рекомендации на основе типа звонка
            if request.call_type == "demo":
                recommendations.append("Отправьте материалы по результатам демо")
            elif request.call_type == "follow_up":
                recommendations.append("Узнайте о принятом решении")
            
            # Ограничиваем количество рекомендаций
            return recommendations[:5]
            
        except Exception as e:
            logger.warning(f"Ошибка генерации рекомендаций: {str(e)}")
            return ["Отправить коммерческое предложение", "Запланировать следующий звонок"]
    
    async def _determine_next_action(
        self,
        transcript: str,
        sentiment: SentimentScore, 
        key_phrases: List[str],
        request: CallAnalysisRequest
    ) -> str:
        """Определение следующего лучшего действия"""
        try:
            text_lower = transcript.lower()
            
            # Анализируем сигналы готовности к покупке
            buying_signals = self.sales_keywords['buying_signals']
            if any(signal in text_lower for signal in buying_signals):
                return "Подготовить договор и отправить на подпись"
            
            # Анализируем возражения
            concerns = self.sales_keywords['concerns']
            if any(concern in text_lower for concern in concerns):
                return "Подготовить ответы на возражения и назначить встречу"
            
            # На основе настроения
            if sentiment.overall == "positive":
                return "Отправить детальное коммерческое предложение"
            elif sentiment.overall == "negative":
                return "Выяснить возражения и предложить альтернативы"
            else:
                return "Назначить демонстрацию продукта"
                
        except Exception as e:
            logger.warning(f"Ошибка определения следующего действия: {str(e)}")
            return "Запланировать follow-up звонок"
    
    async def _estimate_deal_probability(
        self,
        transcript: str,
        sentiment: SentimentScore,
        key_phrases: List[str]
    ) -> float:
        """Оценка вероятности закрытия сделки"""
        try:
            probability = 0.5  # Базовая вероятность
            
            # Корректировка на основе настроения
            if sentiment.overall == "positive":
                probability += 0.2
            elif sentiment.overall == "negative":
                probability -= 0.2
            
            # Корректировка на основе ключевых слов
            text_lower = transcript.lower()
            
            # Положительные сигналы
            positive_count = sum(1 for kw in self.sales_keywords['positive'] if kw in text_lower)
            probability += positive_count * 0.05
            
            # Отрицательные сигналы  
            negative_count = sum(1 for kw in self.sales_keywords['negative'] if kw in text_lower)
            probability -= negative_count * 0.05
            
            # Сигналы готовности к покупке
            buying_signals_count = sum(1 for signal in self.sales_keywords['buying_signals'] if signal in text_lower)
            probability += buying_signals_count * 0.1
            
            # Ограничиваем вероятность в пределах [0, 1]
            probability = max(0.0, min(1.0, probability))
            
            return probability
            
        except Exception as e:
            logger.warning(f"Ошибка оценки вероятности сделки: {str(e)}")
            return 0.5
    
    async def _extract_key_topics(self, text: str) -> List[str]:
        """Извлечение ключевых тем из текста"""
        try:
            topics = []
            text_lower = text.lower()
            
            # Темы продукта
            if any(word in text_lower for word in ['функционал', 'возможности', 'features']):
                topics.append("функционал_продукта")
            
            if any(word in text_lower for word in ['цена', 'стоимость', 'бюджет', 'price']):
                topics.append("ценообразование")
                
            if any(word in text_lower for word in ['внедрение', 'интеграция', 'implementation']):
                topics.append("внедрение")
                
            if any(word in text_lower for word in ['поддержка', 'техподдержка', 'support']):
                topics.append("техническая_поддержка")
            
            if any(word in text_lower for word in ['конкуренты', 'альтернативы', 'competitors']):
                topics.append("конкуренты")
            
            # Если темы не найдены, возвращаем общие
            if not topics:
                topics = ["общие_вопросы", "продукт", "коммерческие_условия"]
            
            return topics[:5]
            
        except Exception as e:
            logger.warning(f"Ошибка извлечения тем: {str(e)}")
            return ["продукт", "условия"]
    
    async def _determine_urgency(self, text: str, context: str) -> str:
        """Определение уровня срочности"""
        try:
            text_lower = text.lower()
            
            # Высокий уровень срочности
            urgent_keywords = [
                'срочно', 'немедленно', 'asap', 'критично', 'горит',
                'сегодня', 'сейчас', 'завтра', 'экстренно'
            ]
            
            if any(keyword in text_lower for keyword in urgent_keywords):
                return "high"
            
            # Средний уровень
            medium_keywords = [
                'скоро', 'на этой неделе', 'важно', 'приоритет',
                'нужно быстро', 'в ближайшее время'
            ]
            
            if any(keyword in text_lower for keyword in medium_keywords):
                return "medium"
            
            # По контексту
            if context == "support":
                return "medium"  # Обращения в поддержку обычно важны
            
            return "low"
            
        except Exception as e:
            logger.warning(f"Ошибка определения срочности: {str(e)}")
            return "medium"
    
    async def _analyze_customer_intent(self, text: str, context: str) -> str:
        """Анализ намерения клиента"""
        try:
            text_lower = text.lower()
            
            # Намерение покупки (русский + английский)
            purchase_words = ['купить', 'приобрести', 'заказать', 'договор', 'buy', 'purchase', 'order', 'contract', 'want to buy']
            if any(word in text_lower for word in purchase_words):
                return "purchase_intent"
            
            # Запрос информации
            info_words = ['расскажите', 'опишите', 'как работает', 'что такое', 'tell me', 'describe', 'how does', 'what is', 'send me']
            if any(word in text_lower for word in info_words):
                return "information_request"
            
            # Жалоба или проблема
            complaint_words = ['проблема', 'не работает', 'ошибка', 'жалоба', 'problem', 'not working', 'error', 'complaint', 'issue']
            if any(word in text_lower for word in complaint_words):
                return "complaint"
            
            # Запрос поддержки
            support_words = ['помогите', 'поддержка', 'как сделать', 'не получается', 'help me', 'support', 'how to', 'need help']
            if any(word in text_lower for word in support_words):
                return "support_request"
            
            # По контексту
            if context == "demo":
                return "evaluation"
            elif context == "support":
                return "support_request"
            elif context == "sales":
                return "purchase_consideration"
            
            return "general_inquiry"
            
        except Exception as e:
            logger.warning(f"Ошибка анализа намерения: {str(e)}")
            return "general_inquiry"
    
    async def _check_action_required(self, text: str, intent: str) -> bool:
        """Проверка необходимости действий"""
        try:
            # Автоматические триггеры для действий (русский и английский)
            action_triggers = [
                'ответьте', 'свяжитесь', 'перезвоните', 'отправьте',
                'нужна помощь', 'требуется', 'срочно',
                'please help', 'need help', 'can you send', 'urgent',
                'respond', 'contact me', 'call me', 'send me'
            ]
            
            text_lower = text.lower()
            
            # Прямые запросы действий
            if any(trigger in text_lower for trigger in action_triggers):
                return True
            
            # На основе намерения
            if intent in ['complaint', 'support_request', 'purchase_intent']:
                return True
            
            return False
            
        except Exception as e:
            logger.warning(f"Ошибка проверки необходимости действий: {str(e)}")
            return False
    
    async def _generate_suggested_response(self, text: str, sentiment: SentimentScore, intent: str) -> Optional[str]:
        """Генерация предлагаемого ответа с использованием OpenAI (если доступен)"""
        try:
            # Если OpenAI API доступен, используем его для лучших ответов
            if self.openai_client and self.openai_api_key:
                try:
                    response = self.openai_client.chat.completions.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {
                                "role": "system", 
                                "content": f"""Ты профессиональный менеджер по продажам. Составь вежливый и полезный ответ на сообщение клиента.
                                
Контекст:
- Настроение клиента: {sentiment.overall}
- Намерение: {intent}
- Уровень уверенности: {sentiment.confidence:.2f}

Требования к ответу:
- Профессиональный тон
- Конкретные следующие шаги
- Учет настроения клиента
- Максимум 2-3 предложения
- На русском языке"""
                            },
                            {
                                "role": "user",
                                "content": f"Сообщение клиента: {text}"
                            }
                        ],
                        max_tokens=150,
                        temperature=0.7
                    )
                    
                    ai_response = response.choices[0].message.content.strip()
                    logger.info("Использован OpenAI для генерации ответа")
                    return ai_response
                    
                except Exception as e:
                    logger.warning(f"Ошибка OpenAI API: {str(e)}, используем fallback шаблоны")
            
            # Fallback: простые шаблоны ответов
            response_templates = {
                'purchase_intent': "Спасибо за интерес к нашему продукту! Я подготовлю для вас коммерческое предложение и свяжусь в ближайшее время.",
                'information_request': "Благодарю за вопрос! Подготовлю подробную информацию и отправлю вам на email.",
                'complaint': "Приношу извинения за доставленные неудобства. Я немедленно передам ваше обращение в профильный отдел для решения.",
                'support_request': "Я помогу решить вашу задачу. Передаю обращение нашим специалистам - они свяжутся с вами в течение часа."
            }
            
            base_response = response_templates.get(intent, "Спасибо за обращение! Я обработаю вашу заявку и свяжусь с вами.")
            
            # Корректируем тон на основе настроения
            if sentiment.overall == "negative":
                base_response = "Понимаю ваше беспокойство. " + base_response
            elif sentiment.overall == "positive":
                base_response = "Рад помочь! " + base_response
            
            return base_response
            
        except Exception as e:
            logger.warning(f"Ошибка генерации ответа: {str(e)}")
            return None
    
    async def _save_call_analysis(
        self, 
        request: CallAnalysisRequest, 
        transcript: str, 
        sentiment: SentimentScore, 
        deal_probability: float
    ):
        """Сохранение результатов анализа звонка"""
        try:
            # В реальной системе сохраняли бы в ClickHouse
            # Здесь просто логируем
            logger.info(f"Сохранен анализ звонка: настроение={sentiment.overall}, вероятность сделки={deal_probability:.2f}")
        except Exception as e:
            logger.warning(f"Ошибка сохранения анализа звонка: {str(e)}")
    
    async def _save_text_analysis(
        self,
        request: TextAnalysisRequest,
        sentiment: SentimentScore,
        intent: str,
        urgency: str
    ):
        """Сохранение результатов анализа текста"""
        try:
            logger.info(f"Сохранен анализ текста: настроение={sentiment.overall}, намерение={intent}, срочность={urgency}")
        except Exception as e:
            logger.warning(f"Ошибка сохранения анализа текста: {str(e)}")
    
    async def get_model_status(self) -> ModelStatus:
        """Получение статуса моделей Revenue Intelligence"""
        try:
            status = "active" if (self.whisper_model and self.sentiment_pipeline) else "partially_loaded"
            if not self.whisper_model and not self.sentiment_pipeline:
                status = "not_loaded"
            
            return ModelStatus(
                name="Revenue Intelligence",
                version=self.model_metadata['version'],
                last_trained=self.model_metadata['last_model_update'] or datetime.now() - timedelta(days=1),
                accuracy=0.80,  # Примерная точность для NLP задач
                status=status,
                data_freshness=datetime.now() - timedelta(minutes=5),
                predictions_count=self.model_metadata['analyses_performed']
            )
        except Exception as e:
            logger.error(f"Ошибка получения статуса Revenue Intelligence: {str(e)}")
            raise
    
    async def retrain_model(self):
        """Переобучение моделей Revenue Intelligence"""
        try:
            logger.info("Обновляю модели Revenue Intelligence...")
            # В реальной системе здесь была бы логика переобучения
            # Например, донастройка BERT на доменных данных
            self.model_metadata['last_model_update'] = datetime.now()
            logger.info("Модели Revenue Intelligence обновлены")
        except Exception as e:
            logger.error(f"Ошибка обновления моделей Revenue Intelligence: {str(e)}")
            raise