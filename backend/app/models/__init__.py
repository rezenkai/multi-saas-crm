"""
Модели для CRM системы
"""

# Импортируем модели в правильном порядке для избежания циклических зависимостей
from .tenant import Tenant, TenantUser  
from .user import User, UserProfile, UserSession
from .token import VerificationToken, EmailLog
from .contact import Contact, ContactNote
from .company import Company, CompanyNote  
from .opportunity import Opportunity, OpportunityActivity

__all__ = [
    "Tenant",
    "TenantUser", 
    "User",
    "UserProfile",
    "UserSession",
    "VerificationToken",
    "EmailLog",
    "Contact",
    "ContactNote",
    "Company", 
    "CompanyNote",
    "Opportunity",
    "OpportunityActivity",
]