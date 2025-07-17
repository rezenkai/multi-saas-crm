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

interface Company {
  id: string
  name: string
  legal_name?: string
  website?: string
  email?: string
  phone?: string
  industry?: string
  company_size?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  description?: string
  annual_revenue?: number
  is_active: boolean
  created_at: string
  updated_at?: string
  owner_name?: string
  contact_count?: number
  deal_count?: number
}

interface CompanyForm {
  name: string
  legal_name: string
  website: string
  email: string
  phone: string
  industry: string
  company_size: string
  address: string
  city: string
  state: string
  country: string
  postal_code: string
  description: string
  annual_revenue: string
}

const getCompanySizeColor = (size: string) => {
  const colors = {
    'STARTUP': 'bg-blue-100 text-blue-800',
    'SMALL': 'bg-green-100 text-green-800',
    'MEDIUM': 'bg-yellow-100 text-yellow-800',
    'LARGE': 'bg-orange-100 text-orange-800',
    'ENTERPRISE': 'bg-purple-100 text-purple-800',
  }
  return colors[size as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

const formatRevenue = (revenue?: number) => {
  if (!revenue) return '-'
  if (revenue >= 1000000) return `$${(revenue / 1000000).toFixed(1)}M`
  if (revenue >= 1000) return `$${(revenue / 1000).toFixed(1)}K`
  return `$${revenue}`
}

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  
  const [formData, setFormData] = useState<CompanyForm>({
    name: '',
    legal_name: '',
    website: '',
    email: '',
    phone: '',
    industry: '',
    company_size: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    description: '',
    annual_revenue: ''
  })

  // Проверка авторизации при загрузке компонента
  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin()
      return
    }
  }, [])

  const fetchCompanies = async () => {
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (industryFilter && industryFilter !== 'all') params.append('industry', industryFilter)
      if (sizeFilter && sizeFilter !== 'all') params.append('company_size', sizeFilter)
      
      const response = await fetch(`http://localhost:3001/api/v1/companies/?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCompanies(data.companies || data) // Поддержка разных форматов ответа
      } else {
        console.error('Failed to fetch companies')
      }
    } catch (error) {
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const createCompany = async () => {
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const payload = {
        ...formData,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : undefined
      }
      
      const response = await fetch('http://localhost:3001/api/v1/companies/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      if (response.ok) {
        await fetchCompanies()
        setIsCreateDialogOpen(false)
        resetForm()
      } else {
        console.error('Failed to create company')
      }
    } catch (error) {
      console.error('Error creating company:', error)
    }
  }

  const updateCompany = async () => {
    if (!editingCompany) return
    
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const payload = {
        ...formData,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : undefined
      }
      
      const response = await fetch(`http://localhost:3001/api/v1/companies/${editingCompany.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      if (response.ok) {
        await fetchCompanies()
        setIsEditDialogOpen(false)
        resetForm()
        setEditingCompany(null)
      } else {
        console.error('Failed to update company')
      }
    } catch (error) {
      console.error('Error updating company:', error)
    }
  }

  const deleteCompany = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту компанию?')) return
    
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }
    try {
      const response = await fetch(`http://localhost:3001/api/v1/companies/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        await fetchCompanies()
      } else {
        console.error('Failed to delete company')
      }
    } catch (error) {
      console.error('Error deleting company:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      legal_name: '',
      website: '',
      email: '',
      phone: '',
      industry: '',
      company_size: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      description: '',
      annual_revenue: ''
    })
  }

  const openEditDialog = (company: Company) => {
    setEditingCompany(company)
    setFormData({
      name: company.name,
      legal_name: company.legal_name || '',
      website: company.website || '',
      email: company.email || '',
      phone: company.phone || '',
      industry: company.industry || '',
      company_size: company.company_size || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      country: company.country || '',
      postal_code: company.postal_code || '',
      description: company.description || '',
      annual_revenue: company.annual_revenue ? company.annual_revenue.toString() : ''
    })
    setIsEditDialogOpen(true)
  }

  useEffect(() => {
    fetchCompanies()
  }, [search, industryFilter, sizeFilter])

  const CompanyFormContent = () => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="name">Название компании *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>
      <div>
        <Label htmlFor="legal_name">Юридическое название</Label>
        <Input
          id="legal_name"
          value={formData.legal_name}
          onChange={(e) => setFormData({...formData, legal_name: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="website">Веб-сайт</Label>
        <Input
          id="website"
          value={formData.website}
          onChange={(e) => setFormData({...formData, website: e.target.value})}
          placeholder="https://example.com"
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
        <Label htmlFor="industry">Отрасль</Label>
        <Select
          value={formData.industry}
          onValueChange={(value) => setFormData({...formData, industry: value})}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите отрасль" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TECHNOLOGY">Технологии</SelectItem>
            <SelectItem value="HEALTHCARE">Здравоохранение</SelectItem>
            <SelectItem value="FINANCE">Финансы</SelectItem>
            <SelectItem value="EDUCATION">Образование</SelectItem>
            <SelectItem value="RETAIL">Розничная торговля</SelectItem>
            <SelectItem value="MANUFACTURING">Производство</SelectItem>
            <SelectItem value="REAL_ESTATE">Недвижимость</SelectItem>
            <SelectItem value="CONSULTING">Консалтинг</SelectItem>
            <SelectItem value="OTHER">Другое</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="company_size">Размер компании</Label>
        <Select
          value={formData.company_size}
          onValueChange={(value) => setFormData({...formData, company_size: value})}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите размер" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STARTUP">Стартап (1-10)</SelectItem>
            <SelectItem value="SMALL">Малая (11-50)</SelectItem>
            <SelectItem value="MEDIUM">Средняя (51-200)</SelectItem>
            <SelectItem value="LARGE">Крупная (201-1000)</SelectItem>
            <SelectItem value="ENTERPRISE">Корпорация (1000+)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="annual_revenue">Годовой доход ($)</Label>
        <Input
          id="annual_revenue"
          type="number"
          value={formData.annual_revenue}
          onChange={(e) => setFormData({...formData, annual_revenue: e.target.value})}
          placeholder="1000000"
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor="address">Адрес</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="city">Город</Label>
        <Input
          id="city"
          value={formData.city}
          onChange={(e) => setFormData({...formData, city: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="country">Страна</Label>
        <Input
          id="country"
          value={formData.country}
          onChange={(e) => setFormData({...formData, country: e.target.value})}
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows={3}
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Компании</h1>
          <p className="text-gray-600">Управление компаниями и организациями</p>
        </div>

        {/* Фильтры и поиск */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="search">Поиск</Label>
                <Input
                  id="search"
                  placeholder="Поиск по названию, email, веб-сайту..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-48">
                <Label htmlFor="industry-filter">Отрасль</Label>
                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все отрасли" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все отрасли</SelectItem>
                    <SelectItem value="TECHNOLOGY">Технологии</SelectItem>
                    <SelectItem value="HEALTHCARE">Здравоохранение</SelectItem>
                    <SelectItem value="FINANCE">Финансы</SelectItem>
                    <SelectItem value="EDUCATION">Образование</SelectItem>
                    <SelectItem value="RETAIL">Розничная торговля</SelectItem>
                    <SelectItem value="MANUFACTURING">Производство</SelectItem>
                    <SelectItem value="REAL_ESTATE">Недвижимость</SelectItem>
                    <SelectItem value="CONSULTING">Консалтинг</SelectItem>
                    <SelectItem value="OTHER">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Label htmlFor="size-filter">Размер</Label>
                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все размеры" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все размеры</SelectItem>
                    <SelectItem value="STARTUP">Стартап</SelectItem>
                    <SelectItem value="SMALL">Малая</SelectItem>
                    <SelectItem value="MEDIUM">Средняя</SelectItem>
                    <SelectItem value="LARGE">Крупная</SelectItem>
                    <SelectItem value="ENTERPRISE">Корпорация</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    Создать компанию
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Создать новую компанию</DialogTitle>
                  </DialogHeader>
                  <CompanyFormContent />
                  <div className="flex gap-2 pt-4">
                    <Button onClick={createCompany}>Создать</Button>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Отмена
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Таблица компаний */}
        <Card>
          <CardHeader>
            <CardTitle>Список компаний ({companies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Компании не найдены
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-700">Название</th>
                      <th className="text-left p-3 font-medium text-gray-700">Отрасль</th>
                      <th className="text-left p-3 font-medium text-gray-700">Размер</th>
                      <th className="text-left p-3 font-medium text-gray-700">Контакты</th>
                      <th className="text-left p-3 font-medium text-gray-700">Доход</th>
                      <th className="text-left p-3 font-medium text-gray-700">Создано</th>
                      <th className="text-left p-3 font-medium text-gray-700">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr key={company.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-gray-900">{company.name}</div>
                            {company.website && (
                              <a 
                                href={company.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                {company.website}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">{company.industry || '-'}</td>
                        <td className="p-3">
                          {company.company_size ? (
                            <Badge className={getCompanySizeColor(company.company_size)}>
                              {company.company_size}
                            </Badge>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-gray-600">
                            {company.email && <div>{company.email}</div>}
                            {company.phone && <div>{company.phone}</div>}
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">{formatRevenue(company.annual_revenue)}</td>
                        <td className="p-3 text-gray-600">
                          {new Date(company.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(company)}
                            >
                              Изменить
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteCompany(company.id)}
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
              <DialogTitle>Редактировать компанию</DialogTitle>
            </DialogHeader>
            <CompanyFormContent />
            <div className="flex gap-2 pt-4">
              <Button onClick={updateCompany}>Сохранить</Button>
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