'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Navigation from '@/components/Navigation'
import { isAuthenticated, getToken, redirectToLogin } from '@/lib/auth'
import { 
  DollarSign, 
  Users, 
  Building, 
  TrendingUp,
  Calendar,
  Activity,
  Target,
  Phone
} from 'lucide-react'

interface DashboardStats {
  totalRevenue: number
  totalOpportunities: number
  totalContacts: number
  totalCompanies: number
  monthlyRevenue: number[]
  recentActivities: any[]
  topOpportunities: any[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOpportunities: 0,
    totalContacts: 0,
    totalCompanies: 0,
    monthlyRevenue: [],
    recentActivities: [],
    topOpportunities: []
  })
  const [loading, setLoading] = useState(true)

  // Проверка авторизации при загрузке компонента
  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin()
      return
    }
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }

    try {
      // Параллельные запросы для получения данных
      const [opportunitiesRes, contactsRes, companiesRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/opportunities/', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/v1/contacts/', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/v1/companies/', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      const opportunities = await opportunitiesRes.json()
      const contacts = await contactsRes.json()
      const companies = await companiesRes.json()

      // Вычисляем статистику
      const totalRevenue = Array.isArray(opportunities) ? 
        opportunities.reduce((sum: number, opp: any) => sum + (opp.amount || 0), 0) : 0

      const topOpportunitiesList = Array.isArray(opportunities) ? 
        opportunities
          .sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 5) : []

      // Генерируем данные по месяцам (пример)
      const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
        return Math.floor(Math.random() * 100000) + 50000
      })

      // Создаем недавние активности (пример)
      const recentActivities = [
        { type: 'opportunity', action: 'created', title: 'Новая сделка с Tech Corp', time: '2 часа назад' },
        { type: 'contact', action: 'updated', title: 'Обновлен контакт John Smith', time: '4 часа назад' },
        { type: 'company', action: 'created', title: 'Добавлена компания StartupXYZ', time: '1 день назад' },
        { type: 'opportunity', action: 'closed', title: 'Закрыта сделка на $25,000', time: '2 дня назад' }
      ]

      setStats({
        totalRevenue,
        totalOpportunities: Array.isArray(opportunities) ? opportunities.length : 0,
        totalContacts: Array.isArray(contacts) ? contacts.length : 0,
        totalCompanies: Array.isArray(companies) ? companies.length : 0,
        monthlyRevenue,
        recentActivities,
        topOpportunities: topOpportunitiesList
      })

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Загружаем данные...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-6">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Обзор ключевых метрик и аналитики</p>
        </div>

        {/* KPI Карточки */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Общая выручка</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                +12.5% по сравнению с прошлым месяцем
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Сделки</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOpportunities}</div>
              <p className="text-xs text-muted-foreground">
                +8 новых сделок на этой неделе
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Контакты</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground">
                +15 новых контактов в этом месяце
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Компании</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompanies}</div>
              <p className="text-xs text-muted-foreground">
                +3 новые компании в этом месяце
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Графики и активности */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* График выручки */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Выручка по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between space-x-2">
                {stats.monthlyRevenue.map((revenue, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div 
                      className="bg-blue-500 w-full rounded-t"
                      style={{ 
                        height: `${(revenue / Math.max(...stats.monthlyRevenue)) * 200}px` 
                      }}
                    ></div>
                    <span className="text-xs text-gray-500 mt-2">
                      {['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 
                        'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'][index]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Последние активности */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Последние активности</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {activity.type === 'opportunity' && <Target className="h-4 w-4 text-green-500" />}
                      {activity.type === 'contact' && <Users className="h-4 w-4 text-blue-500" />}
                      {activity.type === 'company' && <Building className="h-4 w-4 text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Топ сделки */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Топ сделки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topOpportunities.map((opportunity) => (
                <div key={opportunity.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{opportunity.title || 'Без названия'}</h3>
                    <p className="text-sm text-gray-500">
                      {opportunity.company_name || 'Компания не указана'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(opportunity.amount || 0)}</p>
                    <Badge 
                      variant={
                        opportunity.stage === 'CLOSED_WON' ? 'default' :
                        opportunity.stage === 'PROPOSAL' ? 'secondary' : 'outline'
                      }
                    >
                      {opportunity.stage}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Быстрые действия */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/contacts')}
          >
            <CardContent className="flex items-center justify-center p-6">
              <Users className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <h3 className="font-medium">Управление контактами</h3>
                <p className="text-sm text-gray-500">Добавить новый контакт</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/opportunities')}
          >
            <CardContent className="flex items-center justify-center p-6">
              <Target className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <h3 className="font-medium">Новая сделка</h3>
                <p className="text-sm text-gray-500">Создать возможность</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push('/companies')}
          >
            <CardContent className="flex items-center justify-center p-6">
              <Building className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <h3 className="font-medium">Добавить компанию</h3>
                <p className="text-sm text-gray-500">Новая организация</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 