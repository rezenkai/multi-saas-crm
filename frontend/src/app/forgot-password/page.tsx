'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email) {
      setError('Введите email адрес')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setSent(true)
      } else {
        setError(data.detail || 'Произошла ошибка')
      }
    } catch (error) {
      setError('Произошла ошибка при отправке запроса')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Письмо отправлено</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Mail className="h-12 w-12 mx-auto text-blue-600" />
            <div>
              <p className="text-gray-600">
                Инструкции по восстановлению пароля отправлены на указанный email адрес.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Если письмо не пришло, проверьте папку спам.
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={() => router.push('/login')} 
                className="w-full"
              >
                Вернуться к входу
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSent(false)} 
                className="w-full"
              >
                Отправить повторно
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/login')}
              className="absolute left-4 top-4"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="text-2xl">Восстановление пароля</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email адрес</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
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
              <p>
                Введите email адрес, связанный с вашим аккаунтом. 
                Мы отправим вам ссылку для создания нового пароля.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Отправляем...' : 'Отправить инструкции'}
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