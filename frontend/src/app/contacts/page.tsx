'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { isAuthenticated, getToken, redirectToLogin } from '@/lib/auth'

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  mobile?: string
  contact_type: 'LEAD' | 'CUSTOMER' | 'PARTNER' | 'VENDOR' | 'EMPLOYEE'
  title?: string
  department?: string
  position?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  linkedin_url?: string
  twitter_url?: string
  facebook_url?: string
  source?: string
  notes?: string
  company_id?: string
  is_active: boolean
  is_verified: boolean
  created_at: string
  updated_at?: string
  last_contacted?: string
  owner_name?: string
  company_name?: string
}

interface ContactForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  contact_type: 'LEAD' | 'CUSTOMER' | 'PARTNER' | 'VENDOR' | 'EMPLOYEE'
  title: string
  department: string
  position: string
  address: string
  city: string
  state: string
  country: string
  postal_code: string
  linkedin_url: string
  twitter_url: string
  facebook_url: string
  source: string
  notes: string
  company_id: string
}

const getContactTypeColor = (type: string) => {
  const colors = {
    LEAD: 'bg-blue-100 text-blue-800',
    CUSTOMER: 'bg-green-100 text-green-800',
    PARTNER: 'bg-purple-100 text-purple-800',
    VENDOR: 'bg-orange-100 text-orange-800',
    EMPLOYEE: 'bg-gray-100 text-gray-800',
  }
  return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  
  const [formData, setFormData] = useState<ContactForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    contact_type: 'LEAD',
    title: '',
    department: '',
    position: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    linkedin_url: '',
    twitter_url: '',
    facebook_url: '',
    source: '',
    notes: '',
    company_id: ''
  })

  // Проверка авторизации при загрузке компонента
  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin()
      return
    }
  }, [])

  const fetchContacts = async () => {
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (typeFilter && typeFilter !== 'all') params.append('contact_type', typeFilter)
      
      const response = await fetch(`http://localhost:3001/api/v1/contacts/?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts)
      } else {
        console.error('Failed to fetch contacts')
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const createContact = async () => {
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const response = await fetch('http://localhost:3001/api/v1/contacts/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        await fetchContacts()
        setIsCreateDialogOpen(false)
        resetForm()
      } else {
        console.error('Failed to create contact')
      }
    } catch (error) {
      console.error('Error creating contact:', error)
    }
  }

  const updateContact = async () => {
    if (!editingContact) return
    
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const response = await fetch(`http://localhost:3001/api/v1/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        await fetchContacts()
        setIsEditDialogOpen(false)
        resetForm()
        setEditingContact(null)
      } else {
        console.error('Failed to update contact')
      }
    } catch (error) {
      console.error('Error updating contact:', error)
    }
  }

  const deleteContact = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот контакт?')) return
    
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const response = await fetch(`http://localhost:3001/api/v1/contacts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        await fetchContacts()
      } else {
        console.error('Failed to delete contact')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      contact_type: 'LEAD',
      title: '',
      department: '',
      position: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      linkedin_url: '',
      twitter_url: '',
      facebook_url: '',
      source: '',
      notes: '',
      company_id: ''
    })
  }

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact)
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      contact_type: contact.contact_type,
      title: contact.title || '',
      department: contact.department || '',
      position: contact.position || '',
      address: contact.address || '',
      city: contact.city || '',
      state: contact.state || '',
      country: contact.country || '',
      postal_code: contact.postal_code || '',
      linkedin_url: contact.linkedin_url || '',
      twitter_url: contact.twitter_url || '',
      facebook_url: contact.facebook_url || '',
      source: contact.source || '',
      notes: contact.notes || '',
      company_id: contact.company_id || ''
    })
    setIsEditDialogOpen(true)
  }

  useEffect(() => {
    fetchContacts()
  }, [search, typeFilter])

  const ContactFormContent = () => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="first_name">Имя *</Label>
        <Input
          id="first_name"
          value={formData.first_name}
          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
          required
        />
      </div>
      <div>
        <Label htmlFor="last_name">Фамилия *</Label>
        <Input
          id="last_name"
          value={formData.last_name}
          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
          required
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="mobile">Мобильный</Label>
        <Input
          id="mobile"
          value={formData.mobile}
          onChange={(e) => setFormData({...formData, mobile: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="contact_type">Тип контакта</Label>
        <Select
          value={formData.contact_type}
          onValueChange={(value) => setFormData({...formData, contact_type: value as any})}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LEAD">Лид</SelectItem>
            <SelectItem value="CUSTOMER">Клиент</SelectItem>
            <SelectItem value="PARTNER">Партнер</SelectItem>
            <SelectItem value="VENDOR">Поставщик</SelectItem>
            <SelectItem value="EMPLOYEE">Сотрудник</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="title">Обращение</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="position">Должность</Label>
        <Input
          id="position"
          value={formData.position}
          onChange={(e) => setFormData({...formData, position: e.target.value})}
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor="notes">Заметки</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          rows={3}
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Контакты</h1>
          <p className="text-gray-600">Управление контактами в CRM системе</p>
        </div>

        {/* Фильтры и поиск */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="search">Поиск</Label>
                <Input
                  id="search"
                  placeholder="Поиск по имени, email, телефону..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-48">
                <Label htmlFor="type-filter">Тип</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все типы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="LEAD">Лид</SelectItem>
                    <SelectItem value="CUSTOMER">Клиент</SelectItem>
                    <SelectItem value="PARTNER">Партнер</SelectItem>
                    <SelectItem value="VENDOR">Поставщик</SelectItem>
                    <SelectItem value="EMPLOYEE">Сотрудник</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    Создать контакт
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Создать новый контакт</DialogTitle>
                  </DialogHeader>
                  <ContactFormContent />
                  <div className="flex gap-2 pt-4">
                    <Button onClick={createContact}>Создать</Button>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Отмена
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Таблица контактов */}
        <Card>
          <CardHeader>
            <CardTitle>Список контактов ({contacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Контакты не найдены
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-700">Имя</th>
                      <th className="text-left p-3 font-medium text-gray-700">Email</th>
                      <th className="text-left p-3 font-medium text-gray-700">Телефон</th>
                      <th className="text-left p-3 font-medium text-gray-700">Тип</th>
                      <th className="text-left p-3 font-medium text-gray-700">Должность</th>
                      <th className="text-left p-3 font-medium text-gray-700">Создан</th>
                      <th className="text-left p-3 font-medium text-gray-700">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </div>
                            {contact.title && (
                              <div className="text-sm text-gray-500">{contact.title}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">{contact.email || '-'}</td>
                        <td className="p-3 text-gray-600">{contact.phone || contact.mobile || '-'}</td>
                        <td className="p-3">
                          <Badge className={getContactTypeColor(contact.contact_type)}>
                            {contact.contact_type}
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-600">{contact.position || '-'}</td>
                        <td className="p-3 text-gray-600">
                          {new Date(contact.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(contact)}
                            >
                              Изменить
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteContact(contact.id)}
                            >
                              Удалить
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Диалог редактирования */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Редактировать контакт</DialogTitle>
            </DialogHeader>
            <ContactFormContent />
            <div className="flex gap-2 pt-4">
              <Button onClick={updateContact}>Сохранить</Button>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Отмена
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 