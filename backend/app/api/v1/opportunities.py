"""
API для работы со сделками (opportunities)
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from decimal import Decimal

from ...core.database import get_db
from ...core.deps import get_current_user, get_current_tenant_id
from ...models.user import User
from ...schemas.auth import AuthUserResponse
from ...models.opportunity import Opportunity, OpportunityActivity, OpportunityStage
from ...schemas.opportunity import (
    OpportunityCreate,
    OpportunityUpdate,
    OpportunityResponse,
    OpportunityListResponse,
    OpportunityKanbanResponse,
    OpportunityActivityCreate,
    OpportunityActivityUpdate,
    OpportunityActivityResponse,
    OpportunityStats
)
from ...services.email import EmailService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def convert_opportunity_to_response(opportunity: Opportunity, owner_name: str = None) -> OpportunityResponse:
    """Конвертирует объект Opportunity в OpportunityResponse с правильными типами"""
    return OpportunityResponse(
        id=str(opportunity.id),
        tenant_id=str(opportunity.tenant_id),
        owner_id=str(opportunity.owner_id),
        company_id=str(opportunity.company_id) if opportunity.company_id else None,
        contact_id=str(opportunity.contact_id) if opportunity.contact_id else None,
        name=opportunity.name,
        description=opportunity.description,
        stage=opportunity.stage,
        opportunity_type=opportunity.opportunity_type,
        lead_source=opportunity.lead_source,
        amount=opportunity.amount,
        probability=opportunity.probability,
        expected_revenue=opportunity.expected_revenue,
        close_date=opportunity.close_date,
        actual_close_date=opportunity.actual_close_date,
        next_step=opportunity.next_step,
        notes=opportunity.notes,
        is_active=opportunity.is_active,
        is_closed=opportunity.is_closed,
        is_won=opportunity.is_won,
        created_at=opportunity.created_at,
        updated_at=opportunity.updated_at,
        last_activity=opportunity.last_activity,
        owner_name=owner_name,
        company_name=None,  # TODO: добавить название компании
        contact_name=None,  # TODO: добавить имя контакта
        activities_count=0  # TODO: добавить подсчет активностей
    )


@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    opportunity_data: OpportunityCreate,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Создать новую сделку"""
    try:
        # Вычисляем ожидаемую выручку если не указана
        expected_revenue = opportunity_data.expected_revenue
        if opportunity_data.amount and opportunity_data.probability and not expected_revenue:
            expected_revenue = opportunity_data.amount * (Decimal(opportunity_data.probability) / Decimal(100))
        
        # Создаем сделку
        opportunity = Opportunity(
            **opportunity_data.model_dump(exclude={'expected_revenue'}),
            expected_revenue=expected_revenue,
            tenant_id=tenant_id,
            owner_id=str(current_user.id)
        )
        
        db.add(opportunity)
        db.commit()
        db.refresh(opportunity)
        
        # Отправляем email уведомление о создании сделки
        try:
            await EmailService.send_opportunity_notification(
                recipient_email=current_user.email,
                opportunity_name=opportunity.name,
                stage=opportunity.stage,
                amount=opportunity.amount,
                user_name=f"{current_user.first_name} {current_user.last_name}".strip(),
                action="created"
            )
            logger.info(f"Email notification sent for new opportunity: {opportunity.id}")
        except Exception as e:
            logger.error(f"Failed to send email notification for opportunity {opportunity.id}: {e}")
            # Не прерываем выполнение если email не отправился
        
        # Формируем ответ
        owner_name = f"{current_user.first_name} {current_user.last_name}".strip()
        return convert_opportunity_to_response(opportunity, owner_name)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания сделки: {str(e)}"
        )


@router.get("/", response_model=OpportunityListResponse)
async def get_opportunities(
    skip: int = Query(0, ge=0, description="Количество записей для пропуска"),
    limit: int = Query(100, ge=1, le=1000, description="Количество записей"),
    search: Optional[str] = Query(None, description="Поиск по названию или описанию"),
    stage: Optional[str] = Query(None, description="Фильтр по стадии"),
    opportunity_type: Optional[str] = Query(None, description="Фильтр по типу сделки"),
    is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
    is_closed: Optional[bool] = Query(None, description="Фильтр по закрытым сделкам"),
    company_id: Optional[str] = Query(None, description="Фильтр по компании"),
    contact_id: Optional[str] = Query(None, description="Фильтр по контакту"),
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить список сделок"""
    try:
        # Базовый запрос
        query = db.query(Opportunity).filter(
            Opportunity.id.isnot(None)
        )
        
        # Поиск
        if search:
            search_filter = or_(
                Opportunity.name.ilike(f"%{search}%"),
                Opportunity.description.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)
        
        # Фильтры
        if stage:
            query = query.filter(Opportunity.stage == stage)
        
        if opportunity_type:
            query = query.filter(Opportunity.opportunity_type == opportunity_type)
        
        if is_active is not None:
            query = query.filter(Opportunity.is_active == is_active)
        
        if is_closed is not None:
            query = query.filter(Opportunity.is_closed == is_closed)
        
        if company_id:
            query = query.filter(Opportunity.company_id == company_id)
        
        if contact_id:
            query = query.filter(Opportunity.contact_id == contact_id)
        
        # Общее количество
        total = query.count()
        
        # Пагинация
        opportunities = query.offset(skip).limit(limit).all()
        
        # Формируем ответ
        opportunities_response = []
        for opportunity in opportunities:
            opportunity_data = opportunity.__dict__.copy()
            opportunity_data["owner_name"] = None  # TODO: добавить связь с пользователем
            opportunity_data["company_name"] = None  # TODO: добавить связь с компанией
            opportunity_data["contact_name"] = None  # TODO: добавить связь с контактом
            opportunity_data["activities_count"] = 0  # TODO: добавить подсчет активностей
            opportunities_response.append(OpportunityResponse.model_validate(opportunity_data))
        
        pages = (total + limit - 1) // limit if limit > 0 else 1
        
        return OpportunityListResponse(
            opportunities=opportunities_response,
            total=total,
            page=(skip // limit) + 1,
            size=limit,
            pages=pages
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения списка сделок: {str(e)}"
        )


@router.get("/kanban", response_model=List[OpportunityKanbanResponse])
async def get_opportunities_kanban(
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить сделки для канбан-доски"""
    try:
        kanban_data = []
        
        # Получаем все стадии
        stages = list(OpportunityStage)
        
        for stage in stages:
            # Запрос для каждой стадии
            opportunities = db.query(Opportunity).filter(
                and_(
                    Opportunity.stage == stage,
                    Opportunity.is_active == True
                )
            ).all()
            
            # Формируем ответ для стадии
            opportunities_response = []
            for opportunity in opportunities:
                opportunities_response.append(convert_opportunity_to_response(opportunity))
            
            kanban_data.append(OpportunityKanbanResponse(
                stage=stage,
                opportunities=opportunities_response,
                total=len(opportunities_response)
            ))
        
        return kanban_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения канбан-доски: {str(e)}"
        )


@router.get("/stats", response_model=OpportunityStats)
async def get_opportunities_stats(
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить статистику по сделкам"""
    try:
        # Базовый фильтр по tenant
        base_filter = Opportunity.id.isnot(None)
        
        # Общая статистика
        total_opportunities = db.query(Opportunity).filter(base_filter).count()
        
        # Суммы
        total_amount_result = db.query(func.sum(Opportunity.amount)).filter(
            and_(base_filter, Opportunity.amount.isnot(None))
        ).scalar() or Decimal('0')
        
        total_expected_revenue_result = db.query(func.sum(Opportunity.expected_revenue)).filter(
            and_(base_filter, Opportunity.expected_revenue.isnot(None))
        ).scalar() or Decimal('0')
        
        # Выигранные сделки
        won_opportunities = db.query(Opportunity).filter(
            and_(base_filter, Opportunity.is_won == True)
        ).count()
        
        won_amount_result = db.query(func.sum(Opportunity.amount)).filter(
            and_(base_filter, Opportunity.is_won == True, Opportunity.amount.isnot(None))
        ).scalar() or Decimal('0')
        
        # Проигранные сделки
        lost_opportunities = db.query(Opportunity).filter(
            and_(base_filter, Opportunity.is_closed == True, Opportunity.is_won == False)
        ).count()
        
        lost_amount_result = db.query(func.sum(Opportunity.amount)).filter(
            and_(base_filter, Opportunity.is_closed == True, Opportunity.is_won == False, Opportunity.amount.isnot(None))
        ).scalar() or Decimal('0')
        
        # Активные сделки
        active_opportunities = db.query(Opportunity).filter(
            and_(base_filter, Opportunity.is_active == True, Opportunity.is_closed == False)
        ).count()
        
        active_amount_result = db.query(func.sum(Opportunity.amount)).filter(
            and_(base_filter, Opportunity.is_active == True, Opportunity.is_closed == False, Opportunity.amount.isnot(None))
        ).scalar() or Decimal('0')
        
        # Средние значения
        avg_probability_result = db.query(func.avg(Opportunity.probability)).filter(
            and_(base_filter, Opportunity.probability.isnot(None))
        ).scalar() or 0.0
        
        avg_deal_size_result = db.query(func.avg(Opportunity.amount)).filter(
            and_(base_filter, Opportunity.amount.isnot(None))
        ).scalar() or Decimal('0')
        
        # Процент конверсии
        conversion_rate = (won_opportunities / total_opportunities * 100) if total_opportunities > 0 else 0.0
        
        return OpportunityStats(
            total_opportunities=total_opportunities,
            total_amount=total_amount_result,
            total_expected_revenue=total_expected_revenue_result,
            won_opportunities=won_opportunities,
            won_amount=won_amount_result,
            lost_opportunities=lost_opportunities,
            lost_amount=lost_amount_result,
            active_opportunities=active_opportunities,
            active_amount=active_amount_result,
            avg_probability=float(avg_probability_result),
            avg_deal_size=avg_deal_size_result,
            conversion_rate=conversion_rate
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения статистики: {str(e)}"
        )


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
async def get_opportunity(
    opportunity_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить сделку по ID"""
    try:
        opportunity = db.query(Opportunity).filter(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.id.isnot(None)
            )
        ).first()
        
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сделка не найдена"
            )
        
        # Формируем ответ
        opportunity_data = opportunity.__dict__.copy()
        opportunity_data["owner_name"] = None  # TODO: добавить связь с пользователем
        opportunity_data["company_name"] = None  # TODO: добавить связь с компанией
        opportunity_data["contact_name"] = None  # TODO: добавить связь с контактом
        opportunity_data["activities_count"] = 0  # TODO: добавить подсчет активностей
        
        return OpportunityResponse.model_validate(opportunity_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения сделки: {str(e)}"
        )


@router.put("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: str,
    opportunity_data: OpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Обновить сделку"""
    try:
        opportunity = db.query(Opportunity).filter(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.id.isnot(None)
            )
        ).first()
        
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сделка не найдена"
            )
        
        # Обновляем только переданные поля
        update_data = opportunity_data.model_dump(exclude_unset=True)
        
        # Сохраняем старые значения для проверки изменений
        old_stage = opportunity.stage
        
        # Вычисляем ожидаемую выручку если изменились amount или probability
        if 'amount' in update_data or 'probability' in update_data:
            amount = update_data.get('amount', opportunity.amount)
            probability = update_data.get('probability', opportunity.probability)
            if amount and probability:
                update_data['expected_revenue'] = amount * (Decimal(probability) / Decimal(100))
        
        for field, value in update_data.items():
            setattr(opportunity, field, value)
        
        db.commit()
        db.refresh(opportunity)
        
        # Отправляем email уведомление если изменилась стадия сделки
        if 'stage' in update_data and old_stage != opportunity.stage:
            try:
                await EmailService.send_opportunity_notification(
                    recipient_email=current_user.email,
                    opportunity_name=opportunity.name,
                    stage=opportunity.stage,
                    amount=opportunity.amount,
                    user_name=f"{current_user.first_name} {current_user.last_name}".strip(),
                    action="stage_changed",
                    old_stage=old_stage
                )
                logger.info(f"Email notification sent for opportunity stage change: {opportunity.id}")
            except Exception as e:
                logger.error(f"Failed to send email notification for opportunity {opportunity.id}: {e}")
                # Не прерываем выполнение если email не отправился
        
        # Формируем ответ
        opportunity_response_data = opportunity.__dict__.copy()
        opportunity_response_data["owner_name"] = None  # TODO: добавить связь с пользователем
        opportunity_response_data["company_name"] = None  # TODO: добавить связь с компанией
        opportunity_response_data["contact_name"] = None  # TODO: добавить связь с контактом
        opportunity_response_data["activities_count"] = 0  # TODO: добавить подсчет активностей
        
        return OpportunityResponse.model_validate(opportunity_response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обновления сделки: {str(e)}"
        )


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opportunity_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Удалить сделку"""
    try:
        opportunity = db.query(Opportunity).filter(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.id.isnot(None)
            )
        ).first()
        
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сделка не найдена"
            )
        
        db.delete(opportunity)
        db.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка удаления сделки: {str(e)}"
        )


# API для активностей по сделкам
@router.post("/{opportunity_id}/activities", response_model=OpportunityActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity_activity(
    opportunity_id: str,
    activity_data: OpportunityActivityCreate,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Создать активность по сделке"""
    try:
        # Проверяем существование сделки
        opportunity = db.query(Opportunity).filter(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.id.isnot(None)
            )
        ).first()
        
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сделка не найдена"
            )
        
        # Создаем активность
        activity = OpportunityActivity(
            **activity_data.model_dump(),
            opportunity_id=opportunity_id,
            owner_id=str(current_user.id)
        )
        
        db.add(activity)
        db.commit()
        db.refresh(activity)
        
        # Формируем ответ
        activity_data = activity.__dict__.copy()
        activity_data["owner_name"] = f"{current_user.first_name} {current_user.last_name}".strip()
        
        return OpportunityActivityResponse.model_validate(activity_data)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания активности: {str(e)}"
        )


@router.get("/{opportunity_id}/activities", response_model=List[OpportunityActivityResponse])
async def get_opportunity_activities(
    opportunity_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить активности по сделке"""
    try:
        # Проверяем существование сделки
        opportunity = db.query(Opportunity).filter(
            and_(
                Opportunity.id == opportunity_id,
                Opportunity.id.isnot(None)
            )
        ).first()
        
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Сделка не найдена"
            )
        
        # Получаем активности
        activities = db.query(OpportunityActivity).filter(
            OpportunityActivity.opportunity_id == opportunity_id
        ).order_by(OpportunityActivity.created_at.desc()).all()
        
        # Формируем ответ
        activities_response = []
        for activity in activities:
            activity_data = activity.__dict__.copy()
            activity_data["owner_name"] = None  # TODO: добавить связь с пользователем
            activities_response.append(OpportunityActivityResponse.model_validate(activity_data))
        
        return activities_response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения активностей: {str(e)}"
        ) 