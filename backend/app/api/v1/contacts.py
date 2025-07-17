"""
API endpoints для контактов
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
import logging

from ...core.database import get_db
from ...core.deps import get_current_user, get_current_tenant_id, get_current_active_user
from ...schemas.contact import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ContactListResponse,
    ContactNoteCreate,
    ContactNoteUpdate,
    ContactNoteResponse
)
from ...schemas.auth import AuthUserResponse
from ...models.contact import Contact, ContactNote
from ...models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


def convert_contact_to_response(contact: Contact, owner_first_name: str = None, owner_last_name: str = None, company_name: str = None) -> ContactResponse:
    """Конвертирует Contact в ContactResponse с правильной обработкой UUID"""
    return ContactResponse(
        id=str(contact.id),
        tenant_id=str(contact.tenant_id),
        owner_id=str(contact.owner_id),
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        mobile=contact.mobile,
        contact_type=contact.contact_type,
        title=contact.title,
        department=contact.department,
        position=contact.position,
        address=contact.address,
        city=contact.city,
        state=contact.state,
        country=contact.country,
        postal_code=contact.postal_code,
        linkedin_url=contact.linkedin_url,
        twitter_url=contact.twitter_url,
        facebook_url=contact.facebook_url,
        source=contact.source,
        notes=contact.notes,
        company_id=str(contact.company_id) if contact.company_id else None,
        is_active=contact.is_active,
        is_verified=contact.is_verified,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
        last_contacted=contact.last_contacted,
        owner_name=f"{owner_first_name} {owner_last_name}".strip() if owner_first_name and owner_last_name else None,
        company_name=company_name
    )


def convert_contact_note_to_response(note: ContactNote, author_first_name: str = None, author_last_name: str = None) -> ContactNoteResponse:
    """Конвертирует ContactNote в ContactNoteResponse с правильной обработкой UUID"""
    return ContactNoteResponse(
        id=str(note.id),
        contact_id=str(note.contact_id),
        author_id=str(note.author_id),
        title=note.title,
        content=note.content,
        note_type=note.note_type,
        created_at=note.created_at,
        updated_at=note.updated_at,
        author_name=f"{author_first_name} {author_last_name}".strip() if author_first_name and author_last_name else None
    )


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def create_contact(
    contact: ContactCreate,
    current_user: AuthUserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Создание нового контакта
    """
    try:
        # Получаем tenant_id из текущего пользователя
        # tenant_id уже получен через depends
        
        # Проверяем уникальность email если указан
        if contact.email:
            existing_contact = db.query(Contact).filter(
                Contact.email == contact.email,
                Contact.tenant_id == tenant_id
            ).first()
            
            if existing_contact:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Контакт с таким email уже существует"
                )
        
        # Создаем контакт
        db_contact = Contact(
            **contact.model_dump(),
            tenant_id=tenant_id,
            owner_id=str(current_user.id)
        )
        db.add(db_contact)
        db.commit()
        db.refresh(db_contact)
        
        # Формируем ответ с конвертацией UUID в строки
        return convert_contact_to_response(db_contact, current_user.first_name, current_user.last_name)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании контакта"
        )


@router.get("/", response_model=ContactListResponse)
def get_contacts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    contact_type: Optional[str] = Query(None),
    current_user: AuthUserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Получение списка контактов с пагинацией и фильтрацией
    """
    try:
        # tenant_id уже получен через depends
        
        # Базовый запрос
        query = db.query(Contact).filter(Contact.tenant_id == tenant_id)
        
        # Поиск
        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                (Contact.first_name.ilike(search_filter)) |
                (Contact.last_name.ilike(search_filter)) |
                (Contact.email.ilike(search_filter)) |
                (Contact.phone.ilike(search_filter)) |
                (Contact.mobile.ilike(search_filter))
            )
        
        # Фильтр по типу
        if contact_type and contact_type != 'all':
            query = query.filter(Contact.contact_type == contact_type)
        
        # Общее количество
        total = query.count()
        
        # Пагинация
        contacts = query.offset(skip).limit(limit).all()
        
        # Формируем ответы с конвертацией UUID
        contact_responses = []
        for contact in contacts:
            # Получаем данные владельца
            owner = db.query(User).filter(User.id == str(contact.owner_id)).first()
            owner_name = f"{owner.first_name} {owner.last_name}" if owner else None
            
            contact_responses.append(convert_contact_to_response(contact, owner.first_name if owner else None, owner.last_name if owner else None))
        
        return ContactListResponse(
            contacts=contact_responses,
            total=total,
            page=skip // limit + 1,
            size=limit,
            pages=(total + limit - 1) // limit
        )
        
    except Exception as e:
        import traceback
        logger.error(f"Error getting contacts: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении списка контактов: {e}"
        )


@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(
    contact_id: str,
    current_user: AuthUserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Получение контакта по ID
    """
    try:
        # tenant_id уже получен через depends
        
        contact = db.query(Contact).filter(
            Contact.id == contact_id,
            Contact.tenant_id == tenant_id
        ).first()
        
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Контакт не найден"
            )
        
        # Получаем данные владельца
        owner = db.query(User).filter(User.id == str(contact.owner_id)).first()
        
        return convert_contact_to_response(contact, owner.first_name if owner else None, owner.last_name if owner else None)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при получении контакта"
        )


@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: str,
    contact_update: ContactUpdate,
    current_user: AuthUserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Обновление контакта
    """
    try:
        # tenant_id уже получен через depends
        
        # Получаем контакт
        db_contact = db.query(Contact).filter(
            Contact.id == contact_id,
            Contact.tenant_id == tenant_id
        ).first()
        
        if not db_contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Контакт не найден"
            )
        
        # Проверяем права доступа (только владелец может редактировать)
        if db_contact.owner_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет прав для редактирования этого контакта"
            )
        
        # Обновляем поля
        update_data = contact_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_contact, field, value)
        
        db.commit()
        db.refresh(db_contact)
        
        # Получаем данные владельца
        owner = db.query(User).filter(User.id == str(db_contact.owner_id)).first()
        
        return convert_contact_to_response(db_contact, owner.first_name if owner else None, owner.last_name if owner else None)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при обновлении контакта"
        )


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: str,
    current_user: AuthUserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Удаление контакта
    """
    try:
        # tenant_id уже получен через depends
        
        # Получаем контакт
        db_contact = db.query(Contact).filter(
            Contact.id == contact_id,
            Contact.tenant_id == tenant_id
        ).first()
        
        if not db_contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Контакт не найден"
            )
        
        # Проверяем права доступа
        if db_contact.owner_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет прав для удаления этого контакта"
            )
        
        # Удаляем контакт
        db.delete(db_contact)
        db.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении контакта"
        )


# Заметки о контактах
@router.post("/{contact_id}/notes", response_model=ContactNoteResponse, status_code=status.HTTP_201_CREATED)
def create_contact_note(
    contact_id: str,
    note: ContactNoteCreate,
    current_user: AuthUserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Создание заметки о контакте
    """
    try:
        # tenant_id уже получен через depends
        
        # Проверяем существование контакта
        contact = db.query(Contact).filter(
            Contact.id == contact_id,
            Contact.tenant_id == tenant_id
        ).first()
        
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Контакт не найден"
            )
        
        # Создаем заметку
        db_note = ContactNote(
            **note.model_dump(),
            contact_id=contact_id,
            author_id=str(current_user.id)
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        
        return convert_contact_note_to_response(db_note, current_user.first_name, current_user.last_name)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating contact note: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании заметки"
        ) 