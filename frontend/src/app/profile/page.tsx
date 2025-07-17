'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { isAuthenticated, getToken, redirectToLogin } from '@/lib/auth'
import { User, Mail, Phone, MapPin, Building, Calendar, Shield } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  username?: string
  phone?: string
  title?: string
  department?: string
  bio?: string
  avatar_url?: string
  timezone?: string
  locale?: string
  theme?: string
  is_active: boolean
  is_verified: boolean
  is_superuser: boolean
  tenant_name: string
  role: string
  created_at: string
  last_login?: string
}

interface ProfileFormData {
  first_name: string
  last_name: string
  username: string
  phone: string
  title: string
  department: string
  bio: string
  timezone: string
  locale: string
  theme: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  const [formData, setFormData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    username: '',
    phone: '',
    title: '',
    department: '',
    bio: '',
    timezone: 'UTC',
    locale: 'ru',
    theme: 'light'
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin()
      return
    }
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          username: data.username || '',
          phone: data.phone || '',
          title: data.title || '',
          department: data.department || '',
          bio: data.bio || '',
          timezone: data.timezone || 'UTC',
          locale: data.locale || 'ru',
          theme: data.theme || 'light'
        })
      } else {
        console.error('Failed to fetch profile')
        redirectToLogin()
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async () => {
    if (!profile) return

    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`http://localhost:3001/api/v1/users/${profile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchProfile()
        setIsEditing(false)
      } else {
        console.error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Загружаем профиль...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-red-600">Ошибка загрузки профиля</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Профиль пользователя</h1>
              <p className="text-gray-600 mt-2">Управление личной информацией и настройками</p>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  Редактировать
                </Button>
              ) : (
                <>
                  <Button onClick={updateProfile} disabled={saving}>
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Отмена
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Основная информация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-12 w-12 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold">{profile.first_name} {profile.last_name}</h2>
                <p className="text-gray-600">{profile.title || 'Должность не указана'}</p>
              </div>
              
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{profile.phone}</span>
                  </div>
                )}
                {profile.department && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{profile.department}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    Создан: {new Date(profile.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={profile.is_active ? "default" : "secondary"}>
                    {profile.is_active ? "Активен" : "Неактивен"}
                  </Badge>
                  <Badge variant={profile.is_verified ? "default" : "destructive"}>
                    {profile.is_verified ? "Подтвержден" : "Не подтвержден"}
                  </Badge>
                  {profile.is_superuser && (
                    <Badge variant="destructive">
                      <Shield className="h-3 w-3 mr-1" />
                      Администратор
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Детальная информация</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Имя *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    disabled={!isEditing}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="last_name">Фамилия *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    disabled={!isEditing}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="username">Имя пользователя</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                <div>
                  <Label htmlFor="title">Должность</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                <div>
                  <Label htmlFor="department">Отдел</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="bio">О себе</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    disabled={!isEditing}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="timezone">Часовой пояс</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({...formData, timezone: value})}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Europe/Moscow">Москва (GMT+3)</SelectItem>
                      <SelectItem value="Europe/Kiev">Киев (GMT+2)</SelectItem>
                      <SelectItem value="Asia/Almaty">Алматы (GMT+6)</SelectItem>
                      <SelectItem value="America/New_York">Нью-Йорк (GMT-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="locale">Язык</Label>
                  <Select
                    value={formData.locale}
                    onValueChange={(value) => setFormData({...formData, locale: value})}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="uk">Українська</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Information */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Информация об аккаунте</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Email</Label>
                <p className="text-sm text-gray-600">{profile.email}</p>
              </div>
              <div>
                <Label>Компания</Label>
                <p className="text-sm text-gray-600">{profile.tenant_name}</p>
              </div>
              <div>
                <Label>Роль</Label>
                <p className="text-sm text-gray-600 capitalize">{profile.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <Button variant="outline" onClick={() => router.push('/settings')}>
            Настройки
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            К панели управления
          </Button>
        </div>
      </div>
    </div>
  )
}