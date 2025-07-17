'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Очищаем устаревшие токены при загрузке страницы
  React.useEffect(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }, [])
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  })
  
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user', JSON.stringify(data.user))
        router.push('/')
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Ошибка при входе')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (registerData.password !== registerData.password_confirm) {
      setError('Пароли не совпадают')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      })

      if (response.ok) {
        setError('')
        setIsLogin(true)
        setLoginData({ email: registerData.email, password: '' })
        // Показываем сообщение об успешной регистрации
        alert('Регистрация успешна! Теперь войдите в систему.')
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Ошибка при регистрации')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLogin ? 'Вход в систему' : 'Регистрация'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            CRM система управления
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {isLogin ? 'Войти' : 'Создать аккаунт'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="Ваш пароль"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Вход...' : 'Войти'}
                </Button>
                
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => router.push('/forgot-password')}
                    className="text-sm text-blue-600"
                  >
                    Забыли пароль?
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">Имя</Label>
                    <Input
                      id="first_name"
                      type="text"
                      required
                      value={registerData.first_name}
                      onChange={(e) => setRegisterData({ ...registerData, first_name: e.target.value })}
                      placeholder="Имя"
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Фамилия</Label>
                    <Input
                      id="last_name"
                      type="text"
                      required
                      value={registerData.last_name}
                      onChange={(e) => setRegisterData({ ...registerData, last_name: e.target.value })}
                      placeholder="Фамилия"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg_email">Email</Label>
                  <Input
                    id="reg_email"
                    type="email"
                    required
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="reg_password">Пароль</Label>
                  <Input
                    id="reg_password"
                    type="password"
                    required
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    placeholder="Пароль (минимум 8 символов)"
                    minLength={8}
                  />
                </div>
                <div>
                  <Label htmlFor="password_confirm">Подтвердите пароль</Label>
                  <Input
                    id="password_confirm"
                    type="password"
                    required
                    value={registerData.password_confirm}
                    onChange={(e) => setRegisterData({ ...registerData, password_confirm: e.target.value })}
                    placeholder="Повторите пароль"
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                </Button>
              </form>
            )}

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">или</span>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setError('')
                  }}
                >
                  {isLogin ? 'Создать новый аккаунт' : 'Уже есть аккаунт? Войти'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Демо данные для тестирования */}
        <Card className="bg-blue-50">
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Для тестирования:</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p>Email: testcontacts@example.com</p>
              <p>Пароль: TestPassword123!</p>
              <p className="mt-2 text-blue-600">Или создайте новый аккаунт</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 