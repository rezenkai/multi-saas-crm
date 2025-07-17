"""
Dashboard API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from datetime import datetime, timedelta
from typing import List, Dict, Any

from ...core.database import get_db
from ...core.deps import get_current_active_user
from ...models.contact import Contact
from ...models.company import Company
from ...models.opportunity import Opportunity
from ...schemas.auth import AuthUserResponse

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    current_user: AuthUserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получить общую статистику для дашборда
    """
    try:
        # Базовые подсчеты
        total_contacts = db.query(Contact).filter(
            and_(
                Contact.tenant_id == tenant_id,
                Contact.is_active == True
            )
        ).count()
        
        total_companies = db.query(Company).filter(
            and_(
                Company.tenant_id == tenant_id,
                Company.is_active == True
            )
        ).count()
        
        total_opportunities = db.query(Opportunity).filter(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.is_active == True
            )
        ).count()
        
        # Подсчет выручки
        total_revenue = db.query(func.coalesce(func.sum(Opportunity.amount), 0)).filter(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.is_won == True,
                Opportunity.is_active == True
            )
        ).scalar() or 0
        
        # Подсчет открытых сделок
        open_deals = db.query(Opportunity).filter(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.is_closed == False,
                Opportunity.is_active == True
            )
        ).count()
        
        # Подсчет выигранных сделок
        won_deals = db.query(Opportunity).filter(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.is_won == True,
                Opportunity.is_active == True
            )
        ).count()
        
        # Конверсия
        conversion_rate = (won_deals / total_opportunities * 100) if total_opportunities > 0 else 0
        
        return {
            "total_contacts": total_contacts,
            "total_companies": total_companies,
            "total_opportunities": total_opportunities,
            "total_revenue": float(total_revenue),
            "open_deals": open_deals,
            "won_deals": won_deals,
            "conversion_rate": round(conversion_rate, 2)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения статистики: {str(e)}")


@router.get("/revenue-chart")
async def get_revenue_chart(
    current_user: AuthUserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получить данные для графика выручки по месяцам
    """
    try:
        # Получаем данные за последние 12 месяцев
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        
        # Группируем по месяцам
        monthly_revenue = db.query(
            extract('year', Opportunity.actual_close_date).label('year'),
            extract('month', Opportunity.actual_close_date).label('month'),
            func.coalesce(func.sum(Opportunity.amount), 0).label('revenue')
        ).filter(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.is_won == True,
                Opportunity.actual_close_date.between(start_date, end_date),
                Opportunity.is_active == True
            )
        ).group_by(
            extract('year', Opportunity.actual_close_date),
            extract('month', Opportunity.actual_close_date)
        ).order_by(
            extract('year', Opportunity.actual_close_date),
            extract('month', Opportunity.actual_close_date)
        ).all()
        
        # Формируем данные для графика
        months = [
            'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
            'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
        ]
        
        chart_data = []
        for revenue_data in monthly_revenue:
            month_name = months[int(revenue_data.month) - 1]
            chart_data.append({
                "month": f"{month_name} {int(revenue_data.year)}",
                "revenue": float(revenue_data.revenue)
            })
        
        return {"chart_data": chart_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных графика: {str(e)}")


@router.get("/recent-activities")
async def get_recent_activities(
    current_user: AuthUserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получить последние активности
    """
    try:
        # Получаем последние созданные записи
        recent_contacts = db.query(Contact).filter(
            and_(
                Contact.tenant_id == tenant_id,
                Contact.is_active == True
            )
        ).order_by(Contact.created_at.desc()).limit(5).all()
        
        recent_companies = db.query(Company).filter(
            and_(
                Company.tenant_id == tenant_id,
                Company.is_active == True
            )
        ).order_by(Company.created_at.desc()).limit(5).all()
        
        recent_opportunities = db.query(Opportunity).filter(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.is_active == True
            )
        ).order_by(Opportunity.created_at.desc()).limit(5).all()
        
        activities = []
        
        # Добавляем контакты
        for contact in recent_contacts:
            activities.append({
                "id": str(contact.id),
                "type": "contact",
                "title": f"Создан контакт: {contact.first_name} {contact.last_name}",
                "description": f"Email: {contact.email}",
                "created_at": contact.created_at.isoformat(),
                "owner": getattr(contact, 'owner_name', 'Unknown')
            })
        
        # Добавляем компании
        for company in recent_companies:
            activities.append({
                "id": str(company.id),
                "type": "company",
                "title": f"Создана компания: {company.name}",
                "description": f"Отрасль: {company.industry}",
                "created_at": company.created_at.isoformat(),
                "owner": getattr(company, 'owner_name', 'Unknown')
            })
        
        # Добавляем сделки
        for opportunity in recent_opportunities:
            activities.append({
                "id": str(opportunity.id),
                "type": "opportunity",
                "title": f"Создана сделка: {opportunity.name}",
                "description": f"Сумма: ${opportunity.amount}",
                "created_at": opportunity.created_at.isoformat(),
                "owner": getattr(opportunity, 'owner_name', 'Unknown')
            })
        
        # Сортируем по дате создания
        activities.sort(key=lambda x: x['created_at'], reverse=True)
        
        return {"activities": activities[:10]}  # Возвращаем последние 10
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения активностей: {str(e)}")


@router.get("/top-opportunities")
async def get_top_opportunities(
    current_user: AuthUserResponse = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получить топ сделки по сумме
    """
    try:
        top_opportunities = db.query(Opportunity).filter(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.is_active == True,
                Opportunity.is_closed == False
            )
        ).order_by(Opportunity.amount.desc()).limit(5).all()
        
        opportunities_data = []
        for opp in top_opportunities:
            opportunities_data.append({
                "id": str(opp.id),
                "name": opp.name,
                "amount": float(opp.amount),
                "stage": opp.stage,
                "probability": opp.probability,
                "expected_revenue": float(opp.expected_revenue) if opp.expected_revenue else 0,
                "close_date": opp.close_date.isoformat() if opp.close_date else None,
                "owner": getattr(opp, 'owner_name', 'Unknown'),
                "company_name": getattr(opp, 'company_name', 'Unknown')
            })
        
        return {"opportunities": opportunities_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения топ сделок: {str(e)}")