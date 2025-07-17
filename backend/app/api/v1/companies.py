"""
API для работы с компаниями
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ...core.database import get_db
from ...core.deps import get_current_user, get_current_tenant_id
from ...models.user import User
from ...models.company import Company, CompanyNote
from ...schemas.auth import AuthUserResponse
from ...schemas.company import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyListResponse,
    CompanyNoteCreate,
    CompanyNoteUpdate,
    CompanyNoteResponse
)

router = APIRouter()


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Создать новую компанию"""
    try:
        # Создание компании
        company = Company(
            name=company_data.name,
            description=company_data.description,
            company_type=company_data.company_type,
            email=company_data.email,
            phone=company_data.phone,
            website=company_data.website,
            address=company_data.address,
            city=company_data.city,
            state=company_data.state,
            country=company_data.country,
            postal_code=company_data.postal_code,
            industry=company_data.industry,
            size=company_data.size,
            company_size=company_data.company_size,
            legal_name=company_data.legal_name,
            annual_revenue=company_data.annual_revenue,
            linkedin_url=company_data.linkedin_url,
            twitter_url=company_data.twitter_url,
            facebook_url=company_data.facebook_url,
            source=company_data.source,
            notes=company_data.notes,
            tenant_id=tenant_id,
            owner_id=str(current_user.id)
        )
        
        db.add(company)
        db.commit()
        db.refresh(company)
        
        # Создаем response объект с конвертированными UUID
        response_data = {
            "id": str(company.id),
            "tenant_id": str(company.tenant_id),
            "owner_id": str(company.owner_id),
            "name": company.name,
            "description": company.description,
            "company_type": company.company_type,
            "email": company.email,
            "phone": company.phone,
            "website": company.website,
            "address": company.address,
            "city": company.city,
            "state": company.state,
            "country": company.country,
            "postal_code": company.postal_code,
            "industry": company.industry,
            "size": company.size,
            "company_size": company.company_size,
            "legal_name": company.legal_name,
            "annual_revenue": company.annual_revenue,
            "linkedin_url": company.linkedin_url,
            "twitter_url": company.twitter_url,
            "facebook_url": company.facebook_url,
            "source": company.source,
            "notes": company.notes,
            "is_active": company.is_active,
            "is_verified": company.is_verified,
            "created_at": company.created_at,
            "updated_at": company.updated_at,
            "last_contacted": company.last_contacted,
            "owner_name": f"{current_user.first_name} {current_user.last_name}".strip(),
            "contacts_count": 0
        }
        
        return CompanyResponse(**response_data)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании компании: {str(e)}"
        )


@router.get("/", response_model=CompanyListResponse)
async def get_companies(
    skip: int = Query(0, ge=0, description="Количество записей для пропуска"),
    limit: int = Query(100, ge=1, le=1000, description="Количество записей"),
    search: Optional[str] = Query(None, description="Поиск по названию или описанию"),
    company_type: Optional[str] = Query(None, description="Фильтр по типу компании"),
    is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить список компаний"""
    try:
        # Базовый запрос
        query = db.query(Company).filter(Company.tenant_id == tenant_id)
        
        # Фильтры
        if search:
            query = query.filter(
                or_(
                    Company.name.ilike(f"%{search}%"),
                    Company.description.ilike(f"%{search}%")
                )
            )
        
        if company_type and company_type != 'all':
            query = query.filter(Company.company_type == company_type)
        
        if is_active is not None:
            query = query.filter(Company.is_active == is_active)
        
        # Подсчет общего количества
        total = query.count()
        
        # Применение пагинации
        companies = query.offset(skip).limit(limit).all()
        
        # Конвертируем каждую компанию в response формат
        companies_response = []
        for company in companies:
            company_data = {
                "id": str(company.id),
                "tenant_id": str(company.tenant_id),
                "owner_id": str(company.owner_id),
                "name": company.name,
                "description": company.description,
                "company_type": company.company_type,
                "email": company.email,
                "phone": company.phone,
                "website": company.website,
                "address": company.address,
                "city": company.city,
                "state": company.state,
                "country": company.country,
                "postal_code": company.postal_code,
                "industry": company.industry,
                "size": company.size,
                "company_size": company.company_size,
                "legal_name": company.legal_name,
                "annual_revenue": company.annual_revenue,
                "linkedin_url": company.linkedin_url,
                "twitter_url": company.twitter_url,
                "facebook_url": company.facebook_url,
                "source": company.source,
                "notes": company.notes,
                "is_active": company.is_active,
                "is_verified": company.is_verified,
                "created_at": company.created_at,
                "updated_at": company.updated_at,
                "last_contacted": company.last_contacted,
                "owner_name": None,  # TODO: добавить имя владельца
                "contacts_count": 0  # TODO: добавить подсчет контактов
            }
            companies_response.append(CompanyResponse(**company_data))
        
        return {
            "companies": companies_response,
            "total": total,
            "page": (skip // limit) + 1,
            "pages": (total + limit - 1) // limit,
            "size": limit
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении списка компаний: {str(e)}"
        )


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить компанию по ID"""
    company = db.query(Company).filter(
        and_(
            Company.id == company_id,
            Company.tenant_id == tenant_id
        )
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена"
        )
    
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Обновить компанию"""
    # Поиск компании
    company = db.query(Company).filter(
        and_(
            Company.id == company_id,
            Company.tenant_id == tenant_id
        )
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена"
        )
    
    try:
        # Обновление данных
        update_data = company_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(company, field, value)
        
        db.commit()
        db.refresh(company)
        
        return company
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении компании: {str(e)}"
        )


@router.delete("/{company_id}")
async def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Удалить компанию"""
    # Поиск компании
    company = db.query(Company).filter(
        and_(
            Company.id == company_id,
            Company.tenant_id == tenant_id
        )
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена"
        )
    
    try:
        db.delete(company)
        db.commit()
        
        return {"message": "Компания успешно удалена"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении компании: {str(e)}"
        )


# Заметки компаний
@router.post("/{company_id}/notes", response_model=CompanyNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_company_note(
    company_id: str,
    note_data: CompanyNoteCreate,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Создать заметку для компании"""
    # Проверка существования компании
    company = db.query(Company).filter(
        and_(
            Company.id == company_id,
            Company.tenant_id == tenant_id
        )
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена"
        )
    
    try:
        # Создание заметки
        note = CompanyNote(
            company_id=company_id,
            author_id=str(current_user.id),
            title=note_data.title,
            content=note_data.content,
            note_type=note_data.note_type
        )
        
        db.add(note)
        db.commit()
        db.refresh(note)
        
        return note
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании заметки: {str(e)}"
        )


@router.get("/{company_id}/notes", response_model=List[CompanyNoteResponse])
async def get_company_notes(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Получить заметки компании"""
    # Проверка существования компании
    company = db.query(Company).filter(
        and_(
            Company.id == company_id,
            Company.tenant_id == tenant_id
        )
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена"
        )
    
    notes = db.query(CompanyNote).filter(
        CompanyNote.company_id == company_id
    ).order_by(CompanyNote.created_at.desc()).all()
    
    return notes


@router.put("/{company_id}/notes/{note_id}", response_model=CompanyNoteResponse)
async def update_company_note(
    company_id: str,
    note_id: str,
    note_data: CompanyNoteUpdate,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Обновить заметку компании"""
    # Поиск заметки
    note = db.query(CompanyNote).filter(
        and_(
            CompanyNote.id == note_id,
            CompanyNote.company_id == company_id
        )
    ).first()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заметка не найдена"
        )
    
    # Проверка прав (автор или админ)
    if note.author_id != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для редактирования заметки"
        )
    
    try:
        # Обновление данных
        update_data = note_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(note, field, value)
        
        db.commit()
        db.refresh(note)
        
        return note
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении заметки: {str(e)}"
        )


@router.delete("/{company_id}/notes/{note_id}")
async def delete_company_note(
    company_id: str,
    note_id: str,
    db: Session = Depends(get_db),
    current_user: AuthUserResponse = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Удалить заметку компании"""
    # Поиск заметки
    note = db.query(CompanyNote).filter(
        and_(
            CompanyNote.id == note_id,
            CompanyNote.company_id == company_id
        )
    ).first()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заметка не найдена"
        )
    
    # Проверка прав (автор или админ)
    if note.author_id != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для удаления заметки"
        )
    
    try:
        db.delete(note)
        db.commit()
        
        return {"message": "Заметка успешно удалена"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при удалении заметки: {str(e)}"
        ) 