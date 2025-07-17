'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
    } else {
      setError('Токен сброса пароля не найден')
    }
  }, [searchParams])

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Пароль должен содержать минимум 8 символов'
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Пароль должен содержать строчную букву'
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Пароль должен содержать заглавную букву'
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Пароль должен содержать цифру'
    }
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/.test(password)) {
      return 'Пароль должен содержать специальный символ'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Токен сброса пароля не найден')
      return
    }

    if (!newPassword || !confirmPassword) {
      setError('Заполните все поля')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          new_password_confirm: confirmPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
      } else {
        setError(data.detail || 'Произошла ошибка при сбросе пароля')
      }
    } catch (error) {
      setError('Произошла ошибка при отправке запроса')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Пароль изменен</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
            <div>
              <p className="text-gray-600">
                Ваш пароль успешно изменен. Теперь вы можете войти в аккаунт с новым паролем.
              </p>
            </div>
            <Button 
              onClick={() => router.push('/login')} 
              className="w-full"
            >
              Войти в аккаунт
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!token && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Ошибка</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-red-600" />
            <div>
              <p className="text-gray-600">{error}</p>
            </div>
            <Button 
              onClick={() => router.push('/forgot-password')} 
              className="w-full"
            >
              Запросить новую ссылку
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Lock className="h-8 w-8 mx-auto mb-4 text-blue-600" />
          <CardTitle className="text-2xl">Новый пароль</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Новый пароль</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Введите новый пароль"
                required
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
              <p className="font-medium mb-1">Требования к паролю:</p>
              <ul className="text-xs space-y-1">
                <li>• Минимум 8 символов</li>
                <li>• Содержит заглавную букву</li>
                <li>• Содержит строчную букву</li>
                <li>• Содержит цифру</li>
                <li>• Содержит специальный символ</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Изменяем пароль...' : 'Изменить пароль'}
            </Button>

            <div className="text-center">
              <Button
                variant="link"
                onClick={() => router.push('/login')}
                className="text-sm"
              >
                Вернуться к входу
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}