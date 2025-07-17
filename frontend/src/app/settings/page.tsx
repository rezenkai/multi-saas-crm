'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { isAuthenticated, getToken, redirectToLogin, logout } from '@/lib/auth'
import { useTheme } from '@/contexts/ThemeContext'
import { 
  Settings, 
  Shield, 
  Bell, 
  Moon, 
  Globe, 
  Lock,
  Trash2,
  AlertTriangle
} from 'lucide-react'

interface UserSettings {
  theme: string
  locale: string
  timezone: string
  email_notifications: boolean
  sms_notifications: boolean
  marketing_emails: boolean
}

interface PasswordChangeData {
  current_password: string
  new_password: string
  new_password_confirm: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState<UserSettings>({
    theme: 'light',
    locale: 'ru',
    timezone: 'UTC',
    email_notifications: true,
    sms_notifications: false,
    marketing_emails: false
  })

  // Синхронизируем тему из context
  useEffect(() => {
    setSettings(prev => ({ ...prev, theme }))
  }, [theme])
  
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    current_password: '',
    new_password: '',
    new_password_confirm: ''
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin()
      return
    }
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
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
        setSettings({
          theme: data.theme || 'light',
          locale: data.locale || 'ru',
          timezone: data.timezone || 'UTC',
          email_notifications: data.email_notifications || true,
          sms_notifications: data.sms_notifications || false,
          marketing_emails: data.marketing_emails || false
        })
      } else {
        console.error('Failed to fetch settings')
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async () => {
    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }

    setSaving(true)
    try {
      const response = await fetch('http://localhost:3001/api/v1/users/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        // Theme changes are handled by ThemeProvider automatically
      } else {
        console.error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (passwordData.new_password !== passwordData.new_password_confirm) {
      alert('Новые пароли не совпадают')
      return
    }

    if (passwordData.new_password.length < 8) {
      alert('Пароль должен содержать минимум 8 символов')
      return
    }

    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(passwordData)
      })

      if (response.ok) {
        setIsPasswordDialogOpen(false)
        setPasswordData({
          current_password: '',
          new_password: '',
          new_password_confirm: ''
        })
        alert('Пароль успешно изменен')
      } else {
        const error = await response.json()
        alert(error.detail || 'Ошибка при изменении пароля')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      alert('Ошибка при изменении пароля')
    } finally {
      setChangingPassword(false)
    }
  }

  const deleteAccount = async () => {
    const confirmation = prompt('Для подтверждения удаления аккаунта введите "DELETE":')
    if (confirmation !== 'DELETE') {
      return
    }

    const token = getToken()
    if (!token) {
      redirectToLogin()
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/v1/users/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        logout()
        router.push('/login')
      } else {
        alert('Ошибка при удалении аккаунта')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Ошибка при удалении аккаунта')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Загружаем настройки...</p>
          </div>
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
              <h1 className="text-3xl font-bold text-gray-900">Настройки</h1>
              <p className="text-gray-600 mt-2">Управление предпочтениями и безопасностью аккаунта</p>
            </div>
            <Button onClick={() => router.push('/profile')} variant="outline">
              К профилю
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="h-5 w-5" />
                Внешний вид
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="theme">Тема</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(value) => {
                      setSettings({...settings, theme: value})
                      setTheme(value as 'light' | 'dark' | 'system')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Светлая</SelectItem>
                      <SelectItem value="dark">Темная</SelectItem>
                      <SelectItem value="system">Системная</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="locale">Язык интерфейса</Label>
                  <Select
                    value={settings.locale}
                    onValueChange={(value) => setSettings({...settings, locale: value})}
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

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Региональные настройки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="timezone">Часовой пояс</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings({...settings, timezone: value})}
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
                    <SelectItem value="Europe/London">Лондон (GMT+0)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Токио (GMT+9)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Уведомления
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email уведомления</Label>
                    <p className="text-sm text-gray-600">Получать уведомления о важных событиях</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.email_notifications}
                    onChange={(e) => setSettings({...settings, email_notifications: e.target.checked})}
                    className="rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>SMS уведомления</Label>
                    <p className="text-sm text-gray-600">Получать SMS о критических событиях</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sms_notifications}
                    onChange={(e) => setSettings({...settings, sms_notifications: e.target.checked})}
                    className="rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Маркетинговые письма</Label>
                    <p className="text-sm text-gray-600">Получать информацию о новых функциях</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.marketing_emails}
                    onChange={(e) => setSettings({...settings, marketing_emails: e.target.checked})}
                    className="rounded"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Безопасность
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Пароль</Label>
                  <p className="text-sm text-gray-600">Последнее изменение: более месяца назад</p>
                </div>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Lock className="h-4 w-4 mr-2" />
                      Изменить пароль
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Изменение пароля</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="current_password">Текущий пароль</Label>
                        <Input
                          id="current_password"
                          type="password"
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="new_password">Новый пароль</Label>
                        <Input
                          id="new_password"
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="new_password_confirm">Подтвердите новый пароль</Label>
                        <Input
                          id="new_password_confirm"
                          type="password"
                          value={passwordData.new_password_confirm}
                          onChange={(e) => setPasswordData({...passwordData, new_password_confirm: e.target.value})}
                        />
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button onClick={changePassword} disabled={changingPassword}>
                          {changingPassword ? 'Изменение...' : 'Изменить пароль'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Опасная зона
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-red-600">Удаление аккаунта</Label>
                  <p className="text-sm text-gray-600">Безвозвратно удалить аккаунт и все данные</p>
                </div>
                <Button variant="destructive" onClick={deleteAccount}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Удалить аккаунт
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Отмена
            </Button>
            <Button onClick={updateSettings} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}