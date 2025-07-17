"""
Email service для отправки уведомлений
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from pathlib import Path
import aiosmtplib
import asyncio

from ..core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Сервис для отправки email уведомлений"""
    
    @staticmethod
    async def send_email(
        to_emails: List[str],
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        from_email: Optional[str] = None
    ) -> bool:
        """
        Отправка email
        
        Args:
            to_emails: Список email адресов получателей
            subject: Тема письма
            body: Текст письма
            html_body: HTML версия письма (опционально)
            from_email: Email отправителя (по умолчанию из настроек)
        
        Returns:
            bool: True если отправка успешна
        """
        if not settings.SMTP_HOST or not settings.SMTP_USER:
            logger.warning("SMTP not configured, skipping email send")
            return False
        
        try:
            # Создаем сообщение
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = from_email or settings.SMTP_USER
            message["To"] = ", ".join(to_emails)
            
            # Добавляем текстовую версию
            text_part = MIMEText(body, "plain", "utf-8")
            message.attach(text_part)
            
            # Добавляем HTML версию если есть
            if html_body:
                html_part = MIMEText(html_body, "html", "utf-8")
                message.attach(html_part)
            
            # Отправляем через aiosmtplib
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                start_tls=settings.SMTP_TLS,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
            )
            
            logger.info(f"Email sent successfully to {to_emails}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    @staticmethod
    async def send_verification_email(email: str, token: str, user_name: str) -> bool:
        """
        Отправка email подтверждения
        """
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        
        subject = "Подтверждение email адреса"
        
        text_body = f"""
Здравствуйте, {user_name}!

Для завершения регистрации подтвердите ваш email адрес, перейдя по ссылке:
{verification_url}

Если вы не регистрировались на нашем сайте, проигнорируйте это сообщение.

С уважением,
Команда Salesforce Clone
        """
        
        html_body = f"""
        <html>
        <body>
            <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                <h2 style="color: #333;">Подтверждение email адреса</h2>
                <p>Здравствуйте, <strong>{user_name}</strong>!</p>
                <p>Для завершения регистрации подтвердите ваш email адрес:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" 
                       style="background-color: #4F46E5; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 6px; display: inline-block;">
                        Подтвердить email
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
                    <a href="{verification_url}">{verification_url}</a>
                </p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">
                    Если вы не регистрировались на нашем сайте, проигнорируйте это сообщение.
                </p>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email([email], subject, text_body, html_body)
    
    @staticmethod
    async def send_password_reset_email(email: str, token: str, user_name: str) -> bool:
        """
        Отправка email для сброса пароля
        """
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        subject = "Сброс пароля"
        
        text_body = f"""
Здравствуйте, {user_name}!

Вы запросили сброс пароля. Для создания нового пароля перейдите по ссылке:
{reset_url}

Ссылка действительна в течение 1 часа.

Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.

С уважением,
Команда Salesforce Clone
        """
        
        html_body = f"""
        <html>
        <body>
            <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                <h2 style="color: #333;">Сброс пароля</h2>
                <p>Здравствуйте, <strong>{user_name}</strong>!</p>
                <p>Вы запросили сброс пароля. Для создания нового пароля нажмите кнопку:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" 
                       style="background-color: #DC2626; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 6px; display: inline-block;">
                        Сбросить пароль
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                    Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
                    <a href="{reset_url}">{reset_url}</a>
                </p>
                <p style="color: #f59e0b; font-size: 14px;">
                    ⚠️ Ссылка действительна в течение 1 часа.
                </p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">
                    Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.
                </p>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email([email], subject, text_body, html_body)
    
    @staticmethod
    async def send_welcome_email(email: str, user_name: str, tenant_name: str) -> bool:
        """
        Отправка приветственного email
        """
        subject = f"Добро пожаловать в {tenant_name}!"
        
        text_body = f"""
Здравствуйте, {user_name}!

Добро пожаловать в CRM систему {tenant_name}!

Ваш аккаунт успешно создан и подтвержден. Теперь вы можете:
- Управлять контактами
- Отслеживать сделки
- Анализировать продажи
- Работать с компаниями

Начните работу: {settings.FRONTEND_URL}/dashboard

С уважением,
Команда Salesforce Clone
        """
        
        html_body = f"""
        <html>
        <body>
            <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                <h2 style="color: #10B981;">Добро пожаловать в {tenant_name}!</h2>
                <p>Здравствуйте, <strong>{user_name}</strong>!</p>
                <p>Ваш аккаунт успешно создан и подтвержден. Теперь вы можете:</p>
                <ul style="color: #374151; line-height: 1.6;">
                    <li>👥 Управлять контактами</li>
                    <li>💼 Отслеживать сделки</li>
                    <li>📊 Анализировать продажи</li>
                    <li>🏢 Работать с компаниями</li>
                </ul>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{settings.FRONTEND_URL}/dashboard" 
                       style="background-color: #10B981; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 6px; display: inline-block;">
                        Начать работу
                    </a>
                </div>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">
                    С уважением,<br>
                    Команда Salesforce Clone
                </p>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email([email], subject, text_body, html_body)
    
    @staticmethod
    async def send_notification_email(
        email: str, 
        user_name: str, 
        notification_type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None
    ) -> bool:
        """
        Отправка уведомления
        """
        subject = f"Уведомление: {title}"
        
        text_body = f"""
Здравствуйте, {user_name}!

{notification_type}: {title}

{message}

{f'Подробнее: {action_url}' if action_url else ''}

С уважением,
Команда Salesforce Clone
        """
        
        html_body = f"""
        <html>
        <body>
            <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                <h2 style="color: #333;">Уведомление</h2>
                <p>Здравствуйте, <strong>{user_name}</strong>!</p>
                <div style="background-color: #F3F4F6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 8px 0; color: #1F2937;">{notification_type}</h3>
                    <h4 style="margin: 0 0 8px 0; color: #4B5563;">{title}</h4>
                    <p style="margin: 0; color: #6B7280;">{message}</p>
                </div>
                {f'''
                <div style="text-align: center; margin: 20px 0;">
                    <a href="{action_url}" 
                       style="background-color: #3B82F6; color: white; padding: 10px 20px; 
                              text-decoration: none; border-radius: 6px; display: inline-block;">
                        Подробнее
                    </a>
                </div>
                ''' if action_url else ''}
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">
                    С уважением,<br>
                    Команда Salesforce Clone
                </p>
            </div>
        </body>
        </html>
        """
        
        return await EmailService.send_email([email], subject, text_body, html_body)
    @staticmethod
    async def send_opportunity_notification(
        recipient_email: str, 
        opportunity_name: str,
        stage: str,
        amount: float,
        user_name: str,
        action: str = "created",
        old_stage: str = None
    ):
        """
        Отправка уведомления о сделке
        """
        if action == "created":
            subject = f"Новая сделка создана: {opportunity_name}"
            action_text = "создана"
        elif action == "stage_changed":
            subject = f"Изменение стадии сделки: {opportunity_name}"
            action_text = f"изменена стадия с '{old_stage}' на '{stage}'"
        else:
            subject = f"Обновление сделки: {opportunity_name}"
            action_text = "обновлена"
        
        formatted_amount = f"${amount:,.2f}" if amount else "Не указана"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #28a745; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background: #f9f9f9; }}
                .opportunity-details {{ background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                .footer {{ padding: 20px; text-align: center; color: #666; font-size: 12px; }}
                .button {{ display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🤝 Уведомление о сделке</h1>
                </div>
                <div class="content">
                    <p>Здравствуйте, {user_name}\!</p>
                    <p>Сделка <strong>"{opportunity_name}"</strong> была {action_text}.</p>
                    
                    <div class="opportunity-details">
                        <h3>Детали сделки:</h3>
                        <p><strong>Название:</strong> {opportunity_name}</p>
                        <p><strong>Текущая стадия:</strong> {stage}</p>
                        <p><strong>Сумма:</strong> {formatted_amount}</p>
                        <p><strong>Дата:</strong> {EmailService._get_current_datetime()}</p>
                    </div>
                    
                    <p>Для просмотра подробной информации о сделке, перейдите в CRM систему:</p>
                    <a href="http://localhost:3000/opportunities" class="button">
                        Открыть сделки
                    </a>
                </div>
                <div class="footer">
                    <p>С уважением,<br>CRM система</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Здравствуйте, {user_name}\!
        
        Сделка "{opportunity_name}" была {action_text}.
        
        Детали сделки:
        - Название: {opportunity_name}
        - Текущая стадия: {stage}
        - Сумма: {formatted_amount}
        - Дата: {EmailService._get_current_datetime()}
        
        Для просмотра подробной информации перейдите:
        http://localhost:3000/opportunities
        
        С уважением,
        CRM система
        """
        
        await EmailService.send_email(
            [recipient_email],
            subject,
            text_content,
            html_content
        )

    @staticmethod
    def _get_current_datetime():
        """Получение текущей даты и времени в читаемом формате"""
        from datetime import datetime
        return datetime.now().strftime("%d.%m.%Y %H:%M")
